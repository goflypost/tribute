#!/usr/bin/env node
// tribute-tuneup <url> --name <AppName> [--runs 2] [--missions approach,listen] [--out reports]
//
// Runs one app through the five rubric missions, twice by default, and writes
// a draft report + evidence bundle a human reviews before anything touches
// the register.
import { parseArgs } from "node:util";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { StageEnum, type Stage, type TuneupRun } from "@tribute/register";
import { launchBrowser } from "./browser.js";
import { loadMissions } from "./missions.js";
import { runMission, MODEL } from "./agent.js";
import { buildReport, printSummary, writeReport } from "./report.js";

const { values, positionals } = parseArgs({
  options: {
    name: { type: "string" },
    runs: { type: "string", default: "2" },
    missions: { type: "string" },
    out: { type: "string", default: "reports" },
  },
  allowPositionals: true,
});

const url = positionals[0];
if (url === undefined) {
  console.error("usage: tribute-tuneup <url> --name <AppName> [--runs 2] [--missions approach,listen] [--out reports]");
  process.exit(1);
}
const appName = values.name ?? new URL(url).hostname;
const runCount = Math.max(1, Number(values.runs) || 2);
const stages: Stage[] | undefined = values.missions
  ?.split(",")
  .map((s) => StageEnum.parse(s.trim()));
const missions = loadMissions(stages);

const slug = appName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const reportDir = resolve(values.out ?? "reports", slug, stamp);
mkdirSync(reportDir, { recursive: true });

const client = new Anthropic(); // credentials resolved from env / ant profile

console.log(`Tune Up: ${appName} — ${url}`);
console.log(`Missions: ${missions.map((m) => m.stage).join(", ")} × ${runCount} run(s)`);
console.log(`Evidence: ${reportDir}\n`);

const browser = await launchBrowser();
const runs: TuneupRun[] = [];

try {
  for (let r = 1; r <= runCount; r++) {
    console.log(`— run ${r}/${runCount}`);
    const startedAt = new Date().toISOString();
    const runDir = join(reportDir, `run-${r}`);
    const stagesOut = [];

    for (const mission of missions) {
      console.log(`  mission: ${mission.stage}`);
      // Fresh context per mission: no cookies, no cache — the agent must
      // experience the true first visit every time.
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      try {
        const outcome = await runMission(client, context, mission, url, runDir);
        stagesOut.push(outcome.result);
        console.log(`  → ${outcome.result.reasoning}`);
      } finally {
        await context.close();
      }
    }

    runs.push({
      runId: `run-${r}`,
      startedAt,
      completedAt: new Date().toISOString(),
      stages: stagesOut,
    });
  }
} finally {
  await browser.close();
}

const report = buildReport({ name: appName, url }, MODEL, runs);
const path = writeReport(reportDir, report);
printSummary(report);
console.log(`\nReport written to ${path}`);
