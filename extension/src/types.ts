export type Strictness = "label" | "dim" | "hide";

export interface Settings {
  strictness: Strictness;
  deepScan: boolean;
}

export const DEFAULT_SETTINGS: Settings = { strictness: "label", deepScan: false };

export interface AppraiseRequest {
  type: "appraise";
  url: string;
  title: string;
}

export interface AppraiseResponse {
  kind:
    | "trusted" // on the user's personal trust list — beats everything
    | "blocked" // on the user's personal block list — beats everything
    | "verified" // passed a Tune Up; wears the laurel
    | "pending" // on the register, Tune Up queued
    | "resubmitted" // fixed after failing; queued for another Tune Up
    | "failed" // failed its Tune Up
    | "flag" // heuristics: matches the untested-app signature
    | "caution" // heuristics: some signals
    | "clear" // heuristics: looks fine
    | "unknown"; // couldn't appraise
  domain: string;
  score?: number;
  hits?: { id: string; description: string }[];
}
