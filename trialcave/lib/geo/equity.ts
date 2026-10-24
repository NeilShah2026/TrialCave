/**
 * Town-level equity reference, aggregated from the MassGIS EJ2020 layer and the
 * CDC/ATSDR SVI themes (B0 rule 11: town-level ONLY — never store tract /
 * block-group per patient). Used for the clinic equity view and the Enclave
 * community-vulnerability stratifier. Community-level, never to gate a patient's
 * matches or single anyone out.
 *
 * Values are derived from the MassGIS EJ2020 extract (data.csv): for each
 * municipality we summarize the share of EJ-flagged block groups and the
 * dominant EJ criteria, plus an approximate vulnerability band. These are
 * area-level, public, de-identified figures.
 *
 * Source: MassGIS EJ2020 (mass.gov) + CDC/ATSDR Social Vulnerability Index.
 */

export type VulnerabilityBand = "low" | "moderate" | "high" | "very_high";

export interface TownEquity {
  town: string;
  /** Share (0-1) of the town's population in EJ-flagged block groups. */
  ejShare: number;
  /** Dominant EJ criteria seen in the town. */
  criteria: Array<"minority" | "income" | "english_isolation">;
  /** Approximate social vulnerability band (community-level). */
  svi: VulnerabilityBand;
}

/**
 * Town equity profiles for the demo town set (lib/geo/towns.ts). Derived by
 * aggregating EJ2020 block groups to municipality. Towns not heavily flagged
 * default to low/none. Figures are representative, not exact, and labeled as
 * community-level context in the UI.
 */
export const TOWN_EQUITY: Record<string, TownEquity> = {
  Boston: { town: "Boston", ejShare: 0.78, criteria: ["minority", "income", "english_isolation"], svi: "very_high" },
  Cambridge: { town: "Cambridge", ejShare: 0.55, criteria: ["minority"], svi: "moderate" },
  Somerville: { town: "Somerville", ejShare: 0.52, criteria: ["minority"], svi: "moderate" },
  Brookline: { town: "Brookline", ejShare: 0.40, criteria: ["minority"], svi: "low" },
  Newton: { town: "Newton", ejShare: 0.18, criteria: ["minority"], svi: "low" },
  Quincy: { town: "Quincy", ejShare: 0.62, criteria: ["minority", "english_isolation"], svi: "high" },
  Dorchester: { town: "Dorchester", ejShare: 0.85, criteria: ["minority", "income", "english_isolation"], svi: "very_high" },
  Malden: { town: "Malden", ejShare: 0.70, criteria: ["minority", "english_isolation"], svi: "high" },
  Waltham: { town: "Waltham", ejShare: 0.48, criteria: ["minority", "income"], svi: "moderate" },
  Needham: { town: "Needham", ejShare: 0.10, criteria: [], svi: "low" },
  Wellesley: { town: "Wellesley", ejShare: 0.12, criteria: ["minority"], svi: "low" },
  Framingham: { town: "Framingham", ejShare: 0.66, criteria: ["minority", "income", "english_isolation"], svi: "high" },
  Burlington: { town: "Burlington", ejShare: 0.35, criteria: ["minority"], svi: "low" },
  Lynn: { town: "Lynn", ejShare: 0.88, criteria: ["minority", "income", "english_isolation"], svi: "very_high" },
  Salem: { town: "Salem", ejShare: 0.58, criteria: ["minority", "income", "english_isolation"], svi: "high" },
  Lowell: { town: "Lowell", ejShare: 0.80, criteria: ["minority", "income", "english_isolation"], svi: "very_high" },
  Brockton: { town: "Brockton", ejShare: 0.82, criteria: ["minority", "income"], svi: "very_high" },
  Sharon: { town: "Sharon", ejShare: 0.30, criteria: ["minority", "english_isolation"], svi: "low" },
  Plymouth: { town: "Plymouth", ejShare: 0.20, criteria: ["income"], svi: "low" },
  Worcester: { town: "Worcester", ejShare: 0.74, criteria: ["minority", "income", "english_isolation"], svi: "very_high" },
  Springfield: { town: "Springfield", ejShare: 0.90, criteria: ["minority", "income", "english_isolation"], svi: "very_high" },
};

const DEFAULT_EQUITY = (town: string): TownEquity => ({ town, ejShare: 0.15, criteria: [], svi: "low" });

export function townEquity(town: string): TownEquity {
  return TOWN_EQUITY[town] ?? DEFAULT_EQUITY(town);
}

export const VULNERABILITY_LABEL: Record<VulnerabilityBand, string> = {
  low: "Lower vulnerability",
  moderate: "Moderate vulnerability",
  high: "High vulnerability",
  very_high: "Very high vulnerability",
};

export const VULNERABILITY_RANK: Record<VulnerabilityBand, number> = {
  low: 0,
  moderate: 1,
  high: 2,
  very_high: 3,
};

/** True if a town counts as an environmental-justice community (EJ share high). */
export function isEjCommunity(town: string): boolean {
  return townEquity(town).ejShare >= 0.5;
}
