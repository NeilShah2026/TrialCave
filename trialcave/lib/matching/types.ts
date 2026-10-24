import type { Evidence } from "@/lib/matching/facts";

export type CriterionStatus = "pass" | "fail" | "unknown" | "na";
export type MatchStatus = "strong" | "possible" | "needs_info" | "ineligible";

export type CriterionKind = "inclusion" | "exclusion";
export type CriterionOperator =
  | "gte"
  | "lte"
  | "between"
  | "eq"
  | "present"
  | "absent";

/** A trial criterion as stored (B7.2 trial_criteria). */
export interface EvalCriterion {
  id: string;
  kind: CriterionKind;
  plainText: string;
  category: string;
  field: string | null;
  operator: CriterionOperator | null;
  valueMin: number | null;
  valueMax: number | null;
  valueText: string | null;
  unit: string | null;
  machineCheckable: boolean;
  patientQuestion: string | null;
}

export interface CriterionResult {
  criterionId: string;
  kind: CriterionKind;
  plainText: string;
  status: CriterionStatus;
  reason: string;
  source: "data" | "answer" | "ai" | "none";
  field: string | null;
  evidence: Evidence | null;
  /** Display string for the patient's own view, e.g. "8.4%". */
  patientValue: string | null;
  /** Carried through for question UI and missing-info grouping. */
  patientQuestion: string | null;
  category: string;
  /** For unknown criteria: what's missing, e.g. "Most recent A1C". */
  missingItem: string | null;
}
