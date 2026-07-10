# @tribute/register

The register schema, seed data, and validation gate.

- `src/schema.ts` — Zod schemas for the register, the heuristic rules file,
  and Tune Up reports. This is the shared contract: the Tune Up pipeline
  validates its output against it, CI validates community PRs against it.
- `data/register.json` — the register itself. **The database is the git
  history**: every entry arrives via commit, so every verdict has blame and a
  review trail. Merged changes are promoted to the `dist` branch by CI and
  served to extensions via jsDelivr.

Statuses are intentionally reversible. `failed` records a reviewed broken
journey; `resubmitted` records that the builder fixed the cited problems and
asked for another Tune Up while preserving the prior report. Trust comes back
only by passing the new review.

```sh
npm run validate   # validates register.json and ../heuristics/data/signals.json
```
