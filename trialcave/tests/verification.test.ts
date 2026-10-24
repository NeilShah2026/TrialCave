import { describe, expect, it } from "vitest";

import { verificationTier, isPayable, isPayableSource } from "@/lib/verification";

describe("verification tiers (anti-fraud)", () => {
  it("device/portal/imaging/lab/demo → verified", () => {
    for (const s of ["wearable", "portal", "imaging", "lab", "demo"] as const) {
      expect(verificationTier(s)).toBe("verified");
      expect(isPayable(verificationTier(s))).toBe(true);
    }
  });

  it("document → document_backed (payable)", () => {
    expect(verificationTier("document")).toBe("document_backed");
    expect(isPayable("document_backed")).toBe(true);
  });

  it("self_report → self_reported and is NOT payable", () => {
    expect(verificationTier("self_report")).toBe("self_reported");
    expect(isPayable("self_reported")).toBe(false);
    expect(isPayableSource("self_report")).toBe(false);
  });

  it("payable sources exclude self_report", () => {
    expect(isPayableSource("wearable")).toBe(true);
    expect(isPayableSource("document")).toBe(true);
    expect(isPayableSource("self_report")).toBe(false);
  });
});
