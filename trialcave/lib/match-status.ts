import type { MatchStatus, CriterionStatus } from "@/lib/matching/types";

export const STATUS_LABEL: Record<MatchStatus, string> = {
  strong: "Strong match",
  possible: "Possible match",
  needs_info: "Needs more info",
  ineligible: "Not eligible",
};

export const STATUS_VARIANT: Record<MatchStatus, "success" | "warning" | "secondary" | "danger"> = {
  strong: "success",
  possible: "warning",
  needs_info: "secondary",
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
