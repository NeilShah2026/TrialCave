/**
 * Build a patient's fact map from confirmed facts + derived fields (B9.2).
 *
 * Pure functions (buildFactMapFromRows) are unit-tested; buildFactMap wraps them
 * with DB access. A missing field is UNKNOWN, never false (B9.2 rule 3).
 */

import { differenceInYears, parseISO } from "date-fns";

export type EvidenceSource =
  | "lab"
  | "wearable"
  | "self_report"
  | "portal"
  | "imaging"
  | "document"
  | "demo"
  | "derived";

export interface Evidence {
  factId: string | null; // null for derived fields
  source: EvidenceSource;
  observedAt: string | null; // ISO date
  documentId: string | null;
  documentLabel: string | null; // "Quincy Family Health visit, Oct 20"
}

export interface FactValue {
  value: number | boolean | string;
  unit: string | null;
  evidence: Evidence;
}

export type FactMap = Record<string, FactValue>;

/** Minimal row shapes the pure builder needs. */
export interface PatientRow {
  id: string;
  date_of_birth: string;
  sex: "female" | "male";
}

export interface ConfirmedFact {
  id: string;
  field: string | null;
  value_num: number | null;
  value_bool: boolean | null;
  value_text: string | null;
  unit: string | null;
  observed_at: string | null;
  source: EvidenceSource;
  document_id: string | null;
}

export interface SourceDocumentRow {
  id: string;
  facility_name: string | null;
  document_date: string | null;
}

export interface WearableDayRow {
  day: string; // ISO date
  steps: number | null;
  time_in_range_pct: number | null;
}

function factValueOf(f: ConfirmedFact): number | boolean | string | null {
  if (f.value_num !== null) return f.value_num;
  if (f.value_bool !== null) return f.value_bool;
  if (f.value_text !== null) return f.value_text;
  return null;
}

function documentLabel(
  docId: string | null,
  documents: Map<string, SourceDocumentRow>,
): string | null {
  if (!docId) return null;
  const doc = documents.get(docId);
  if (!doc) return null;
  const facility = doc.facility_name ?? "your records";
  if (doc.document_date) {
    const d = parseISO(doc.document_date);
    const month = d.toLocaleString("en-US", { month: "short" });
    return `${facility} visit, ${month} ${d.getDate()}`;
  }
  return `${facility} visit`;
}

export interface BuildFactMapInput {
  patient: PatientRow;
  /** Latest confirmed vocabulary fact per field (patient_current_facts). */
  currentFacts: ConfirmedFact[];
  /** All confirmed facts (needed for earliest diagnosis date). */
  allConfirmedFacts: ConfirmedFact[];
  connectedSources: string[];
  wearableDays: WearableDayRow[];
  documents: SourceDocumentRow[];
  today?: Date;
}

export function buildFactMapFromRows(input: BuildFactMapInput): FactMap {
  const today = input.today ?? new Date();
  const docMap = new Map(input.documents.map((d) => [d.id, d]));
  const map: FactMap = {};

  // 1. Confirmed vocabulary facts (latest per field).
  for (const f of input.currentFacts) {
    if (!f.field) continue;
    const value = factValueOf(f);
    if (value === null) continue;
    map[f.field] = {
      value,
      unit: f.unit,
      evidence: {
        factId: f.id,
        source: f.source,
        observedAt: f.observed_at,
        documentId: f.document_id,
        documentLabel: documentLabel(f.document_id, docMap),
      },
    };
  }

  const derivedEvidence = (): Evidence => ({
    factId: null,
    source: "derived",
    observedAt: null,
    documentId: null,
    documentLabel: null,
  });

  // 2a. age
  const age = differenceInYears(today, parseISO(input.patient.date_of_birth));
  map["age"] = { value: age, unit: "years", evidence: derivedEvidence() };

  // 2b. sex
  map["sex"] = { value: input.patient.sex, unit: null, evidence: derivedEvidence() };

  // 2c. diabetes_duration_years — only if currently type 2 diabetic.
  const t2d = map["dx:type2_diabetes"];
  if (t2d && t2d.value === true) {
    const dated = input.allConfirmedFacts
      .filter((f) => f.field === "dx:type2_diabetes" && f.value_bool === true && f.observed_at)
      .map((f) => parseISO(f.observed_at as string));
    if (dated.length) {
      const earliest = dated.reduce((a, b) => (a < b ? a : b));
      map["diabetes_duration_years"] = {
        value: differenceInYears(today, earliest),
        unit: "years",
        evidence: derivedEvidence(),
      };
    }
  }

  // 2d. wearable-derived fields.
  const nonPortal = input.connectedSources.filter((s) => s !== "patient_portal");
  if (nonPortal.length > 0) {
    map["has_wearable"] = { value: true, unit: null, evidence: derivedEvidence() };
  }
  if (input.connectedSources.includes("dexcom")) {
    map["has_cgm"] = { value: true, unit: null, evidence: derivedEvidence() };
  }

  // Last 30 days averages, require >= 7 days of data.
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - 30);
  const last30 = input.wearableDays.filter((w) => parseISO(w.day) >= cutoff);

  const steps = last30.map((w) => w.steps).filter((s): s is number => s != null);
  if (steps.length >= 7) {
    map["avg_daily_steps"] = {
      value: Math.round(steps.reduce((a, b) => a + b, 0) / steps.length),
      unit: "steps",
      evidence: derivedEvidence(),
    };
  }
  const tir = last30.map((w) => w.time_in_range_pct).filter((s): s is number => s != null);
  if (tir.length >= 7) {
    map["cgm_time_in_range_pct"] = {
      value: Math.round(tir.reduce((a, b) => a + b, 0) / tir.length),
      unit: "%",
      evidence: derivedEvidence(),
    };
  }

  return map;
}
