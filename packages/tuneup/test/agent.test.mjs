import test from "node:test";
import assert from "node:assert/strict";
import { buildStageResult } from "../dist/agent.js";

const steps = [
  {
    index: 1,
    action: "click",
    detail: 'button "Start"',
    result: "ok",
    observation: "The app exposed a clear start action.",
    noteworthy: "Clear primary CTA.",
    screenshot: "approach-step-01.png",
  },
];

test("stage results attach screenshots from cited steps", () => {
  const result = buildStageResult(
    "approach",
    {
      score: 4,
      reasoning: "Approach: 4/5 - clear first screen.",
      evidence: [{ step: 1, observation: "The primary CTA was clear." }],
    },
    steps,
  );

  assert.equal(result.evidence[0].screenshot, "approach-step-01.png");
});

test("stage results reject nonexistent evidence steps", () => {
  assert.throws(
    () =>
      buildStageResult(
        "approach",
        {
          score: 2,
          reasoning: "Approach: 2/5 - cited a step that did not happen.",
          evidence: [{ step: 99, observation: "This step does not exist." }],
        },
        steps,
      ),
    /nonexistent step/,
  );
});
