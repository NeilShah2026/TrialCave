/**
 * Evaluate one criterion against a patient's fact map (B9.4). Pure, unit-tested.
 */

import type { FactMap } from "@/lib/matching/facts";
import type {
  CriterionResult,
  CriterionStatus,
  EvalCriterion,
} from "@/lib/matching/types";
import { vocabLabel } from "@/lib/matching/vocabulary";

export type Answer = "yes" | "no" | "unsure";

function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
}

function displayValue(value: number | boolean | string, unit: string | null): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return unit ? `${formatNumber(value)}${unit === "%" ? "%" : ` ${unit}`}` : formatNumber(value);
  return value;
}

/** Lowercase the first letter unless the label starts with an acronym (HbA1c, BMI, LDL). */
function lowerFirst(label: string): string {
  if (/^[A-Z][A-Za-z0-9]*[A-Z0-9]/.test(label.split(" ")[0])) return label;
  return label.charAt(0).toLowerCase() + label.slice(1);
}

/** Where a value came from, in plain words, or "" for derived values. */
function sourcePhrase(documentLabel: string | null, source: string): string {
  if (documentLabel) return `from your ${documentLabel}`;
  if (source === "self_report") return "from your answer";
  if (source === "lab") return "from a lab entry";
  if (source === "wearable") return "from your device";
  if (source === "portal") return "from your patient portal";
  return "";
}

/** Can this value be compared with this operator at all? */
function typeCompatible(c: EvalCriterion, value: number | boolean | string): boolean {
  switch (c.operator) {
    case "gte":
    case "lte":
    case "between":
      return typeof value === "number";
    case "present":
    case "absent":
      return typeof value === "boolean";
    case "eq":
      return c.valueText !== null ? typeof value === "string" : typeof value === "number";
    default:
      return false;
  }
}

/** One plain-language sentence explaining the result (B9.4). */
function explain(
  c: EvalCriterion,
  label: string,
  value: number | boolean | string,
  disp: string,
  src: string,
  status: CriterionStatus,
): string {
  const from = src ? ` (${src})` : "";
  if (typeof value === "boolean") {
    const has = value;
    const subject = lowerFirst(label);
    if (c.kind === "inclusion") {
      if (status === "pass") return has ? `Your profile shows ${subject}${from}.` : `Your profile shows no ${subject}${from}.`;
      return has ? `Your profile shows ${subject}${from}, which this study doesn't want.` : `Your profile doesn't show ${subject}${from}, which this study requires.`;
    }
    return status === "fail"
      ? `Your profile shows ${subject}${from}, which rules you out of this study.`
      : `Your profile shows no ${subject}${from}, so this doesn't apply to you.`;
  }
  const what = `Your ${lowerFirst(label)} is ${disp}${from}`;
  const range = rangeText(c);
  if (c.kind === "inclusion") {
    return status === "pass" ? `${what}. The study needs ${range}, so you meet this.` : `${what}. The study needs ${range}.`;
  }
  return status === "fail" ? `${what}. The study excludes ${range}.` : `${what}, so this doesn't apply to you.`;
}

/** Evaluate the machine-checkable condition; returns whether the condition holds. */
function conditionHolds(c: EvalCriterion, value: number | boolean | string): boolean {
  switch (c.operator) {
    case "gte":
      return typeof value === "number" && c.valueMin !== null && value >= c.valueMin;
    case "lte":
      return typeof value === "number" && c.valueMax !== null && value <= c.valueMax;
    case "between":
      return (
        typeof value === "number" &&
        c.valueMin !== null &&
        c.valueMax !== null &&
        value >= c.valueMin &&
        value <= c.valueMax
      );
    case "eq":
      if (c.valueText !== null && typeof value === "string")
        return value.toLowerCase() === c.valueText.toLowerCase();
      if (c.valueMin !== null && typeof value === "number") return value === c.valueMin;
      return false;
    case "present":
      return value === true;
    case "absent":
      return value === false;
    default:
      return false;
  }
}

function rangeText(c: EvalCriterion): string {
  const u = c.unit ? (c.unit === "%" ? "%" : ` ${c.unit}`) : "";
  switch (c.operator) {
    case "gte":
      return `${c.valueMin}${u} or higher`;
    case "lte":
      return `${c.valueMax}${u} or lower`;
    case "between":
      return `${c.valueMin}–${c.valueMax}${u}`;
    case "eq":
      return `${c.valueText ?? c.valueMin}${u}`;
    default:
      return "";
  }
}

