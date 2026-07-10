import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared building blocks
// ---------------------------------------------------------------------------

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isRealDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const DateString = z
  .string()
  .regex(DATE_RE, "must be a YYYY-MM-DD date")
  .refine(isRealDate, { message: "must be a real calendar date" });

const DateTimeString = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: "must be a valid date-time",
});

export const StageEnum = z.enum(["approach", "probe", "present", "listen", "end"]);
export type Stage = z.infer<typeof StageEnum>;

export const STAGES = StageEnum.options;

const StageScore = z.number().int().min(1).max(5);

export const StageScoresSchema = z
  .object({
    approach: StageScore,
    probe: StageScore,
    present: StageScore,
    listen: StageScore,
    end: StageScore,
  })
  .strict();
export type StageScores = z.infer<typeof StageScoresSchema>;

// ---------------------------------------------------------------------------
// The register: apps that have been (or are queued to be) Tuned Up
// ---------------------------------------------------------------------------

export const RegisterEntrySchema = z
  .object({
    domain: z
      .string()
      .regex(/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/, "must be a bare lowercase domain"),
    name: z.string().min(1),
    url: z.string().url(),
    status: z.enum(["verified", "pending", "failed", "resubmitted"]),
    tuneup: z
      .object({
        date: DateString,
        scores: StageScoresSchema,
        report: z.string().min(1),
      })
      .strict()
      .optional(),
    resubmission: z
      .object({
        requestedAt: DateString,
        notes: z.string().optional(),
      })
      .strict()
      .optional(),
    notes: z.string().optional(),
    addedAt: DateString,
  })
  .strict()
  .refine((e) => e.status === "pending" || e.tuneup !== undefined, {
    message: "verified/failed/resubmitted entries must include their tuneup result",
  })
  .refine((e) => e.status !== "resubmitted" || e.resubmission !== undefined, {
    message: "resubmitted entries must include resubmission details",
  });
export type RegisterEntry = z.infer<typeof RegisterEntrySchema>;

export const RegisterFileSchema = z
  .object({
    version: z.literal(1),
    updatedAt: DateString,
    entries: z.array(RegisterEntrySchema),
  })
  .strict()
  .refine(
    (f) => new Set(f.entries.map((e) => e.domain)).size === f.entries.length,
    { message: "duplicate domains in register" },
  );
export type RegisterFile = z.infer<typeof RegisterFileSchema>;

// ---------------------------------------------------------------------------
// Heuristic rules file (packages/heuristics/data/signals.json)
// The engine is bundled code; this file is the remotely-updatable data it
// interprets. Community PRs land here, so validate at the door.
// ---------------------------------------------------------------------------

export const SignalRuleSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    description: z.string().min(1),
    weight: z.number().gt(0).lte(1),
    type: z.enum(["url-pattern", "title-pattern", "html-pattern", "check"]),
    pattern: z.string().optional(),
    check: z.enum(["no-favicon", "missing-og", "empty-body"]).optional(),
  })
  .strict()
  .refine((r) => (r.type === "check" ? r.check !== undefined && r.pattern === undefined : true), {
    message: "check rules need `check` and must not include `pattern`",
  })
  .refine((r) => (r.type === "check" ? true : r.pattern !== undefined && r.check === undefined), {
    message: "pattern rules need `pattern` and must not include `check`",
  })
  .refine(
    (r) => {
      if (r.pattern === undefined) return true;
      try {
        new RegExp(r.pattern, "i");
        return true;
      } catch {
        return false;
      }
    },
    { message: "pattern must be a valid regular expression" },
  );

export const SignalsFileSchema = z
  .object({
    version: z.literal(1),
    updatedAt: DateString,
    thresholds: z
      .object({
        flag: z.number().gt(0).lte(1),
        caution: z.number().gt(0).lte(1),
      })
      .strict()
      .refine((t) => t.caution < t.flag, { message: "caution must be below flag" }),
    signals: z.array(SignalRuleSchema).min(1),
  })
  .strict()
  .refine(
    (f) => new Set(f.signals.map((s) => s.id)).size === f.signals.length,
    { message: "duplicate signal ids" },
  )
  .refine(
    (f) => Math.abs(f.signals.reduce((sum, signal) => sum + signal.weight, 0) - 1) <= 0.001,
    { message: "signal weights must sum to 1" },
  );
export type SignalsFile = z.infer<typeof SignalsFileSchema>;

// ---------------------------------------------------------------------------
// Tune Up reports. A score without a citation to a specific observed moment
// is rejected here — evidence is not optional.
// ---------------------------------------------------------------------------

export const EvidenceSchema = z
  .object({
    step: z.number().int().min(1),
    screenshot: z.string().min(1),
    observation: z.string().min(1),
  })
  .strict();

export const StageResultSchema = z
  .object({
    stage: StageEnum,
    score: StageScore,
    reasoning: z.string().min(1),
    evidence: z.array(EvidenceSchema).min(1),
  })
  .strict();
export type StageResult = z.infer<typeof StageResultSchema>;

export const TuneupRunSchema = z
  .object({
    runId: z.string().min(1),
    startedAt: DateTimeString,
    completedAt: DateTimeString,
    stages: z.array(StageResultSchema).min(1),
  })
  .strict();
export type TuneupRun = z.infer<typeof TuneupRunSchema>;

export const TuneupReportSchema = z
  .object({
    version: z.literal(1),
    app: z.object({ name: z.string().min(1), url: z.string().url() }).strict(),
    model: z.string().min(1),
    runs: z.array(TuneupRunSchema).min(1),
    humanReview: z
      .object({
        reviewed: z.boolean(),
        reviewer: z.string().optional(),
        notes: z.string().optional(),
      })
      .strict()
      .refine((h) => !h.reviewed || h.reviewer !== undefined, {
        message: "a reviewed report must name its reviewer",
      }),
  })
  .strict();
export type TuneupReport = z.infer<typeof TuneupReportSchema>;
