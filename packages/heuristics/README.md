# @tribute/heuristics

Cheap static signals for unknown apps — the signature of untested vibe-coded
software, scored without deep testing.

**The split that matters:** Manifest V3 forbids remotely-loaded code, so the
engine (`src/index.ts`, pure functions, zero dependencies) ships bundled in
the extension and changes rarely. The *rules* (`data/signals.json` — patterns,
weights, thresholds) are declarative data, fetched daily by every install via
jsDelivr. A merged PR against `signals.json` ships to everyone within a day,
no extension update required.

Rules are validated by `@tribute/register`'s schema in CI before promotion.

```sh
npm test   # builds and runs the engine tests
```
