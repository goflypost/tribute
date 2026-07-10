# Tribute extension

Chrome (MV3) extension. Show HN first; Product Hunt and beyond later.

## Build & load

```sh
npm run build -w tribute-extension
```

Then in Chrome: `chrome://extensions` → Developer mode → **Load unpacked** →
select `extension/dist`.

## Architecture notes

- **Bundled engine, remote data.** MV3 bans remotely-loaded code, so the
  heuristics engine is bundled from `@tribute/heuristics`. The register and
  the heuristic rules are *data*, fetched once a day from jsDelivr over the
  repo's `dist` branch, with a snapshot bundled at build time as the
  offline/first-run fallback.
- **Verdict order:** personal trust/block lists → register → heuristics.
  Your lists beat every other signal, always.
- The only self-initiated network request is the daily data refresh. Page
  HTML inspection for linked apps is off by default and requires an explicit
  Chrome permission grant from the popup. Without that grant, Tribute uses
  URL/title heuristics only.
