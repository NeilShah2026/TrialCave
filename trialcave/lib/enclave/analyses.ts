/**
 * Enclave aggregate analyses (B14.5). Pure functions over a donor pool, with
 * small-group suppression (k-anonymity). No analysis uses names, towns,
 * reproductive data, or dates finer than a year. Unit-tested.
 */

import { K_ANONYMITY_MIN } from "@/lib/env";

export type AnalysisKey =
  | "hba1c_by_age"
  | "steps_by_hba1c"
  | "tir_by_hba1c"
  | "retinopathy_by_duration";

/** One donor's analysis-relevant facts (already de-identified, no PII). */
export interface DonorRow {
  age: number | null;
  hba1c: number | null;
  avgDailySteps: number | null;
  cgmTimeInRange: number | null;
  diabetesDurationYears: number | null;
  hasRetinopathy: boolean | null;
}

export interface AnalysisResultRow {
  band: string;
  n: number;
  /** Mean value (or % for retinopathy). Null when suppressed. */
  value: number | null;
  suppressed: boolean;
}

export interface AnalysisResult {
  key: AnalysisKey;
  valueLabel: string;
  rows: AnalysisResultRow[];
  suppressedCells: number;
  donorCount: number;
}

export const ANALYSIS_META: Record<AnalysisKey, { label: string; valueLabel: string; needs: string[] }> = {
  hba1c_by_age: { label: "HbA1c by age band", valueLabel: "Mean HbA1c (%)", needs: ["labs"] },
  steps_by_hba1c: { label: "Daily steps by HbA1c range", valueLabel: "Mean daily steps", needs: ["wearables", "labs"] },
  tir_by_hba1c: { label: "Time in range by HbA1c (CGM users)", valueLabel: "Mean time in range (%)", needs: ["wearables", "labs"] },
  retinopathy_by_duration: { label: "Retinopathy by diabetes duration", valueLabel: "% with retinopathy", needs: ["imaging", "history"] },
};

function ageBand(age: number): string {
  if (age < 40) return "30–39";
  if (age < 50) return "40–49";
  if (age < 60) return "50–59";
  if (age < 70) return "60–69";
  return "70+";
}
const AGE_BANDS = ["30–39", "40–49", "50–59", "60–69", "70+"];

function hba1cBand(h: number): string {
  if (h < 5.7) return "< 5.7";
  if (h < 6.5) return "5.7–6.4";
  if (h < 8.0) return "6.5–7.9";
  return "≥ 8.0";
}
const HBA1C_BANDS = ["< 5.7", "5.7–6.4", "6.5–7.9", "≥ 8.0"];

function durationBand(d: number): string {
  if (d < 5) return "< 5";
  if (d < 10) return "5–9";
  if (d < 15) return "10–14";
  return "15+";
}
const DURATION_BANDS = ["< 5", "5–9", "10–14", "15+"];

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

function buildRows(
  bandOrder: string[],
  grouped: Map<string, number[]>,
  isPercent = false,
): { rows: AnalysisResultRow[]; suppressed: number } {
  let suppressed = 0;
  const rows = bandOrder.map((band) => {
    const values = grouped.get(band) ?? [];
    const n = values.length;
    if (n < K_ANONYMITY_MIN) {
      if (n > 0) suppressed++;
      return { band, n, value: null, suppressed: n > 0 };
    }
    const mean = values.reduce((a, b) => a + b, 0) / n;
    return { band, n, value: isPercent ? round1(mean * 100) : round1(mean), suppressed: false };
  });
  return { rows, suppressed };
}

export function runAnalysis(key: AnalysisKey, donors: DonorRow[]): AnalysisResult {
  const meta = ANALYSIS_META[key];
  let rows: AnalysisResultRow[] = [];
  let suppressed = 0;

  if (key === "hba1c_by_age") {
    const grouped = new Map<string, number[]>();
    for (const d of donors) {
      if (d.age == null || d.hba1c == null) continue;
      const b = ageBand(d.age);
      (grouped.get(b) ?? grouped.set(b, []).get(b)!).push(d.hba1c);
    }
    ({ rows, suppressed } = buildRows(AGE_BANDS, grouped));
  } else if (key === "steps_by_hba1c") {
    const grouped = new Map<string, number[]>();
    for (const d of donors) {
      if (d.hba1c == null || d.avgDailySteps == null) continue;
      const b = hba1cBand(d.hba1c);
      (grouped.get(b) ?? grouped.set(b, []).get(b)!).push(d.avgDailySteps);
    }
    ({ rows, suppressed } = buildRows(HBA1C_BANDS, grouped));
  } else if (key === "tir_by_hba1c") {
    const grouped = new Map<string, number[]>();
    for (const d of donors) {
      if (d.hba1c == null || d.cgmTimeInRange == null) continue;
      const b = hba1cBand(d.hba1c);
      (grouped.get(b) ?? grouped.set(b, []).get(b)!).push(d.cgmTimeInRange);
    }
    ({ rows, suppressed } = buildRows(HBA1C_BANDS, grouped));
  } else {
    // retinopathy_by_duration: % with retinopathy
    const grouped = new Map<string, number[]>();
    for (const d of donors) {
      if (d.diabetesDurationYears == null || d.hasRetinopathy == null) continue;
      const b = durationBand(d.diabetesDurationYears);
      (grouped.get(b) ?? grouped.set(b, []).get(b)!).push(d.hasRetinopathy ? 1 : 0);
    }
    ({ rows, suppressed } = buildRows(DURATION_BANDS, grouped, true));
  }

  const donorCount = donors.length;
  return { key, valueLabel: meta.valueLabel, rows, suppressedCells: suppressed, donorCount };
}
