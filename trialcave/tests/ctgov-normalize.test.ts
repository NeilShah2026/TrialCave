import { describe, expect, it } from "vitest";

import {
  normalizeStudy,
  parseAgeToYears,
  unescapeCriteria,
  categorizeCondition,
} from "@/lib/ctgov/normalize";

describe("parseAgeToYears", () => {
  it("parses year/month/week/day strings", () => {
    expect(parseAgeToYears("18 Years")).toBe(18);
    expect(parseAgeToYears("6 Months")).toBe(0.5);
    expect(parseAgeToYears("52 Weeks")).toBe(1);
    expect(parseAgeToYears("30 Days")).toBeCloseTo(0.08, 2);
  });
  it("returns null for missing or unparseable", () => {
    expect(parseAgeToYears(undefined)).toBeNull();
    expect(parseAgeToYears("N/A")).toBeNull();
  });
});

describe("unescapeCriteria", () => {
  it("unescapes comparison operators", () => {
    expect(unescapeCriteria("HbA1c \\> 7")).toBe("HbA1c > 7");
    expect(unescapeCriteria("eGFR \\< 45")).toBe("eGFR < 45");
    expect(unescapeCriteria("age \\≥ 18")).toBe("age ≥ 18");
  });
});

describe("categorizeCondition", () => {
  it("prefers kidney over diabetes when both appear", () => {
    expect(categorizeCondition(["Diabetic Kidney Disease"], "")).toBe("kidney");
  });
  it("maps common categories", () => {
    expect(categorizeCondition(["Type 2 Diabetes"], "")).toBe("diabetes_metabolic");
    expect(categorizeCondition(["Breast Cancer"], "")).toBe("oncology");
    expect(categorizeCondition(["Heart Failure"], "")).toBe("cardiology");
    expect(categorizeCondition(["Alzheimer Disease"], "")).toBe("neurology");
    expect(categorizeCondition(["Psoriasis"], "")).toBe("other");
  });
});

describe("normalizeStudy", () => {
  const fixture = {
    protocolSection: {
      identificationModule: {
        nctId: "NCT01234567",
        briefTitle: "A Study of Metformin in Type 2 Diabetes",
        officialTitle: "Official long title",
      },
      statusModule: {
        overallStatus: "RECRUITING",
        lastUpdatePostDateStruct: { date: "2026-10-01" },
      },
      descriptionModule: { briefSummary: "A summary." },
      conditionsModule: { conditions: ["Type 2 Diabetes"] },
      designModule: { phases: ["PHASE2"], studyType: "INTERVENTIONAL", enrollmentInfo: { count: 120 } },
      eligibilityModule: {
        eligibilityCriteria: "Inclusion:\n- HbA1c \\> 7.0%",
        sex: "ALL",
        minimumAge: "18 Years",
        maximumAge: "75 Years",
        healthyVolunteers: false,
      },
      sponsorCollaboratorsModule: { leadSponsor: { name: "Some Sponsor" } },
      contactsLocationsModule: {
        locations: [
          { facility: "MGH", city: "Boston", state: "Massachusetts", geoPoint: { lat: 42.36, lon: -71.06 } },
        ],
        centralContacts: [{ name: "Coordinator", role: "CONTACT", phone: "555", email: "a@b.com" }],
      },
    },
  };

  it("normalizes a complete study", () => {
    const t = normalizeStudy(fixture)!;
    expect(t.nctId).toBe("NCT01234567");
    expect(t.minAgeYears).toBe(18);
    expect(t.maxAgeYears).toBe(75);
    expect(t.conditionCategory).toBe("diabetes_metabolic");
    expect(t.eligibilityText).toContain("> 7.0%"); // unescaped
    expect(t.locations[0].lat).toBe(42.36);
  });

  it("does not throw on missing modules", () => {
    expect(() => normalizeStudy({ protocolSection: { identificationModule: { nctId: "NCT9", briefTitle: "X" } } })).not.toThrow();
    const t = normalizeStudy({ protocolSection: { identificationModule: { nctId: "NCT9", briefTitle: "X" } } })!;
    expect(t.minAgeYears).toBeNull();
    expect(t.sex).toBe("ALL");
    expect(t.locations).toEqual([]);
  });

  it("returns null when nctId or title is missing", () => {
    expect(normalizeStudy({ protocolSection: { identificationModule: { briefTitle: "X" } } })).toBeNull();
  });
});
