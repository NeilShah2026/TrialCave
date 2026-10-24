/**
 * Demo personas (B13.2). All fictional. Dates are relative to seed time ("today").
 *
 * Facts are seeded with status='confirmed'. `dx` facts use observed_at =
 * diagnosis date. The seed script turns these definitions into rows.
 */

import type { Language } from "@/lib/types";

export type FactSource =
  | "lab"
  | "wearable"
  | "self_report"
  | "portal"
  | "imaging"
  | "document"
  | "demo";

/** A seeded fact. `ago` describes observed_at relative to today. */
export interface PersonaFact {
  field: string;
  value: number | boolean | string;
  unit?: string;
  source: FactSource;
  /** Observed date relative to today, e.g. { months: 8 } or { years: 6 }. */
  ago: { years?: number; months?: number; days?: number };
}

export type ConnectedSource =
  | "apple_health"
  | "google_health_connect"
  | "fitbit"
  | "oura"
  | "whoop"
  | "dexcom"
  | "patient_portal";

export interface WearableProfile {
  /** Mean daily steps. */
  steps: number;
  stepsSd: number;
  restingHr: number;
  hrvMs: number;
  sleepHours: number;
  /** CGM values, only if a CGM is connected. */
  avgGlucose?: number;
  avgGlucoseSd?: number;
  timeInRangePct?: number;
  timeInRangeSd?: number;
  /** How many days of history to generate. */
  days: number;
}

export interface PersonaScan {
  modality: "mri" | "ultrasound" | "retinal" | "dermatology" | "ct" | "xray" | "pet" | "mammogram";
  origin: "existing_upload" | "partner_center";
  findingSummary: string;
  deidentified: boolean;
  displayImage: string | null;
  ago: { years?: number; months?: number; days?: number };
}

export type DataType = "wearables" | "labs" | "imaging" | "history";
export type ResearchType = "academic" | "pharma" | "ai" | "device";

export interface ResearchConsentCell {
  dataType: DataType;
  researchType: ResearchType;
  allowed: boolean;
}

export interface PersonaEarning {
  kind: "donation" | "research_share";
  amountCents: number;
  description: string;
  /** How long ago it was accrued, for ordering. */
  ago: { months?: number; days?: number };
}

export interface Persona {
  email: string;
  displayName: string;
  sex: "female" | "male";
  ageYears: number;
  town: string;
  travelRadiusMiles: number;
  preferredLanguage: Language;
  isDonor: boolean;
  emailIngestEnabled: boolean;
  inboxToken: string | null;
  facts: PersonaFact[];
  connectedSources: ConnectedSource[];
  wearable: WearableProfile | null;
  scans: PersonaScan[];
  contactPrefs: { allowInvitations: boolean; conditionCategories: string[] };
  researchConsents: ResearchConsentCell[];
  earnings: PersonaEarning[];
  /** Consent types granted at seed (each recorded as a consent_event). */
  consents: string[];
}

const ALL_DATA_TYPES: DataType[] = ["wearables", "labs", "imaging", "history"];

/** Build a full research-consent grid where `types` are allowed, rest off. */
function consentGrid(allowed: ResearchType[]): ResearchConsentCell[] {
  const all: ResearchType[] = ["academic", "pharma", "ai", "device"];
  const cells: ResearchConsentCell[] = [];
  for (const dataType of ALL_DATA_TYPES) {
    for (const researchType of all) {
      cells.push({
        dataType,
        researchType,
        allowed: allowed.includes(researchType),
      });
    }
  }
  return cells;
}

