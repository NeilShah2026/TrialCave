import { describe, expect, it } from "vitest";

import { getMissingInfo, type MatchRowForMissing } from "@/lib/matching/missingInfo";
import { evaluateCriteria } from "@/lib/matching/evaluate";
import { scoreTrial } from "@/lib/matching/score";
import { personaFactMap, studyCriteria, hba1cFact } from "./helpers";

describe("getMissingInfo", () => {
  it("Maria after document lists heart-attack (event:mi_6mo) among missing items", () => {
    const facts = personaFactMap("maria@example.com", [hba1cFact(8.4)]);
    const results = evaluateCriteria(studyCriteria("COMPASS-T2D"), facts);
    const row: MatchRowForMissing = { status: scoreTrial(results).status, details: results };
    const missing = getMissingInfo([row]);
    const mi = missing.find((m) => m.field === "event:mi_6mo");
    expect(mi).toBeDefined();
    expect(mi?.action).toBe("question");
    expect(mi?.question).toBeTruthy();
  });

  it("only includes strong/possible/needs_info trials, not ineligible", () => {
    const ineligible: MatchRowForMissing = {
      status: "ineligible",
      details: [
        {
          criterionId: "x", kind: "inclusion", plainText: "t", status: "unknown",
          reason: "", source: "none", field: "egfr", evidence: null, patientValue: null,
          patientQuestion: null, category: "lab", missingItem: "eGFR",
        },
      ],
    };
    expect(getMissingInfo([ineligible])).toHaveLength(0);
  });
});
