import { describe, expect, it } from "vitest";

import { prefilterTrial, type PrefilterPatient, type PrefilterTrial } from "@/lib/matching/prefilter";
import type { TrialLocation } from "@/lib/ctgov/normalize";

const quincy: PrefilterPatient = { ageYears: 54, sex: "female", lat: 42.2529, lon: -71.0023, travelRadiusMiles: 30 };
const bostonSite: TrialLocation = { facility: "X", city: "Boston", state: "Massachusetts", zip: null, country: "US", status: "RECRUITING", lat: 42.3601, lon: -71.0589 };

function trial(p: Partial<PrefilterTrial>): PrefilterTrial {
  return {
    source: p.source ?? "clinic",
    overallStatus: p.overallStatus ?? "RECRUITING",
    studyStatus: p.studyStatus ?? "active",
    minAgeYears: p.minAgeYears ?? null,
    maxAgeYears: p.maxAgeYears ?? null,
    sex: p.sex ?? "ALL",
    locations: p.locations ?? [bostonSite],
  };
}

describe("prefilterTrial", () => {
  it("keeps a nearby in-age trial and computes distance", () => {
    const res = prefilterTrial(quincy, trial({ minAgeYears: 18, maxAgeYears: 75 }));
    expect(res.keep).toBe(true);
    expect(res.distanceMiles).toBeGreaterThan(0);
    expect(res.distanceMiles).toBeLessThan(15);
  });
  it("drops out-of-age", () => {
    expect(prefilterTrial(quincy, trial({ minAgeYears: 65 })).keep).toBe(false);
    expect(prefilterTrial(quincy, trial({ maxAgeYears: 40 })).keep).toBe(false);
  });
  it("drops sex mismatch", () => {
    expect(prefilterTrial(quincy, trial({ sex: "MALE" })).keep).toBe(false);
    expect(prefilterTrial(quincy, trial({ sex: "FEMALE" })).keep).toBe(true);
  });
  it("drops non-recruiting ctgov and inactive clinic studies", () => {
    expect(prefilterTrial(quincy, trial({ source: "ctgov", overallStatus: "COMPLETED" })).keep).toBe(false);
    expect(prefilterTrial(quincy, trial({ source: "clinic", studyStatus: "draft" })).keep).toBe(false);
  });
  it("drops sites beyond 2× travel radius", () => {
    const farSite: TrialLocation = { ...bostonSite, lat: 42.1015, lon: -72.5898 }; // Springfield ~80mi
    expect(prefilterTrial(quincy, trial({ locations: [farSite] })).keep).toBe(false);
  });
  it("keeps trials with no coordinates (distance null)", () => {
    const noCoord: TrialLocation = { ...bostonSite, lat: null, lon: null };
    const res = prefilterTrial(quincy, trial({ locations: [noCoord] }));
    expect(res.keep).toBe(true);
    expect(res.distanceMiles).toBeNull();
  });
});
