import { build } from "esbuild";
import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("dist/snapshot", { recursive: true });

// MV3 content scripts can't be ES modules — bundle everything as IIFE.
await build({
  entryPoints: ["src/background.ts", "src/content.ts", "src/popup.ts"],
  bundle: true,
  format: "iife",
  target: "chrome120",
  outdir: "dist",
});

copyFileSync("manifest.json", "dist/manifest.json");
copyFileSync("src/popup.html", "dist/popup.html");

// Bundled snapshot: the offline / first-run fallback for the daily CDN fetch.
copyFileSync("../packages/register/data/register.json", "dist/snapshot/register.json");
copyFileSync("../packages/heuristics/data/signals.json", "dist/snapshot/signals.json");

console.log("extension built → extension/dist (load unpacked from there)");
