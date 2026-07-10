// The Tribute heuristics engine.
//
// Manifest V3 bans remotely-loaded executable code, so this engine ships
// bundled inside the extension and rarely changes. Everything meant to
// iterate daily — patterns, weights, thresholds — lives in data/signals.json,
// which the engine interprets. Zero runtime dependencies so it bundles clean.

export type Verdict = "clear" | "caution" | "flag";

export type BuiltinCheck = "no-favicon" | "missing-og" | "empty-body";

export interface SignalRule {
  id: string;
  description: string;
  /** Contribution toward the flag score. All weights across rules sum to ~1. */
  weight: number;
  type: "url-pattern" | "title-pattern" | "html-pattern" | "check";
  /** Case-insensitive regex source, for the three pattern types. */
  pattern?: string;
  /** Built-in inspection, for type "check". */
  check?: BuiltinCheck;
}

export interface SignalsFile {
  version: number;
  updatedAt: string;
  thresholds: { flag: number; caution: number };
  signals: SignalRule[];
}

export interface AppraisalInput {
  url: string;
  /** Listing title, if the surface provides one (e.g. the Show HN title). */
  title?: string;
  /** Raw HTML of the app's landing page. Omit when it couldn't be fetched. */
  html?: string;
}

export interface SignalHit {
  id: string;
  description: string;
  weight: number;
}

export interface Appraisal {
  verdict: Verdict;
  /** Hit weight over applicable weight, 0..1. */
  score: number;
  /** How much of the total rule weight could actually be evaluated, 0..1. */
  confidence: number;
  hits: SignalHit[];
  /** Rule ids that were evaluated (skipped rules — e.g. html rules with no html — are absent). */
  applied: string[];
}

const CHECKS: Record<BuiltinCheck, (html: string) => boolean> = {
  "no-favicon": (html) => !/rel=["']?(?:shortcut\s+)?(?:icon|apple-touch-icon)/i.test(html),
  "missing-og": (html) => !/(?:property|name)=["']og:/i.test(html),
  "empty-body": (html) => {
    const body = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html)?.[1] ?? html;
    const text = body
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return text.length < 100;
  },
};

function subjectFor(rule: SignalRule, input: AppraisalInput): string | undefined {
  switch (rule.type) {
    case "url-pattern":
      return input.url;
    case "title-pattern":
      return input.title;
    case "html-pattern":
    case "check":
      return input.html;
  }
}

/**
 * Score an unknown app against the signature of untested vibe-coded software.
 * Pure function: same input + same rules = same appraisal, everywhere it runs.
 */
export function appraise(input: AppraisalInput, rules: SignalsFile): Appraisal {
  const hits: SignalHit[] = [];
  const applied: string[] = [];
  let appliedWeight = 0;
  let totalWeight = 0;

  for (const rule of rules.signals) {
    totalWeight += rule.weight;
    const subject = subjectFor(rule, input);
    if (subject === undefined) continue;

    applied.push(rule.id);
    appliedWeight += rule.weight;

    let hit = false;
    if (rule.type === "check" && rule.check !== undefined) {
      hit = CHECKS[rule.check](subject);
    } else if (rule.pattern !== undefined) {
      hit = new RegExp(rule.pattern, "i").test(subject);
    }
    if (hit) {
      hits.push({ id: rule.id, description: rule.description, weight: rule.weight });
    }
  }

  const score = appliedWeight > 0 ? hits.reduce((s, h) => s + h.weight, 0) / appliedWeight : 0;
  const confidence = totalWeight > 0 ? appliedWeight / totalWeight : 0;
  const verdict: Verdict =
    score >= rules.thresholds.flag ? "flag" : score >= rules.thresholds.caution ? "caution" : "clear";

  return { verdict, score, confidence, hits, applied };
}
