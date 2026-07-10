# @tribute/tuneup

The Tune Up pipeline: an agentic reviewer that walks an app's customer journey
and drafts a scored service report. A CLI harness, not a service — and in
pre-alpha the agent is a **draft-writer, not a judge** (see [ETHICS.md](ETHICS.md)).

## How it works

- **Five missions, not one wander.** Each rubric stage is a scripted mission
  with a fixed persona, loaded at runtime from `rubric/<stage>.md`.
- **Observe → decide → act.** Playwright drives a real browser in a fresh
  context per mission (true first visit); Claude receives the accessibility
  tree + a screenshot and returns one structured action, hard-capped per
  mission.
- **Evidence or it didn't happen.** Scores come out as JSON validated by the
  same Zod schemas as the register; a score without a citation to an observed
  step is rejected by the schema.
- **Two runs by default.** Where they diverge, the rubric is underspecified —
  the variance is the deliverable.

## Usage

```sh
# needs ANTHROPIC_API_KEY (or an `ant auth login` profile) and Chrome installed
npm run tuneup -- https://example.app --name Example
npm run tuneup -- https://example.app --name Example --runs 1 --missions approach,listen
```

Reports and screenshots land in `reports/<app>/<timestamp>/`. Review the
draft, correct it, sign it (`humanReview`), then open a PR updating
`packages/register/data/register.json`. If the app previously failed and the
builder has fixed the cited issues, mark the entry `resubmitted` with the new
request details until the follow-up Tune Up is complete.
