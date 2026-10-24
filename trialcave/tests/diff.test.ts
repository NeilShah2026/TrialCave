import { describe, expect, it } from "vitest";

import { diffMatches, movedUp, type MatchSnapshot } from "@/lib/matching/diff";
import { evaluateCriteria } from "@/lib/matching/evaluate";
import { scoreTrial } from "@/lib/matching/score";
import { personaFactMap, studyCriteria, hba1cFact } from "./helpers";

function snapshot(email: string, title: string, extra = [] as ReturnType<typeof hba1cFact>[]): MatchSnapshot {
  const facts = personaFactMap(email, extra);
  const results = evaluateCriteria(studyCriteria(title), facts);
  const s = scoreTrial(results);
  return { status: s.status, score: s.score, details: results };
}

describe("diffMatches", () => {
  it("Maria seed → after document: exactly one COMPASS-T2D change ineligible→strong", () => {
    const before = new Map([["COMPASS-T2D", snapshot("maria@example.com", "COMPASS-T2D")]]);
    const after = new Map([["COMPASS-T2D", snapshot("maria@example.com", "COMPASS-T2D", [hba1cFact(8.4)])]]);
    const changes = diffMatches(before, after);
    expect(changes).toHaveLength(1);
    expect(changes[0].fromStatus).toBe("ineligible");
    expect(changes[0].toStatus).toBe("strong");
    // The HbA1c criterion flipped fail → pass.
    const hba1c = changes[0].changedCriteria.find((c) => c.plainText.includes("HbA1c"));
    expect(hba1c?.from).toBe("fail");
    expect(hba1c?.to).toBe("pass");
  });

  it("records appeared and disappeared trials", () => {
    const before = new Map<string, MatchSnapshot>([["T1", { status: "possible", score: 0.5, details: [] }]]);
    const after = new Map<string, MatchSnapshot>([["T2", { status: "strong", score: 0.9, details: [] }]]);
    const changes = diffMatches(before, after);
    const appeared = changes.find((c) => c.trialId === "T2");
    const gone = changes.find((c) => c.trialId === "T1");
    expect(appeared?.fromStatus).toBeNull();
    expect(gone?.toStatus).toBeNull();
  });

  it("ignores score-only changes within the same status", () => {
    const before = new Map<string, MatchSnapshot>([["T1", { status: "possible", score: 0.5, details: [] }]]);
    const after = new Map<string, MatchSnapshot>([["T1", { status: "possible", score: 0.7, details: [] }]]);
    expect(diffMatches(before, after)).toHaveLength(0);
  });
});

describe("movedUp", () => {
  it("detects improvement", () => {
    expect(movedUp("ineligible", "strong")).toBe(true);
    expect(movedUp("possible", "strong")).toBe(true);
    expect(movedUp("strong", "possible")).toBe(false);
    expect(movedUp(null, "strong")).toBe(true);
  });
});
