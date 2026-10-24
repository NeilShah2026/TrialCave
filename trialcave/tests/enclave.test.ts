import { describe, expect, it } from "vitest";

import { runAnalysis, type DonorRow } from "@/lib/enclave/analyses";

function donor(p: Partial<DonorRow>): DonorRow {
  return {
    age: p.age ?? null,
    hba1c: p.hba1c ?? null,
    avgDailySteps: p.avgDailySteps ?? null,
    cgmTimeInRange: p.cgmTimeInRange ?? null,
    diabetesDurationYears: p.diabetesDurationYears ?? null,
    hasRetinopathy: p.hasRetinopathy ?? null,
    vulnerability: p.vulnerability ?? null,
  };
}

describe("runAnalysis — suppression", () => {
  it("suppresses groups under 10 and computes means for groups of 10+", () => {
    // 12 donors in the 6.5–7.9 band, 3 in ≥8.0.
    const donors: DonorRow[] = [
      ...Array.from({ length: 12 }, () => donor({ hba1c: 7.0, avgDailySteps: 6000 })),
      ...Array.from({ length: 3 }, () => donor({ hba1c: 9.0, avgDailySteps: 5000 })),
    ];
    const res = runAnalysis("steps_by_hba1c", donors);
    const band65 = res.rows.find((r) => r.band === "6.5–7.9")!;
    const band80 = res.rows.find((r) => r.band === "≥ 8.0")!;
    expect(band65.n).toBe(12);
    expect(band65.value).toBe(6000);
    expect(band65.suppressed).toBe(false);
    // The exact size of a hidden group is never revealed.
    expect(band80.n).toBeNull();
    expect(band80.value).toBeNull(); // suppressed
    expect(band80.suppressed).toBe(true);
    expect(res.suppressedCells).toBe(1);
  });

  it("retinopathy_by_duration returns a percentage", () => {
    // 10 donors in 10–14 band, 4 with retinopathy = 40%.
    const donors: DonorRow[] = Array.from({ length: 10 }, (_, i) =>
      donor({ diabetesDurationYears: 12, hasRetinopathy: i < 4 }),
    );
    const res = runAnalysis("retinopathy_by_duration", donors);
    const band = res.rows.find((r) => r.band === "10–14")!;
    expect(band.n).toBe(10);
    expect(band.value).toBe(40);
  });

  it("hba1c_by_vulnerability groups by community band", () => {
    const donors: DonorRow[] = [
      ...Array.from({ length: 10 }, () => donor({ hba1c: 8.0, vulnerability: "very_high" })),
      ...Array.from({ length: 10 }, () => donor({ hba1c: 6.5, vulnerability: "low" })),
    ];
    const res = runAnalysis("hba1c_by_vulnerability", donors);
    expect(res.rows.find((r) => r.band === "Very high")!.value).toBe(8.0);
    expect(res.rows.find((r) => r.band === "Lower")!.value).toBe(6.5);
  });

  it("empty bands are not counted as suppressed", () => {
    const donors: DonorRow[] = Array.from({ length: 10 }, () => donor({ age: 55, hba1c: 7 }));
    const res = runAnalysis("hba1c_by_age", donors);
    // Only the 50–59 band has data; others are empty (n=0, not suppressed).
    expect(res.suppressedCells).toBe(0);
    expect(res.rows.find((r) => r.band === "50–59")!.value).toBe(7);
  });
});

describe("runAnalysisWithContributors — payouts", () => {
  it("only counts donors in shown groups as contributors", async () => {
    const { runAnalysisWithContributors } = await import("@/lib/enclave/analyses");
    const donors: DonorRow[] = [
      ...Array.from({ length: 10 }, () => donor({ hba1c: 7.0, avgDailySteps: 6000 })),
      ...Array.from({ length: 2 }, () => donor({ hba1c: 9.0, avgDailySteps: 5000 })),
      donor({ hba1c: 7.0 }), // no steps: not used
    ];
    const { result, contributors } = runAnalysisWithContributors("steps_by_hba1c", donors);
    expect(contributors).toHaveLength(10);
    expect(result.donorCount).toBe(10);
    expect(contributors.every((i) => i < 10)).toBe(true);
  });

  it("CSV never contains the size of a hidden group", async () => {
    const { resultToCsv } = await import("@/lib/enclave/analyses");
    const donors: DonorRow[] = Array.from({ length: 3 }, () => donor({ hba1c: 9.0, avgDailySteps: 5000 }));
    const csv = resultToCsv(runAnalysis("steps_by_hba1c", donors));
    expect(csv).toContain('"<10"');
    expect(csv).not.toMatch(/,3,/);
  });
});