// ===== Maria Gonzalez — the hero =====
const maria: Persona = {
  email: "maria@example.com",
  displayName: "Maria Gonzalez",
  sex: "female",
  ageYears: 54,
  town: "Quincy",
  travelRadiusMiles: 30,
  preferredLanguage: "en", // switches to Español during the demo
  isDonor: true,
  emailIngestEnabled: true, // column stays; inbound email deprecated in the app
  inboxToken: "mgdemo7k2p9x",
  facts: [
    { field: "dx:type2_diabetes", value: true, source: "portal", ago: { years: 6 } },
    { field: "dx:prediabetes", value: false, source: "portal", ago: { years: 6 } },
    { field: "dx:type1_diabetes", value: false, source: "portal", ago: { years: 6 } },
    { field: "dx:ckd", value: false, source: "portal", ago: { months: 8 } },
    { field: "dx:dialysis", value: false, source: "portal", ago: { months: 8 } },
    { field: "dx:hypertension", value: true, source: "portal", ago: { years: 4 } },
    { field: "dx:retinopathy", value: false, source: "imaging", ago: { months: 3 } },
    { field: "hba1c_pct", value: 6.8, unit: "%", source: "lab", ago: { months: 8 } },
    { field: "fasting_glucose_mgdl", value: 141, unit: "mg/dL", source: "lab", ago: { months: 8 } },
    { field: "bmi", value: 32.6, unit: "kg/m²", source: "portal", ago: { months: 8 } },
    { field: "weight_kg", value: 87, unit: "kg", source: "portal", ago: { months: 8 } },
    { field: "egfr", value: 88, unit: "mL/min/1.73m²", source: "lab", ago: { months: 8 } },
    { field: "ldl_mgdl", value: 128, unit: "mg/dL", source: "lab", ago: { months: 8 } },
    { field: "triglycerides_mgdl", value: 190, unit: "mg/dL", source: "lab", ago: { months: 8 } },
    { field: "systolic_bp", value: 136, unit: "mmHg", source: "portal", ago: { months: 8 } },
    { field: "diastolic_bp", value: 84, unit: "mmHg", source: "portal", ago: { months: 8 } },
    { field: "med:metformin", value: true, source: "portal", ago: { months: 8 } },
    { field: "med:insulin", value: false, source: "portal", ago: { months: 8 } },
    { field: "med:glp1", value: false, source: "portal", ago: { months: 8 } },
    { field: "med:sglt2", value: false, source: "portal", ago: { months: 8 } },
    { field: "med:statin", value: true, source: "portal", ago: { months: 8 } },
    { field: "event:stroke_6mo", value: false, source: "self_report", ago: { months: 8 } },
    { field: "pregnant_or_breastfeeding", value: false, source: "self_report", ago: { months: 8 } },
    { field: "current_smoker", value: false, source: "self_report", ago: { months: 8 } },
    // event:mi_6mo is intentionally NOT set — it's the live demo question.
  ],
  connectedSources: ["apple_health", "dexcom", "patient_portal"],
  wearable: {
    steps: 6200,
    stepsSd: 1500,
    restingHr: 74,
    hrvMs: 32,
    sleepHours: 6.6,
    avgGlucose: 194,
    avgGlucoseSd: 15,
    timeInRangePct: 62,
    timeInRangeSd: 6,
    days: 90,
  },
  scans: [
    {
      modality: "retinal",
      origin: "existing_upload",
      findingSummary: "No diabetic retinopathy seen",
      deidentified: true,
      displayImage: "/demo/retina-maria.svg",
      ago: { months: 3 },
    },
  ],
  contactPrefs: {
    allowInvitations: true,
    conditionCategories: ["diabetes_metabolic", "cardiology"],
  },
  researchConsents: consentGrid(["academic", "pharma", "device"]), // ai OFF
  earnings: [
    { kind: "donation", amountCents: 1000, description: "Apple Watch connected, 30 days", ago: { months: 5 } },
    { kind: "donation", amountCents: 1000, description: "Dexcom CGM connected, 30 days", ago: { months: 5 } },
    { kind: "donation", amountCents: 500, description: "Lab panel donated", ago: { months: 4 } },
    { kind: "donation", amountCents: 1500, description: "Existing retinal scan donated", ago: { months: 3 } },
    { kind: "research_share", amountCents: 2050, description: "Your donation supported a glucose-variability study (academic)", ago: { months: 6 } },
    { kind: "research_share", amountCents: 1800, description: "Your donation supported a sleep and glucose study (academic)", ago: { months: 5 } },
    { kind: "research_share", amountCents: 1650, description: "Your donation supported an activity-patterns study (academic)", ago: { months: 4 } },
    { kind: "research_share", amountCents: 1700, description: "Your donation supported an eye-health study (academic)", ago: { months: 3 } },
    { kind: "research_share", amountCents: 1500, description: "Your donation supported a blood-pressure study (academic)", ago: { months: 2 } },
    { kind: "research_share", amountCents: 1550, description: "Your donation supported a heart-rate signals study (device)", ago: { months: 1 } },
  ],
  consents: ["terms", "privacy_notice", "donor_agreement", "contact", "email_ingest"],
};

