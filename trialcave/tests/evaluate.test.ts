import { describe, expect, it } from "vitest";

import { evaluateCriterion, type Answer } from "@/lib/matching/evaluate";
import type { EvalCriterion } from "@/lib/matching/types";
import type { FactMap } from "@/lib/matching/facts";

function fact(value: number | boolean | string, unit: string | null = null): FactMap[string] {
  return { value, unit, evidence: { factId: "f1", source: "lab", observedAt: null, documentId: null, documentLabel: null } };
}

function crit(partial: Partial<EvalCriterion>): EvalCriterion {
  return {
    id: partial.id ?? "c1",
    kind: partial.kind ?? "inclusion",
    plainText: partial.plainText ?? "criterion",
    category: partial.category ?? "lab",
    field: partial.field ?? null,
    operator: partial.operator ?? null,
    valueMin: partial.valueMin ?? null,
    valueMax: partial.valueMax ?? null,
    valueText: partial.valueText ?? null,
    unit: partial.unit ?? null,
    machineCheckable: partial.machineCheckable ?? (partial.field != null && partial.operator != null),
    patientQuestion: partial.patientQuestion ?? null,
  };
}

const noAnswers = new Map<string, Answer>();

describe("operators", () => {
  it("gte", () => {
    const c = crit({ field: "hba1c_pct", operator: "gte", valueMin: 7 });
    expect(evaluateCriterion(c, { hba1c_pct: fact(7) }, noAnswers).status).toBe("pass");
    expect(evaluateCriterion(c, { hba1c_pct: fact(6.9) }, noAnswers).status).toBe("fail");
  });
  it("lte", () => {
    const c = crit({ field: "egfr", operator: "lte", valueMax: 45 });
    expect(evaluateCriterion(c, { egfr: fact(45) }, noAnswers).status).toBe("pass");
    expect(evaluateCriterion(c, { egfr: fact(46) }, noAnswers).status).toBe("fail");
  });
  it("between inclusive edges", () => {
    const c = crit({ field: "hba1c_pct", operator: "between", valueMin: 7, valueMax: 10.5 });
    expect(evaluateCriterion(c, { hba1c_pct: fact(7) }, noAnswers).status).toBe("pass");
    expect(evaluateCriterion(c, { hba1c_pct: fact(10.5) }, noAnswers).status).toBe("pass");
    expect(evaluateCriterion(c, { hba1c_pct: fact(10.6) }, noAnswers).status).toBe("fail");
    expect(evaluateCriterion(c, { hba1c_pct: fact(6.9) }, noAnswers).status).toBe("fail");
  });
  it("present / absent", () => {
    const present = crit({ field: "med:metformin", operator: "present" });
    expect(evaluateCriterion(present, { "med:metformin": fact(true) }, noAnswers).status).toBe("pass");
    expect(evaluateCriterion(present, { "med:metformin": fact(false) }, noAnswers).status).toBe("fail");
    const absent = crit({ field: "med:insulin", operator: "absent" });
    expect(evaluateCriterion(absent, { "med:insulin": fact(false) }, noAnswers).status).toBe("pass");
  });
  it("missing fact → unknown", () => {
    const c = crit({ field: "hba1c_pct", operator: "gte", valueMin: 7 });
    expect(evaluateCriterion(c, {}, noAnswers).status).toBe("unknown");
  });
});

describe("inclusion/exclusion flip", () => {
  it("exclusion: condition holds → fail (excluded)", () => {
    const c = crit({ kind: "exclusion", field: "med:insulin", operator: "present" });
    expect(evaluateCriterion(c, { "med:insulin": fact(true) }, noAnswers).status).toBe("fail");
    expect(evaluateCriterion(c, { "med:insulin": fact(false) }, noAnswers).status).toBe("pass");
  });
});

describe("logistics and answers", () => {
  it("logistics → na", () => {
    const c = crit({ category: "logistics", kind: "inclusion" });
    expect(evaluateCriterion(c, {}, noAnswers).status).toBe("na");
  });
  it("answer resolves non-machine criteria", () => {
    const c = crit({ kind: "inclusion", field: null, operator: null, patientQuestion: "Q?" });
    const yes = new Map<string, Answer>([[c.id, "yes"]]);
    expect(evaluateCriterion(c, {}, yes).status).toBe("pass");
    const no = new Map<string, Answer>([[c.id, "no"]]);
    expect(evaluateCriterion(c, {}, no).status).toBe("fail");
  });
});
