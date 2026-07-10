// The observe-decide-act loop. Accessibility tree + screenshot in, one
// structured action out, hard-capped per mission so a confused agent fails
// loudly instead of wandering.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import type { MessageCreateParamsNonStreaming, Tool } from "@anthropic-ai/sdk/resources/messages/messages";
import { z } from "zod";
import type { BrowserContext, Page } from "playwright-core";
import type { StageResult } from "@tribute/register";
import { BOUNDARIES, PERSONA, type Mission } from "./missions.js";

export const MODEL = "claude-opus-4-8";

const ActionSchema = z.object({
  observation: z
    .string()
    .describe("What you see right now and how it relates to the mission."),
  action: z.enum(["click", "type", "press", "navigate", "back", "scroll", "done"]),
  targetRole: z
    .string()
    .nullable()
    .describe("ARIA role of the element to act on (button, link, textbox...), for click/type."),
  targetName: z
    .string()
    .nullable()
    .describe("Accessible name of the element, as shown in the accessibility tree."),
  text: z.string().nullable().describe("Text to type, for the type action."),
  url: z.string().nullable().describe("Destination, for the navigate action."),
  key: z.string().nullable().describe("Key to press (Enter, Escape...), for the press action."),
  noteworthy: z
    .string()
    .nullable()
    .describe("Set when this moment is evidence-worthy for scoring — good or bad."),
});
type Action = z.infer<typeof ActionSchema>;

const ScoreSchema = z.object({
  score: z.number().int().min(1).max(5).describe("Rubric score for this stage."),
  reasoning: z
    .string()
    .describe('Explainable, specific, in the form "Probe: 2/5 — no onboarding, first screen is a settings page".'),
  evidence: z
    .array(
      z.object({
        step: z.number().int().min(1).describe("The action-log step number this cites."),
        observation: z.string().describe("What was observed at that step that justifies the score."),
      }),
    )
    .min(1)
    .describe("Every score must cite specific observed moments."),
});
type Score = z.infer<typeof ScoreSchema>;

const ACTION_TOOL: Tool = {
  name: "next_action",
  description: "Return the next browser action for this Tune Up mission.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      observation: { type: "string" },
      action: { enum: ["click", "type", "press", "navigate", "back", "scroll", "done"] },
      targetRole: { type: ["string", "null"] },
      targetName: { type: ["string", "null"] },
      text: { type: ["string", "null"] },
      url: { type: ["string", "null"] },
      key: { type: ["string", "null"] },
      noteworthy: { type: ["string", "null"] },
    },
    required: ["observation", "action", "targetRole", "targetName", "text", "url", "key", "noteworthy"],
  },
};

const SCORE_TOOL: Tool = {
  name: "stage_score",
  description: "Return the scored Tune Up stage result.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      score: { type: "integer", minimum: 1, maximum: 5 },
      reasoning: { type: "string" },
      evidence: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            step: { type: "integer", minimum: 1 },
            observation: { type: "string" },
          },
          required: ["step", "observation"],
        },
      },
    },
    required: ["score", "reasoning", "evidence"],
  },
};

async function parseToolInput<T>(
  client: Anthropic,
  params: MessageCreateParamsNonStreaming,
  tool: Tool,
  schema: z.ZodType<T>,
): Promise<T | null> {
  const response = await client.messages.create({
    ...params,
    tools: [tool],
    tool_choice: { type: "tool", name: tool.name, disable_parallel_tool_use: true },
  });
  const block = response.content.find((item) => item.type === "tool_use" && item.name === tool.name);
  if (block === undefined || block.type !== "tool_use") return null;
  const parsed = schema.safeParse(block.input);
  return parsed.success ? parsed.data : null;
}

export interface StepRecord {
  index: number;
  action: string;
  detail: string;
  result: string;
  observation: string;
  noteworthy: string | null;
  screenshot: string;
}

export interface MissionOutcome {
  stage: StageResult["stage"];
  steps: StepRecord[];
  result: StageResult;
}

function sameSite(url: string, baseHost: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === baseHost || host.endsWith(`.${baseHost}`);
  } catch {
    return false;
  }
}

const PAYMENT_FIELD = /card|cvv|cvc|iban|routing|account number/i;

async function performAction(page: Page, action: Action, baseHost: string): Promise<string> {
  const locator = () => {
    const role = (action.targetRole ?? "button") as Parameters<Page["getByRole"]>[0];
    return page.getByRole(role, { name: action.targetName ?? undefined, exact: false }).first();
  };
  try {
    switch (action.action) {
      case "click":
        await locator().click({ timeout: 5000 });
        break;
      case "type": {
        if (PAYMENT_FIELD.test(action.targetName ?? "")) {
          return "REFUSED by harness: payment-detail field. Boundary: stop at payment forms.";
        }
        await locator().fill(action.text ?? "", { timeout: 5000 });
        break;
      }
      case "press":
        await page.keyboard.press(action.key ?? "Enter");
        break;
      case "navigate": {
        const url = action.url ?? "";
        if (!sameSite(url, baseHost)) {
          return `REFUSED by harness: ${url} is off the target site.`;
        }
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
        break;
      }
      case "back":
        await page.goBack({ waitUntil: "domcontentloaded", timeout: 15000 });
        break;
      case "scroll":
        await page.mouse.wheel(0, 800);
        break;
      case "done":
        return "mission ended by agent";
    }
    await page.waitForLoadState("domcontentloaded").catch(() => {});
    await page.waitForTimeout(750);
    return "ok";
  } catch (err) {
    return `FAILED: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`;
  }
}

