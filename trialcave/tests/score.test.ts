import { describe, expect, it } from "vitest";

import { scoreTrial, compareMatches } from "@/lib/matching/score";
import type { CriterionResult, CriterionStatus } from "@/lib/matching/types";

function r(status: CriterionStatus, field: string | null = null): CriterionResult {
  return {
    criterionId: Math.random().toString(36),
    kind: "inclusion",
    plainText: "t",
    status,
    reason: "",
    source: "data",
    field,
    evidence: null,
    patientValue: null,
    patientQuestion: null,
    category: "lab",
    missingItem: null,
  };
}

describe("scoreTrial", () => {
  it("any fail → ineligible", () => {
    const s = scoreTrial([r("pass"), r("fail"), r("unknown")]);
    expect(s.status).toBe("ineligible");
    expect(s.score).toBeCloseTo(1 / 3, 5);
  });
  it("all pass → strong, score 1", () => {
    const s = scoreTrial([r("pass"), r("pass")]);
    expect(s.status).toBe("strong");
    expect(s.score).toBe(1);
  });
  it("na is ignored in counts", () => {
    const s = scoreTrial([r("pass"), r("na"), r("na")]);
    expect(s.status).toBe("strong");
    expect(s.score).toBe(1);
  });
  it("pass/unknown thresholds", () => {
    // 4 pass, 1 unknown → 0.8 strong
    expect(scoreTrial([r("pass"), r("pass"), r("pass"), r("pass"), r("unknown")]).status).toBe("strong");
    // 1 pass, 1 unknown → 0.5 possible
    expect(scoreTrial([r("pass"), r("unknown")]).status).toBe("possible");
    // 1 pass, 3 unknown → 0.25 needs_info
    expect(scoreTrial([r("pass"), r("unknown"), r("unknown"), r("unknown")]).status).toBe("needs_info");
  });
  it("no scorable criteria → needs_info score 0", () => {
    const s = scoreTrial([r("na")]);
    expect(s.status).toBe("needs_info");
    expect(s.score).toBe(0);
  });
});

describe("compareMatches", () => {
  it("orders by status, then score, then unknowns, then distance", () => {
    const strong = { status: "strong" as const, score: 0.9, unknownCount: 0, distanceMiles: 10 };
    const possible = { status: "possible" as const, score: 0.6, unknownCount: 1, distanceMiles: 5 };
    expect(compareMatches(strong, possible)).toBeLessThan(0);

    const a = { status: "strong" as const, score: 0.9, unknownCount: 0, distanceMiles: 20 };
    const b = { status: "strong" as const, score: 0.9, unknownCount: 0, distanceMiles: 5 };
    expect(compareMatches(a, b)).toBeGreaterThan(0); // b (closer) first
  });
});