export function evaluateCriterion(
  c: EvalCriterion,
  facts: FactMap,
  answers: Map<string, Answer> = new Map(),
  cachedAi?: CriterionResult,
): CriterionResult {
  const base = {
    criterionId: c.id,
    kind: c.kind,
    plainText: c.plainText,
    field: c.field,
    patientQuestion: c.patientQuestion,
    category: c.category,
  };

  // Rule 1: logistics → na.
  if (c.category === "logistics") {
    return {
      ...base,
      status: "na" as CriterionStatus,
      reason: "The study team will confirm this.",
      source: "none",
      evidence: null,
      patientValue: null,
      missingItem: null,
    };
  }

  // Rule 2: machine-checkable.
  if (c.machineCheckable && c.field && c.operator) {
    let fact = facts[c.field];
    const label = vocabLabel(c.field);

    // If there's no fact but the patient answered this criterion's question,
    // treat the answer as the fact value (B9.2: answering a vocabulary-field
    // question writes a self-report fact; the UI re-scores immediately via the
    // answer map before that round-trips).
    if (!fact && (c.operator === "present" || c.operator === "absent")) {
      const answer = answers.get(c.id);
      if (answer === "yes" || answer === "no") {
        fact = {
          value: answer === "yes",
          unit: null,
          evidence: { factId: null, source: "self_report", observedAt: null, documentId: null, documentLabel: null },
        };
      }
    }

    if (!fact) {
      return {
        ...base,
        status: "unknown",
        reason: `We don't have your ${lowerFirst(label)} yet.`,
        source: "none",
        evidence: null,
        patientValue: null,
        missingItem: label,
      };
    }

    // A value of the wrong type (e.g. text where a number is expected) can't
    // be compared. That's unknown, never a pass or a fail.
    if (!typeCompatible(c, fact.value)) {
      return {
        ...base,
        status: "unknown",
        reason: `We couldn't compare your ${lowerFirst(label)} with this requirement. The study team can check it.`,
        source: "none",
        evidence: fact.evidence,
        patientValue: null,
        missingItem: label,
      };
    }

    const holds = conditionHolds(c, fact.value);
    // Inclusion: holds -> pass. Exclusion: holds -> fail (excluded).
    const status: CriterionStatus =
      c.kind === "inclusion" ? (holds ? "pass" : "fail") : holds ? "fail" : "pass";

    const value = fact.value;
    const disp = displayValue(value, fact.unit);
    const src = sourcePhrase(fact.evidence.documentLabel, fact.evidence.source);
    const reason = explain(c, label, value, disp, src, status);

    return {
      ...base,
      status,
      reason,
      source: "data",
      evidence: fact.evidence,
      patientValue: disp,
      missingItem: null,
    };
  }

  // Rule 3: not machine-checkable.
  const answer = answers.get(c.id);
  if (answer) {
    let status: CriterionStatus;
    if (answer === "unsure") status = "unknown";
    else if (c.kind === "inclusion") status = answer === "yes" ? "pass" : "fail";
    else status = answer === "yes" ? "fail" : "pass";
    return {
      ...base,
      status,
      reason:
        status === "unknown"
          ? "You weren't sure about this."
          : `Based on your answer${c.kind === "exclusion" && status === "pass" ? ", this doesn't apply to you" : ""}.`,
      source: "answer",
      evidence: null,
      patientValue: null,
      missingItem: status === "unknown" ? c.plainText : null,
    };
  }

  // Cached AI result, if any.
  if (cachedAi && cachedAi.source === "ai") {
    return { ...cachedAi, criterionId: c.id };
  }

  // Default unknown.
  return {
    ...base,
    status: "unknown",
    reason: "We don't have enough information yet.",
    source: "none",
    evidence: null,
    patientValue: null,
    missingItem: c.patientQuestion ? c.plainText : c.plainText,
  };
}

/** Evaluate all criteria for a trial. */
export function evaluateCriteria(
  criteria: EvalCriterion[],
  facts: FactMap,
  answers: Map<string, Answer> = new Map(),
  cachedAi?: Map<string, CriterionResult>,
): CriterionResult[] {
  return criteria.map((c) => evaluateCriterion(c, facts, answers, cachedAi?.get(c.id)));
}
