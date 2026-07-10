#!/usr/bin/env node
// Validates the declarative data that ships to every install:
//   - register/data/register.json     (the register itself)
//   - heuristics/data/signals.json    (heuristic rules the bundled engine interprets)
// CI runs this before anything is promoted to the `dist` branch.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { ZodType } from "zod";
import { RegisterFileSchema, SignalsFileSchema } from "./schema.js";

const here = dirname(fileURLToPath(import.meta.url));

function check(label: string, path: string, schema: ZodType): boolean {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (err) {
    console.error(`✗ ${label}: cannot read ${path}: ${String(err)}`);
    return false;
  }
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    console.error(`✗ ${label}: invalid JSON: ${String(err)}`);
    return false;
  }
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error(`✗ ${label}: schema violations:`);
    for (const issue of result.error.issues) {
      console.error(`    ${issue.path.join(".") || "(root)"}: ${issue.message}`);
    }
    return false;
  }
  console.log(`✓ ${label} is valid`);
  return true;
}

const registerPath = resolve(here, "../data/register.json");
const signalsPath = resolve(here, "../../heuristics/data/signals.json");

const ok =
  check("register.json", registerPath, RegisterFileSchema) &&
  check("signals.json", signalsPath, SignalsFileSchema);

process.exit(ok ? 0 : 1);
