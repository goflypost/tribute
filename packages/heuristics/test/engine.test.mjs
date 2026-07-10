import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { appraise } from "../dist/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const rules = JSON.parse(readFileSync(resolve(here, "../data/signals.json"), "utf8"));

const FINISHED_HTML = `<!doctype html><html><head>
<title>Acme Ledger — bookkeeping for freelancers</title>
<link rel="icon" href="/favicon.ico">
<meta property="og:title" content="Acme Ledger">
</head><body>
<h1>Bookkeeping for freelancers</h1>
<p>${"Track invoices, expenses, and taxes in one place. ".repeat(10)}</p>
<a href="/pricing">Pricing</a><a href="/about">About</a>
</body></html>`;

const SLOP_HTML = `<!doctype html><html><head><title>Vite + React</title></head>
<body><div id="root"></div><script src="/main.js"></script>
<p>Made with Lovable</p></body></html>`;

test("a finished app on its own domain scores clear", () => {
  const result = appraise({ url: "https://acmeledger.com", html: FINISHED_HTML }, rules);
  assert.equal(result.verdict, "clear");
  assert.equal(result.hits.length, 0);
});

test("the untested-app signature gets flagged", () => {
  const result = appraise({ url: "https://acme-ledger.vercel.app", html: SLOP_HTML }, rules);
  assert.equal(result.verdict, "flag");
  const ids = result.hits.map((h) => h.id);
  assert.ok(ids.includes("default-platform-domain"));
  assert.ok(ids.includes("default-framework-title"));
  assert.ok(ids.includes("blank-without-js"));
});

test("url-only appraisal reports reduced confidence", () => {
  const withHtml = appraise({ url: "https://x.vercel.app", html: SLOP_HTML }, rules);
  const urlOnly = appraise({ url: "https://x.vercel.app" }, rules);
  assert.ok(urlOnly.confidence < withHtml.confidence);
  assert.ok(urlOnly.applied.length < withHtml.applied.length);
});

test("engine is pure — same input, same appraisal", () => {
  const a = appraise({ url: "https://x.vercel.app", html: SLOP_HTML }, rules);
  const b = appraise({ url: "https://x.vercel.app", html: SLOP_HTML }, rules);
  assert.deepEqual(a, b);
});
