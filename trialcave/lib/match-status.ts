import type { MatchStatus, CriterionStatus } from "@/lib/matching/types";

export const STATUS_LABEL: Record<MatchStatus, string> = {
  strong: "Strong match",
  possible: "Possible match",
  needs_info: "Needs more info",
  ineligible: "Not eligible",
};

/** Design v3 pill colors: fit = sage, possible = teal, unknown = amber, not a fit = coral. */
export const STATUS_VARIANT: Record<MatchStatus, "success" | "teal" | "warning" | "danger"> = {
  strong: "success",
  possible: "teal",
  needs_info: "warning",
  ineligible: "danger",
};

export const CRITERION_ICON: Record<CriterionStatus, string> = {
  pass: "✅",
  fail: "❌",
  unknown: "❓",
  na: "➖",
};

export function scorePct(score: number): number {
  return Math.round(score * 100);
}
