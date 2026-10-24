import "server-only";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { format } from "date-fns";

import type { ExtractedRecord } from "@/lib/ingest/types";

/**
 * Demo documents generated on the server with pdf-lib (B10.7). Each PDF carries
 * a keyword marker so the extractor can use a stored fixture instead of calling
 * the AI, keeping the demo working offline (B0 rule 8).
 */

export type DemoDocKey = "maria-visit-summary" | "james-lab-report";

export const DEMO_MARKER_PREFIX = "trialcave-demo";

function iso(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

interface DocBody {
  title: string;
  lines: string[];
}

function mariaBody(docDate: Date): DocBody {
  return {
    title: "QUINCY FAMILY HEALTH (fictional)                 After Visit Summary",
    lines: [
      `Patient: Maria Gonzalez        Visit date: ${format(docDate, "MMM d, yyyy")}`,
      "Provider: Dr. A. Rivera, MD (fictional)",
      "",
      "Diagnoses addressed today",
      "  - Type 2 diabetes mellitus without complications (E11.9)",
      "  - Essential hypertension (I10)",
      "",
      "Results",
      "  Hemoglobin A1c ............ 8.4 %        (ref 4.0-5.6)",
      "  Glucose, fasting .......... 172 mg/dL    (ref 70-99)",
      "  eGFR ...................... 88 mL/min/1.73m2",
      "",
      "Vitals",
      "  Weight: 89 kg     BMI: 33.1",
      "",
      "Current medications",
      "  - Metformin 1000 mg tablet, twice daily",
      "  - Atorvastatin 20 mg tablet, once daily",
      "",
      "Plan",
      "  A1c is above goal. Discussed options for adding a second medication.",
      "  Follow up in 3 months.",
      "",
      "SYNTHETIC DEMO DOCUMENT. Fictional patient and clinic.",
    ],
  };
}

function jamesBody(docDate: Date): DocBody {
  return {
    title: "FRAMINGHAM LAB SERVICES (fictional)                  Lab Report",
    lines: [
      `Patient: James O'Brien        Report date: ${format(docDate, "MMM d, yyyy")}`,
      "",
      "Results",
      "  Hemoglobin A1c ............ 7.6 %",
      "  eGFR ...................... 38 mL/min/1.73m2",
      "  LDL cholesterol ........... 92 mg/dL",
      "  ALT ....................... 31 U/L",
      "",
      "SYNTHETIC DEMO DOCUMENT. Fictional patient and lab.",
    ],
  };
}

export async function renderDemoPdf(key: DemoDocKey, docDate: Date): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Courier);
  const body = key === "maria-visit-summary" ? mariaBody(docDate) : jamesBody(docDate);

  page.drawText(body.title, { x: 40, y: 740, size: 10, font, color: rgb(0.12, 0.16, 0.27) });
  let y = 710;
  for (const line of body.lines) {
    page.drawText(line, { x: 40, y, size: 10, font, color: rgb(0.12, 0.16, 0.27) });
    y -= 16;
  }

  doc.setKeywords([`${DEMO_MARKER_PREFIX}:${key}:${iso(docDate)}`]);
  doc.setTitle("TrialCave synthetic demo document");
  return doc.save();
}

/** Read the demo marker from a PDF's keywords, if present. */
export async function readDemoMarker(pdfBytes: Uint8Array): Promise<{ key: DemoDocKey; date: string } | null> {
  try {
    const doc = await PDFDocument.load(pdfBytes, { updateMetadata: false });
    const keywords = doc.getKeywords() ?? "";
    const m = keywords.match(new RegExp(`${DEMO_MARKER_PREFIX}:(maria-visit-summary|james-lab-report):(\\d{4}-\\d{2}-\\d{2})`));
    if (!m) return null;
    return { key: m[1] as DemoDocKey, date: m[2] };
  } catch {
    return null;
  }
}

/** Stored extraction fixture matching each demo PDF (B10.7). */
export function demoFixture(key: DemoDocKey, docDate: string): ExtractedRecord {
  if (key === "maria-visit-summary") {
    return {
      documentType: "visit_summary",
      documentDate: docDate,
      facilityName: "Quincy Family Health",
      facts: [
        { kind: "diagnosis", name: "Type 2 diabetes mellitus", icd10: "E11.9", value: null, valueText: null, unit: null, negated: false, status: "active", date: docDate, sourceQuote: "Type 2 diabetes mellitus without complications (E11.9)" },
        { kind: "diagnosis", name: "Essential hypertension", icd10: "I10", value: null, valueText: null, unit: null, negated: false, status: "active", date: docDate, sourceQuote: "Essential hypertension (I10)" },
        { kind: "lab", name: "Hemoglobin A1c", icd10: null, value: 8.4, valueText: null, unit: "%", negated: false, status: "active", date: docDate, sourceQuote: "Hemoglobin A1c ............ 8.4 %" },
        { kind: "lab", name: "Glucose, fasting", icd10: null, value: 172, valueText: null, unit: "mg/dL", negated: false, status: "active", date: docDate, sourceQuote: "Glucose, fasting .......... 172 mg/dL" },
        { kind: "lab", name: "eGFR", icd10: null, value: 88, valueText: null, unit: "mL/min/1.73m2", negated: false, status: "active", date: docDate, sourceQuote: "eGFR ...................... 88 mL/min/1.73m2" },
        { kind: "vital", name: "Weight", icd10: null, value: 89, valueText: null, unit: "kg", negated: false, status: "active", date: docDate, sourceQuote: "Weight: 89 kg" },
        { kind: "vital", name: "BMI", icd10: null, value: 33.1, valueText: null, unit: null, negated: false, status: "active", date: docDate, sourceQuote: "BMI: 33.1" },
        { kind: "medication", name: "Metformin 1000 mg", icd10: null, value: null, valueText: null, unit: null, negated: false, status: "active", date: docDate, sourceQuote: "Metformin 1000 mg tablet, twice daily" },
        { kind: "medication", name: "Atorvastatin 20 mg", icd10: null, value: null, valueText: null, unit: null, negated: false, status: "active", date: docDate, sourceQuote: "Atorvastatin 20 mg tablet, once daily" },
      ],
    };
  }
  return {
    documentType: "lab_report",
    documentDate: docDate,
    facilityName: "Framingham Lab Services",
    facts: [
      { kind: "lab", name: "Hemoglobin A1c", icd10: null, value: 7.6, valueText: null, unit: "%", negated: false, status: "active", date: docDate, sourceQuote: "Hemoglobin A1c ............ 7.6 %" },
      { kind: "lab", name: "eGFR", icd10: null, value: 38, valueText: null, unit: "mL/min/1.73m2", negated: false, status: "active", date: docDate, sourceQuote: "eGFR ...................... 38 mL/min/1.73m2" },
      { kind: "lab", name: "LDL cholesterol", icd10: null, value: 92, valueText: null, unit: "mg/dL", negated: false, status: "active", date: docDate, sourceQuote: "LDL cholesterol ........... 92 mg/dL" },
      { kind: "lab", name: "ALT", icd10: null, value: 31, valueText: null, unit: "U/L", negated: false, status: "active", date: docDate, sourceQuote: "ALT ....................... 31 U/L" },
    ],
  };
}
