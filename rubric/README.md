# The Tribute Rubric

Five stages, modeled on the Apple Steps of Service, adapted for software. An
agent (or a human) walks the app's customer journey as a **first-time visitor
who arrived from a Show HN link with 30 seconds of patience**, and scores each
stage 1–5.

## Guidepost

Tribute answers the question builders usually skip before asking for users:
can a stranger become one?

The Tune Up is not generic QA and it is not a growth hack. It is a customer
journey readiness review. Before a builder asks Reddit, Hacker News, Product
Hunt, or any other crowd for attention, Tribute checks whether the app can
approach, understand, serve, recover with, and close the loop with a first-time
visitor. The report should help builders fix that journey, and the register
should help users spend attention on apps that have survived one.

These files are the source of truth. The Tune Up pipeline (`packages/tuneup`)
loads them at runtime to build its mission prompts, so a rubric edit changes
scoring behavior without a code change. Keep each stage file in the same shape:
**Question → Mission → Scoring anchors**.

| Stage | File | Question it answers |
|---|---|---|
| Approach | [approach.md](approach.md) | Do the first five seconds tell me what this is and why I'd care? |
| Probe | [probe.md](probe.md) | Does onboarding learn what I need, or dump me somewhere empty? |
| Present | [present.md](present.md) | Can I accomplish the core thing? How many steps, how many dead ends? |
| Listen | [listen.md](listen.md) | What happens when I typo, submit blanks, or hit back mid-flow? |
| End | [end.md](end.md) | Is there a confirmation, a farewell, a reason to return — or does the journey just stop? |

## Scoring rules

- Scores are integers 1–5. A 3 means "adequate, unremarkable" — not a failure.
- **Every score requires evidence**: a citation to a specific observed moment
  (step number + screenshot + observation). A score without a citation is
  rejected by the report schema.
- Simple apps must not be punished for being simple. A micro-utility with no
  onboarding can still score 5 on Probe if the first screen *is* the product
  and nothing is missing. Score the journey the app needs, not the journey a
  bigger app would have.
- Two runs per app. Where runs agree, trust it; where they diverge, the rubric
  criterion is underspecified — file an issue against the stage file, not the
  app.

## Verdict

An app passes the Tune Up when no stage scores below 3 and the total is ≥ 18/25.
The output is a service report, not a takedown: every score below 4 ships with
a concrete, actionable observation the builder can fix.

## Resubmission

A failed Tune Up is a repair path, not a permanent sentence. Builders may fix
the cited journey breaks and resubmit for another Tune Up. The register should
move them to `resubmitted`, keep the prior report linked, and add resubmission
details so reviewers and users can see both the history and the path back to
trust. Verification is restored only after the new customer journey passes.
