/**
 * Shared ingestion types: the AI extraction output and the mapped-fact output.
 */

export type ExtractedKind =
  | "diagnosis"
  | "medication"
  | "lab"
  | "vital"
  | "procedure"
  | "event"
  | "lifestyle"
  | "pregnancy"
  | "other";

export interface ExtractedFact {
  kind: ExtractedKind;
  name: string;
  icd10: string | null;
  value: number | null;
  valueText: string | null;
  unit: string | null;
  negated: boolean;
  status: "active" | "resolved" | "historical" | "stopped" | "unknown";
  date: string | null; // YYYY-MM-DD
  sourceQuote: string;
}

export interface ExtractedRecord {
  documentType:
    | "visit_summary"
    | "lab_report"
    | "discharge_summary"
    | "medication_list"
    | "imaging_report"
    | "other";
  documentDate: string | null;
  facilityName: string | null;
  facts: ExtractedFact[];
}

export type Comparison = "new" | "update" | "same" | "older" | "display_only";

/** A fact after mapping to the vocabulary, ready for the review screen. */
export interface MappedFact {
  field: string | null; // null for display-only
  label: string;
  valueNum: number | null;
  valueBool: boolean | null;
  valueText: string | null;
  unit: string | null;
  observedAt: string | null;
  sourceQuote: string;
  warning: string | null;
  comparison: Comparison;
}
