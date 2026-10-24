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
  | "retinopathy_by_duration"
  | "hba1c_by_vulnerability";

/** One donor's analysis-relevant facts (already de-identified, no PII). */
export interface DonorRow {
  age: number | null;
  hba1c: number | null;
  avgDailySteps: number | null;
  cgmTimeInRange: number | null;
  diabetesDurationYears: number | null;
  hasRetinopathy: boolean | null;
  /** Town-level community vulnerability band (never finer than town). */
  vulnerability: string | null;
}

export interface AnalysisResultRow {
  band: string;
  /** Group size, or null when the group is hidden (never reveal 1–9). */
  n: number | null;
  /** Mean value (or % for retinopathy). Null when suppressed. */
  value: number | null;
  suppressed: boolean;
}

export interface AnalysisResult {
  key: AnalysisKey;
  valueLabel: string;
  rows: AnalysisResultRow[];
  suppressedCells: number;
  /** Donors whose data appears in a shown (non-suppressed) group. */
  donorCount: number;
}

/** DECISION: the floor can be raised by env but never lowered below 10 (B0). */
export const K_MIN = Math.max(10, K_ANONYMITY_MIN);

export const ANALYSIS_META: Record<AnalysisKey, { label: string; valueLabel: string; needs: string[] }> = {
  hba1c_by_age: { label: "HbA1c by age band", valueLabel: "Mean HbA1c (%)", needs: ["labs"] },
  steps_by_hba1c: { label: "Daily steps by HbA1c range", valueLabel: "Mean daily steps", needs: ["wearables", "labs"] },
  tir_by_hba1c: { label: "Time in range by HbA1c (CGM users)", valueLabel: "Mean time in range (%)", needs: ["wearables", "labs"] },
  retinopathy_by_duration: { label: "Retinopathy by diabetes duration", valueLabel: "% with retinopathy", needs: ["imaging", "history"] },
  hba1c_by_vulnerability: { label: "HbA1c by community vulnerability (equity)", valueLabel: "Mean HbA1c (%)", needs: ["labs"] },
};

const VULN_BANDS = ["Lower", "Moderate", "High", "Very high"];
const VULN_LABEL: Record<string, string> = { low: "Lower", moderate: "Moderate", high: "High", very_high: "Very high" };

function ageBand(age: number): string {
  if (age < 30) return "18–29";
  if (age < 40) return "30–39";
  if (age < 50) return "40–49";
  if (age < 60) return "50–59";
  if (age < 70) return "60–69";
  return "70+";
}
const AGE_BANDS = ["18–29", "30–39", "40–49", "50–59", "60–69", "70+"];

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

interface AnalysisSpec {
  bands: string[];
  percent: boolean;
  /** Returns [band, value] for a donor, or null if the donor has no usable data. */
  pick: (d: DonorRow) => [string, number] | null;
}

const SPECS: Record<AnalysisKey, AnalysisSpec> = {
  hba1c_by_age: {
    bands: AGE_BANDS,
    percent: false,
    pick: (d) => (d.age == null || d.hba1c == null ? null : [ageBand(d.age), d.hba1c]),
  },
  hba1c_by_vulnerability: {
    bands: VULN_BANDS,
    percent: false,
    pick: (d) => (d.hba1c == null || !d.vulnerability ? null : [VULN_LABEL[d.vulnerability] ?? d.vulnerability, d.hba1c]),
  },
  steps_by_hba1c: {
    bands: HBA1C_BANDS,
    percent: false,
    pick: (d) => (d.hba1c == null || d.avgDailySteps == null ? null : [hba1cBand(d.hba1c), d.avgDailySteps]),
  },
  tir_by_hba1c: {
    bands: HBA1C_BANDS,
    percent: false,
    pick: (d) => (d.hba1c == null || d.cgmTimeInRange == null ? null : [hba1cBand(d.hba1c), d.cgmTimeInRange]),
  },
  retinopathy_by_duration: {
    bands: DURATION_BANDS,
    percent: true,
    pick: (d) =>
      d.diabetesDurationYears == null || d.hasRetinopathy == null
        ? null
        : [durationBand(d.diabetesDurationYears), d.hasRetinopathy ? 1 : 0],
  },
};

/**
 * Run an analysis. Also returns the indexes of donors whose data landed in a
 * shown group, so payouts go only to Donors whose donation powered the result.
 */
export function runAnalysisWithContributors(
  key: AnalysisKey,
  donors: DonorRow[],
): { result: AnalysisResult; contributors: number[] } {
  const meta = ANALYSIS_META[key];
  const spec = SPECS[key];
  const grouped = new Map<string, { values: number[]; idx: number[] }>();
  donors.forEach((d, i) => {
    const picked = spec.pick(d);
    if (!picked) return;
    const [band, value] = picked;
    const g = grouped.get(band) ?? grouped.set(band, { values: [], idx: [] }).get(band)!;
    g.values.push(value);
    g.idx.push(i);
  });

  let suppressed = 0;
  const contributors: number[] = [];
  const rows: AnalysisResultRow[] = spec.bands.map((band) => {
    const g = grouped.get(band);
    const n = g?.values.length ?? 0;
    if (n === 0) return { band, n: 0, value: null, suppressed: false };
    if (n < K_MIN) {
      suppressed++;
      // Never reveal the exact size of a small group.
      return { band, n: null, value: null, suppressed: true };
    }
    contributors.push(...g!.idx);
    const mean = g!.values.reduce((a, b) => a + b, 0) / n;
    return { band, n, value: spec.percent ? round1(mean * 100) : round1(mean), suppressed: false };
  });

  return {
    result: { key, valueLabel: meta.valueLabel, rows, suppressedCells: suppressed, donorCount: contributors.length },
    contributors,
  };
}

export function runAnalysis(key: AnalysisKey, donors: DonorRow[]): AnalysisResult {
  return runAnalysisWithContributors(key, donors).result;
}

/** CSV of an aggregate result (no row-level data exists to export). */
export function resultToCsv(result: AnalysisResult): string {
  const header = `band,n,${JSON.stringify(result.valueLabel)}`;
  const lines = result.rows.map((r) => `${JSON.stringify(r.band)},${r.suppressed ? `"<${K_MIN}"` : r.n ?? 0},${r.value ?? ""}`);
  return [header, ...lines].join("\n");
}
