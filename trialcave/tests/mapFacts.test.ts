import { describe, expect, it } from "vitest";

import { mapFacts, type CurrentFactSnapshot } from "@/lib/ingest/mapFacts";
import { convertToCanonical } from "@/lib/ingest/units";
import { medFieldsFor } from "@/lib/ingest/medClasses";
import { dxFieldFor } from "@/lib/ingest/dxCodes";
import type { ExtractedFact } from "@/lib/ingest/types";

function ex(partial: Partial<ExtractedFact>): ExtractedFact {
  return {
    kind: partial.kind ?? "lab",
    name: partial.name ?? "",
    icd10: partial.icd10 ?? null,
    value: partial.value ?? null,
    valueText: partial.valueText ?? null,
    unit: partial.unit ?? null,
    negated: partial.negated ?? false,
    status: partial.status ?? "active",
    date: partial.date ?? null,
    sourceQuote: partial.sourceQuote ?? "quote",
  };
}

describe("units", () => {
  it("HbA1c % passthrough and mmol/mol conversion", () => {
    expect(convertToCanonical("hba1c_pct", 8.4, "%")).toEqual({ value: 8.4, unit: "%" });
    const conv = convertToCanonical("hba1c_pct", 64, "mmol/mol")!;
    expect(conv.value).toBeCloseTo(8.0, 1);
  });
  it("glucose mmol/L → mg/dL", () => {
    expect(convertToCanonical("fasting_glucose_mgdl", 7, "mmol/L")!.value).toBeCloseTo(126, 0);
  });
  it("weight lb → kg", () => {
    expect(convertToCanonical("weight_kg", 200, "lb")!.value).toBeCloseTo(90.7, 1);
  });
  it("unknown unit → null", () => {
    expect(convertToCanonical("hba1c_pct", 8, "mg/dL")).toBeNull();
  });
});

describe("medClasses", () => {
  it("combination pills map to every class", () => {
    expect(medFieldsFor("Janumet 50/1000").sort()).toEqual(["med:dpp4", "med:metformin"]);
    expect(medFieldsFor("Synjardy").sort()).toEqual(["med:metformin", "med:sglt2"]);
  });
  it("brand and generic names", () => {
    expect(medFieldsFor("Ozempic 1mg")).toEqual(["med:glp1"]);
    expect(medFieldsFor("atorvastatin 20mg")).toEqual(["med:statin"]);
  });
});

describe("dxCodes", () => {
  it("ICD-10 prefix match", () => {
    expect(dxFieldFor("E11.9", "", null)?.field).toBe("dx:type2_diabetes");
  });
  it("event within/outside 6-month window", () => {
    const today = new Date("2026-10-24");
    const recent = dxFieldFor("I21", "heart attack", "2026-08-01", today)!;
    expect(recent.field).toBe("event:mi_6mo");
    expect(recent.withinWindow).toBe(true);
    const old = dxFieldFor("I21", "heart attack", "2025-01-01", today)!;
    expect(old.withinWindow).toBe(false);
  });
});

describe("mapFacts", () => {
  const noCurrent: CurrentFactSnapshot[] = [];

  it("maps a diabetes diagnosis and a lab", () => {
    const facts = mapFacts(
      [ex({ kind: "diagnosis", name: "Type 2 diabetes", icd10: "E11.9" }), ex({ kind: "lab", name: "Hemoglobin A1c", value: 8.4, unit: "%" })],
      "2026-10-20",
      noCurrent,
    );
    expect(facts.find((f) => f.field === "dx:type2_diabetes")?.valueBool).toBe(true);
    expect(facts.find((f) => f.field === "hba1c_pct")?.valueNum).toBe(8.4);
  });

  it("negation sets false", () => {
    const facts = mapFacts([ex({ kind: "diagnosis", name: "Type 1 diabetes", icd10: "E10.9", negated: true })], "2026-10-20", noCurrent);
    expect(facts.find((f) => f.field === "dx:type1_diabetes")?.valueBool).toBe(false);
  });

  it("drops germline genetic results entirely", () => {
    const facts = mapFacts([ex({ kind: "lab", name: "BRCA1 mutation", valueText: "positive" })], "2026-10-20", noCurrent);
    expect(facts).toHaveLength(0);
  });

  it("out-of-range value becomes display-only with a warning", () => {
    const facts = mapFacts([ex({ kind: "lab", name: "HbA1c", value: 40, unit: "%" })], "2026-10-20", noCurrent);
    expect(facts[0].field).toBeNull();
    expect(facts[0].warning).toContain("couldn't read");
  });

  it("cancer is never auto-mapped (display-only)", () => {
    const facts = mapFacts([ex({ kind: "diagnosis", name: "Breast cancer", icd10: "C50.9" })], "2026-10-20", noCurrent);
    expect(facts[0].field).toBeNull();
  });

  it("stopped medication is display-only", () => {
    const facts = mapFacts([ex({ kind: "medication", name: "metformin", status: "stopped" })], "2026-10-20", noCurrent);
    expect(facts[0].field).toBeNull();
  });

  it("comparison: update vs same vs older", () => {
    const current: CurrentFactSnapshot[] = [{ field: "hba1c_pct", valueNum: 6.8, valueBool: null, observedAt: "2026-02-01" }];
    const upd = mapFacts([ex({ kind: "lab", name: "HbA1c", value: 8.4, unit: "%", date: "2026-10-20" })], null, current);
    expect(upd[0].comparison).toBe("update");
    const same = mapFacts([ex({ kind: "lab", name: "HbA1c", value: 6.8, unit: "%", date: "2026-10-20" })], null, current);
    expect(same[0].comparison).toBe("same");
    const older = mapFacts([ex({ kind: "lab", name: "HbA1c", value: 7.2, unit: "%", date: "2025-01-01" })], null, current);
    expect(older[0].comparison).toBe("older");
  });
});