// ===== James O'Brien =====
const james: Persona = {
  email: "james@example.com",
  displayName: "James O'Brien",
  sex: "male",
  ageYears: 67,
  town: "Framingham",
  travelRadiusMiles: 25,
  preferredLanguage: "en",
  isDonor: false,
  emailIngestEnabled: false,
  inboxToken: null,
  facts: [
    { field: "dx:type2_diabetes", value: true, source: "portal", ago: { years: 14 } },
    { field: "dx:type1_diabetes", value: false, source: "portal", ago: { years: 14 } },
    { field: "dx:ckd", value: true, source: "portal", ago: { years: 2 } },
    { field: "dx:dialysis", value: false, source: "portal", ago: { months: 2 } },
    { field: "dx:retinopathy", value: true, source: "imaging", ago: { years: 1 } },
    { field: "hba1c_pct", value: 7.6, unit: "%", source: "lab", ago: { months: 2 } },
    { field: "fasting_glucose_mgdl", value: 151, unit: "mg/dL", source: "lab", ago: { months: 2 } },
    { field: "bmi", value: 29.4, unit: "kg/m²", source: "portal", ago: { months: 2 } },
    { field: "egfr", value: 38, unit: "mL/min/1.73m²", source: "lab", ago: { months: 2 } },
    { field: "ldl_mgdl", value: 92, unit: "mg/dL", source: "lab", ago: { months: 2 } },
    { field: "systolic_bp", value: 142, unit: "mmHg", source: "portal", ago: { months: 2 } },
    { field: "diastolic_bp", value: 80, unit: "mmHg", source: "portal", ago: { months: 2 } },
    { field: "med:metformin", value: true, source: "portal", ago: { months: 2 } },
    { field: "med:insulin", value: true, source: "portal", ago: { months: 2 } },
    { field: "med:sglt2", value: true, source: "portal", ago: { months: 2 } },
    { field: "med:statin", value: true, source: "portal", ago: { months: 2 } },
    { field: "event:mi_6mo", value: true, source: "self_report", ago: { months: 4 } },
    { field: "event:stroke_6mo", value: false, source: "self_report", ago: { months: 2 } },
    { field: "current_smoker", value: false, source: "self_report", ago: { months: 2 } },
  ],
  connectedSources: ["patient_portal"],
  wearable: null,
  scans: [
    {
      modality: "retinal",
      origin: "existing_upload",
      findingSummary: "Mild non-proliferative diabetic retinopathy",
      deidentified: true,
      displayImage: "/demo/retina-james.svg",
      ago: { years: 1 },
    },
  ],
  contactPrefs: {
    allowInvitations: true,
    conditionCategories: ["diabetes_metabolic", "kidney", "cardiology"],
  },
  researchConsents: consentGrid([]), // not a donor
  earnings: [],
  consents: ["terms", "privacy_notice", "contact"],
};

// ===== Priya Raman =====
const priya: Persona = {
  email: "priya@example.com",
  displayName: "Priya Raman",
  sex: "female",
  ageYears: 41,
  town: "Cambridge",
  travelRadiusMiles: 20,
  preferredLanguage: "en",
  isDonor: true,
  emailIngestEnabled: false,
  inboxToken: null,
  facts: [
    { field: "dx:prediabetes", value: true, source: "portal", ago: { years: 1 } },
    { field: "dx:type2_diabetes", value: false, source: "portal", ago: { months: 3 } },
    { field: "dx:type1_diabetes", value: false, source: "portal", ago: { months: 3 } },
    { field: "hba1c_pct", value: 6.1, unit: "%", source: "lab", ago: { months: 3 } },
    { field: "fasting_glucose_mgdl", value: 108, unit: "mg/dL", source: "lab", ago: { months: 3 } },
    { field: "bmi", value: 27.8, unit: "kg/m²", source: "portal", ago: { months: 3 } },
    { field: "egfr", value: 102, unit: "mL/min/1.73m²", source: "lab", ago: { months: 3 } },
    { field: "ldl_mgdl", value: 118, unit: "mg/dL", source: "lab", ago: { months: 3 } },
    { field: "med:metformin", value: false, source: "portal", ago: { months: 3 } },
    { field: "med:insulin", value: false, source: "portal", ago: { months: 3 } },
    { field: "pregnant_or_breastfeeding", value: false, source: "self_report", ago: { months: 3 } },
    { field: "current_smoker", value: false, source: "self_report", ago: { months: 3 } },
    // event:bariatric_surgery intentionally unset → STRIDE has 1 unknown.
  ],
  connectedSources: ["oura", "apple_health"],
  wearable: {
    steps: 8900,
    stepsSd: 1400,
    restingHr: 61,
    hrvMs: 52,
    sleepHours: 7.3,
    days: 90,
  },
  scans: [],
  contactPrefs: {
    allowInvitations: true,
    conditionCategories: ["diabetes_metabolic"],
  },
  researchConsents: consentGrid(["academic", "pharma", "ai", "device"]),
  earnings: [
    { kind: "donation", amountCents: 1000, description: "Oura ring connected, 30 days", ago: { months: 4 } },
    { kind: "donation", amountCents: 1000, description: "Apple Health connected, 30 days", ago: { months: 4 } },
    { kind: "donation", amountCents: 500, description: "Lab panel donated", ago: { months: 3 } },
    { kind: "research_share", amountCents: 3300, description: "Your donation supported a prediabetes activity study (academic)", ago: { months: 5 } },
    { kind: "research_share", amountCents: 3200, description: "Your donation supported a wearable sleep study (academic)", ago: { months: 4 } },
    { kind: "research_share", amountCents: 3100, description: "Your donation supported a metabolic health study (device)", ago: { months: 3 } },
    { kind: "research_share", amountCents: 3000, description: "Your donation supported an HRV and glucose study (ai)", ago: { months: 2 } },
    { kind: "research_share", amountCents: 3000, description: "Your donation supported a blood-pressure trends study (academic)", ago: { months: 1 } },
  ],
  consents: ["terms", "privacy_notice", "donor_agreement", "contact"],
};

export const PERSONAS: Persona[] = [maria, james, priya];

export function getPersona(email: string): Persona | undefined {
  return PERSONAS.find((p) => p.email === email);
}
