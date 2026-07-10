import test from "node:test";
import assert from "node:assert/strict";
import { RegisterFileSchema, SignalsFileSchema } from "../dist/index.js";

const validRegister = {
  version: 1,
  updatedAt: "2026-07-10",
  entries: [
    {
      domain: "example.com",
      name: "Example",
      url: "https://example.com",
      status: "pending",
      addedAt: "2026-07-10",
    },
  ],
};

const validSignals = {
  version: 1,
  updatedAt: "2026-07-10",
  thresholds: { flag: 0.45, caution: 0.25 },
  signals: [
    {
      id: "default-domain",
      description: "Default app platform domain",
      weight: 0.4,
      type: "url-pattern",
      pattern: "vercel\\.app",
    },
    {
      id: "missing-og",
      description: "No Open Graph tags",
      weight: 0.6,
      type: "check",
      check: "missing-og",
    },
  ],
};

test("register dates must be real calendar dates", () => {
  const result = RegisterFileSchema.safeParse({ ...validRegister, updatedAt: "2026-99-99" });
  assert.equal(result.success, false);
});

test("signals dates must be real calendar dates", () => {
  const result = SignalsFileSchema.safeParse({ ...validSignals, updatedAt: "2026-99-99" });
  assert.equal(result.success, false);
});

test("signal weights must sum to 1", () => {
  const bad = {
    ...validSignals,
    signals: validSignals.signals.map((signal) => ({ ...signal, weight: 0.4 })),
  };
  const result = SignalsFileSchema.safeParse(bad);
  assert.equal(result.success, false);
});

test("check rules cannot carry pattern fields", () => {
  const bad = {
    ...validSignals,
    signals: [
      validSignals.signals[0],
      { ...validSignals.signals[1], pattern: "og:" },
    ],
  };
  const result = SignalsFileSchema.safeParse(bad);
  assert.equal(result.success, false);
});

test("resubmitted entries must preserve prior tuneup and resubmission details", () => {
  const bad = {
    ...validRegister,
    entries: [
      {
        ...validRegister.entries[0],
        status: "resubmitted",
      },
    ],
  };
  const result = RegisterFileSchema.safeParse(bad);
  assert.equal(result.success, false);
});
