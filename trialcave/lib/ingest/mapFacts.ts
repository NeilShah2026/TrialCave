/**
 * Map AI-extracted facts to vocabulary fields (B10.5). Pure, unit-tested.
 *
 * - Diagnoses: ICD-10 prefix then name keyword → bool field.
 * - Medications: name → class field(s); combos map to multiple.
 * - Labs/vitals: name → field, convert units, plausibility check.
 * - Pregnancy: → pregnant_or_breastfeeding.
 * - Everything else → display-only (field=null).
 * - Germline genetic results are dropped entirely (B0 rule 13).
 */

import { vocabLabel } from "@/lib/matching/vocabulary";
import { convertToCanonical } from "@/lib/ingest/units";
import { medFieldsFor } from "@/lib/ingest/medClasses";
import { dxFieldFor } from "@/lib/ingest/dxCodes";
import { isPlausible } from "@/lib/ingest/plausibility";
import type { ExtractedFact, MappedFact, Comparison } from "@/lib/ingest/types";

/** Labs/vitals name → vocabulary field. */
const LAB_NAME_RULES: Array<{ field: string; keywords: string[] }> = [
  { field: "hba1c_pct", keywords: ["a1c", "hemoglobin a1c", "hba1c", "glycated hemoglobin"] },
  { field: "fasting_glucose_mgdl", keywords: ["fasting glucose", "glucose, fasting", "fpg"] },
  { field: "egfr", keywords: ["egfr", "estimated gfr"] },
  { field: "ldl_mgdl", keywords: ["ldl"] },
  { field: "triglycerides_mgdl", keywords: ["triglyceride"] },
  { field: "alt_ul", keywords: ["alt", "alanine aminotransferase", "sgpt"] },
  { field: "bmi", keywords: ["bmi", "body mass index"] },
  { field: "weight_kg", keywords: ["weight"] },
  { field: "systolic_bp", keywords: ["systolic"] },
  { field: "diastolic_bp", keywords: ["diastolic"] },
];

// Germline genetic test names to drop (B0 rule 13, C3.3).
const GENETIC_KEYWORDS = ["brca", "lynch syndrome", "genetic panel", "carrier screen", "germline"];

export interface CurrentFactSnapshot {
  field: string;
  valueNum: number | null;
  valueBool: boolean | null;
  observedAt: string | null;
}

function labFieldFor(name: string): string | null {
  const lower = name.toLowerCase();
  for (const rule of LAB_NAME_RULES) {
    if (rule.keywords.some((k) => lower.includes(k))) return rule.field;
  }
  return null;
}

function compareTo(
  field: string | null,
  valueNum: number | null,
  valueBool: boolean | null,
  observedAt: string | null,
  current: Map<string, CurrentFactSnapshot>,
): Comparison {
  if (!field) return "display_only";
  const cur = current.get(field);
  if (!cur) return "new";
  // Older than the current fact → won't become current.
  if (observedAt && cur.observedAt && observedAt < cur.observedAt) return "older";
  const sameNum = valueNum !== null && cur.valueNum !== null && valueNum === cur.valueNum;
  const sameBool = valueBool !== null && cur.valueBool !== null && valueBool === cur.valueBool;
  if (sameNum || sameBool) return "same";
  return "update";
}