function formatLog(steps: StepRecord[]): string {
  if (steps.length === 0) return "(no actions yet — this is your first look at the page)";
  return steps
    .map(
      (s) =>
        `${s.index}. ${s.action} ${s.detail} → ${s.result}` +
        `\n   saw: ${s.observation}` +
        (s.noteworthy ? `\n   NOTEWORTHY: ${s.noteworthy}` : ""),
    )
    .join("\n");
}

async function observe(page: Page, screenshotPath: string): Promise<{ tree: string; imageB64: string }> {
  let tree = "";
  try {
    tree = await page.locator("body").ariaSnapshot({ timeout: 5000 });
  } catch {
    tree = "(accessibility tree unavailable)";
  }
  if (tree.length > 6000) tree = tree.slice(0, 6000) + "\n… (truncated)";
  const buffer = await page.screenshot({ path: screenshotPath });
  return { tree, imageB64: buffer.toString("base64") };
}

export async function runMission(
  client: Anthropic,
  context: BrowserContext,
  mission: Mission,
  appUrl: string,
  outDir: string,
): Promise<MissionOutcome> {
  mkdirSync(outDir, { recursive: true });
  const page = await context.newPage();
  const baseHost = new URL(appUrl).hostname.replace(/^www\./, "");
  const steps: StepRecord[] = [];

  const system = `You are Tribute's Tune Up agent: an agentic reviewer walking a real app's
customer journey so it can be scored against the Tribute rubric.

${PERSONA}

${BOUNDARIES}

You interact through structured actions. Element roles and names come from the
accessibility tree you are shown. One action per turn. When the mission
objective is met — or nothing further can be learned — use action "done" and
summarize what you learned in "observation".`;

  await page.goto(appUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1500);

  for (let i = 1; i <= mission.maxActions; i++) {
    const screenshot = `${mission.stage}-step-${String(i).padStart(2, "0")}.png`;
    const { tree, imageB64 } = await observe(page, join(outDir, screenshot));

    const prompt = `MISSION — stage "${mission.stage}" (step ${i} of at most ${mission.maxActions}):

${mission.rubric}

Action log so far:
${formatLog(steps)}

Current URL: ${page.url()}

Accessibility tree:
${tree}

A screenshot of the current viewport is attached. Decide your single next action.`;

    const action = await parseToolInput(
      client,
      {
        model: MODEL,
        max_tokens: 16000,
        thinking: { type: "enabled", budget_tokens: 2048 },
        system,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image", source: { type: "base64", media_type: "image/png", data: imageB64 } },
            ],
          },
        ],
      },
      ACTION_TOOL,
      ActionSchema,
    );
    if (action === null) {
      steps.push({
        index: i,
        action: "error",
        detail: "",
        result: "model produced no parseable action",
        observation: "",
        noteworthy: null,
        screenshot,
      });
      break;
    }

    const detail =
      action.action === "navigate"
        ? (action.url ?? "")
        : action.action === "press"
          ? (action.key ?? "")
          : [action.targetRole, action.targetName && `"${action.targetName}"`, action.text && `⇒ "${action.text}"`]
              .filter(Boolean)
              .join(" ");

    const result = await performAction(page, action, baseHost);
    steps.push({
      index: i,
      action: action.action,
      detail,
      result,
      observation: action.observation,
      noteworthy: action.noteworthy,
      screenshot,
    });
    console.log(`    [${mission.stage} ${i}/${mission.maxActions}] ${action.action} ${detail} → ${result}`);

    if (action.action === "done") break;
  }

  await page.close();
  const result = await scoreMission(client, mission, steps);
  return { stage: mission.stage, steps, result };
}

async function scoreMission(
  client: Anthropic,
  mission: Mission,
  steps: StepRecord[],
): Promise<StageResult> {
  const prompt = `You just completed the "${mission.stage}" mission of a Tribute Tune Up.
Score it against the rubric below. The output is a service report, not a
takedown: every score below 4 needs a concrete, actionable observation the
builder can fix. Do not punish simple apps for being simple. Every evidence
item must cite a real step number from the action log.

RUBRIC:
${mission.rubric}

ACTION LOG:
${formatLog(steps)}`;

  const parsed = await parseToolInput(
    client,
    {
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "enabled", budget_tokens: 2048 },
      messages: [{ role: "user", content: prompt }],
    },
    SCORE_TOOL,
    ScoreSchema,
  );
  if (parsed === null) {
    throw new Error(`scoring the ${mission.stage} mission produced no parseable output`);
  }

  return buildStageResult(mission.stage, parsed, steps);
}

export function buildStageResult(stage: StageResult["stage"], parsed: Score, steps: StepRecord[]): StageResult {
  const stepByIndex = new Map(steps.map((step) => [step.index, step]));
  const missing = [...new Set(parsed.evidence.map((e) => e.step).filter((step) => !stepByIndex.has(step)))];
  if (missing.length > 0) {
    throw new Error(`scoring the ${stage} mission cited nonexistent step(s): ${missing.join(", ")}`);
  }

  const evidence = parsed.evidence.map((e) => {
    const step = stepByIndex.get(e.step);
    if (step === undefined) {
      throw new Error(`scoring the ${stage} mission cited nonexistent step ${e.step}`);
    }
    return {
      step: step.index,
      screenshot: step.screenshot,
      observation: e.observation,
    };
  });

  return { stage, score: parsed.score, reasoning: parsed.reasoning, evidence };
}
