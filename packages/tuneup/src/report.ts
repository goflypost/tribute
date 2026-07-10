import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  STAGES,
  TuneupReportSchema,
  type Stage,
  type TuneupReport,
  type TuneupRun,
} from "@tribute/register";

export function buildReport(app: { name: string; url: string }, model: string, runs: TuneupRun[]): TuneupReport {
  const report: TuneupReport = {
    version: 1,
    app,
    model,
    runs,
    // The agent is a draft-writer, not a judge. Nothing touches the register
    // until a human reads this report, corrects it, and signs it.
    humanReview: { reviewed: false },
  };
  return TuneupReportSchema.parse(report);
}

export function writeReport(dir: string, report: TuneupReport): string {
  const path = join(dir, "report.json");
  writeFileSync(path, JSON.stringify(report, null, 2) + "\n");
  return path;
}

export function printSummary(report: TuneupReport): void {
  console.log(`\nTune Up summary — ${report.app.name} (${report.app.url})`);
  const header = ["stage", ...report.runs.map((_, i) => `run ${i + 1}`)].join("  \t");
  console.log(header);

  const divergent: Stage[] = [];
  for (const stage of STAGES) {
    const scores = report.runs.map(
      (run) => run.stages.find((s) => s.stage === stage)?.score,
    );
    const shown = scores.map((s) => (s === undefined ? "-" : `${s}/5`));
    const defined = scores.filter((s): s is number => s !== undefined);
    const diverges = defined.length > 1 && new Set(defined).size > 1;
    if (diverges) divergent.push(stage);
    console.log([stage, ...shown].join("  \t") + (diverges ? "   ← diverges" : ""));
  }

  for (const run of report.runs) {
    for (const stage of run.stages) {
      console.log(`\n${stage.reasoning}`);
    }
    break; // reasoning from the first run is enough for the console summary
  }

  if (divergent.length > 0) {
    console.log(
      `\n⚠ Runs diverge on: ${divergent.join(", ")}. That's not noise to average away — ` +
        `it means those rubric criteria are underspecified. File an issue against rubric/<stage>.md.`,
    );
  }
  console.log(
    "\nThis report is a DRAFT. Review it, correct it, set humanReview.reviewed=true " +
      "with your name, then open a PR updating the register.",
  );
}