export function mapFacts(
  extracted: ExtractedFact[],
  documentDate: string | null,
  current: CurrentFactSnapshot[],
  today: Date = new Date(),
): MappedFact[] {
  const currentMap = new Map(current.map((c) => [c.field, c]));
  const out: MappedFact[] = [];

  const displayOnly = (name: string, observedAt: string | null, quote: string, valueText: string | null = null): MappedFact => ({
    field: null,
    label: name,
    valueNum: null,
    valueBool: null,
    valueText,
    unit: null,
    observedAt,
    sourceQuote: quote,
    warning: null,
    comparison: "display_only",
  });

  for (const f of extracted) {
    const observedAt = f.date ?? documentDate;
    const lowerName = f.name.toLowerCase();

    // Drop germline genetic results entirely.
    if (GENETIC_KEYWORDS.some((k) => lowerName.includes(k))) continue;

    if (f.kind === "diagnosis" || f.kind === "event") {
      const dx = dxFieldFor(f.icd10, f.name, observedAt, today);
      if (!dx) {
        out.push(displayOnly(f.name, observedAt, f.sourceQuote));
        continue;
      }
      // dx:cancer_active is never auto-set (too error-prone) → display-only.
      if (dx.field === "dx:cancer_active") {
        out.push(displayOnly(f.name, observedAt, f.sourceQuote));
        continue;
      }
      // resolved/historical diagnoses are display-only, except bariatric (ever).
      const isHistorical = f.status === "resolved" || f.status === "historical";
      if (isHistorical && dx.field !== "event:bariatric_surgery") {
        out.push(displayOnly(f.name, observedAt, f.sourceQuote));
        continue;
      }
      // Event fields: value is true only if within window.
      const boolValue = dx.field.startsWith("event:")
        ? !f.negated && dx.withinWindow
        : !f.negated;
      out.push({
        field: dx.field,
        label: vocabLabel(dx.field),
        valueNum: null,
        valueBool: boolValue,
        valueText: null,
        unit: null,
        observedAt,
        sourceQuote: f.sourceQuote,
        warning: null,
        comparison: compareTo(dx.field, null, boolValue, observedAt, currentMap),
      });
      continue;
    }

    if (f.kind === "medication") {
      const fields = medFieldsFor(f.name);
      if (fields.length === 0) {
        out.push(displayOnly(f.name, observedAt, f.sourceQuote));
        continue;
      }
      // stopped meds are display-only; active/unknown → true.
      if (f.status === "stopped") {
        out.push(displayOnly(f.name, observedAt, f.sourceQuote));
        continue;
      }
      for (const field of fields) {
        out.push({
          field,
          label: vocabLabel(field),
          valueNum: null,
          valueBool: true,
          valueText: null,
          unit: null,
          observedAt,
          sourceQuote: f.sourceQuote,
          warning: null,
          comparison: compareTo(field, null, true, observedAt, currentMap),
        });
      }
      continue;
    }

    if (f.kind === "lab" || f.kind === "vital") {
      const field = labFieldFor(f.name);
      if (!field || f.value === null) {
        out.push(displayOnly(f.name, observedAt, f.sourceQuote, f.valueText));
        continue;
      }
      const converted = convertToCanonical(field, f.value, f.unit);
      if (!converted) {
        out.push({ ...displayOnly(f.name, observedAt, f.sourceQuote), warning: "We couldn't read this value. Check it before confirming." });
        continue;
      }
      if (!isPlausible(field, converted.value)) {
        out.push({ ...displayOnly(f.name, observedAt, f.sourceQuote), warning: "We couldn't read this value. Check it before confirming." });
        continue;
      }
      out.push({
        field,
        label: vocabLabel(field),
        valueNum: converted.value,
        valueBool: null,
        valueText: null,
        unit: converted.unit,
        observedAt,
        sourceQuote: f.sourceQuote,
        warning: null,
        comparison: compareTo(field, converted.value, null, observedAt, currentMap),
      });
      continue;
    }

    if (f.kind === "pregnancy") {
      const field = "pregnant_or_breastfeeding";
      const boolValue = !f.negated;
      out.push({
        field,
        label: vocabLabel(field),
        valueNum: null,
        valueBool: boolValue,
        valueText: null,
        unit: null,
        observedAt,
        sourceQuote: f.sourceQuote,
        warning: null,
        comparison: compareTo(field, null, boolValue, observedAt, currentMap),
      });
      continue;
    }

    // procedure, lifestyle, unmapped → display-only.
    out.push(displayOnly(f.name, observedAt, f.sourceQuote, f.valueText));
  }

  return out;
}
