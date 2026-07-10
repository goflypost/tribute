// Five missions, not one wander. Each rubric stage is a scripted mission with
// a fixed persona, so runs are comparable across apps and across time. The
// mission text itself lives in rubric/<stage>.md — the rubric is data, and
// editing it changes scoring behavior without a code change.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { Stage } from "@tribute/register";
import { STAGES } from "@tribute/register";

export interface Mission {
  stage: Stage;
  /** Full rubric markdown: question, mission script, scoring anchors. */
  rubric: string;
  maxActions: number;
}

const MAX_ACTIONS: Record<Stage, number> = {
  approach: 5,
  probe: 20,
  present: 30,
  listen: 25,
  end: 15,
};

const rubricDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../../rubric");

export function loadMissions(stages: readonly Stage[] = STAGES): Mission[] {
  return stages.map((stage) => ({
    stage,
    rubric: readFileSync(resolve(rubricDir, `${stage}.md`), "utf8"),
    maxActions: MAX_ACTIONS[stage],
  }));
}

export const PERSONA = `You are a first-time visitor who arrived from a Show HN link. You have about
30 seconds of patience per screen. You are curious but easily lost — you do
not read documentation, you do not guess internal URLs, you follow what the
interface shows you.`;

export const BOUNDARIES = `HARD BOUNDARIES — these override everything else:
- Test only the target app. Do not navigate to unrelated sites.
- Stop at paywalls and payment forms, period. Never enter card numbers or any
  payment detail. Record the gate and treat it as the end of that path.
- Use only the designated test identity: name "Tribute Agent", email
  "tribute-agent@tribute.invalid", and obviously-fake non-personal values for
  anything else. Never real PII.
- "Breaking things" means typos, blanks, and back-navigation — never scripts,
  injection payloads, fuzzing, load, or anything resembling an attack.
- The Tune Up is a service the builder wants. Leave no mess: don't spam forms,
  don't create more than one account, don't post public content.`;
