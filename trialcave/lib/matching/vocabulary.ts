/**
 * Controlled matching vocabulary (B9.1).
 *
 * The AI criteria parser and the record mapper may only use these field names.
 * Anything else gets field: null. This vocabulary is cardiometabolic-first by
 * design (B20): trials outside it still load and match using AI-estimated and
 * question-based checks. Keep it structured and extensible — never hard-code the
 * app to one condition.
 */

export type VocabType = "number" | "bool" | "text";

export type ShareCategory =
  | "demographic"
  | "condition"
  | "lab"
  | "vital"
  | "medication"
  | "history"
  | "wearable"
  | "reproductive";

export interface VocabField {
  field: string;
  type: VocabType;
  unit: string | null;
  /** Plain-English label used everywhere in the UI. */
  label: string;
  /** Yes/No question for bool fields a patient could answer. */
  question: string | null;
  category: ShareCategory;
  /** Reproductive health (C3.4). Hidden from clinics unless shared; never in Enclave. */
  sensitive: boolean;
  /** Computed, never stored as a raw fact. */
  derived: boolean;
  /** Plausible numeric range for sanity-checking values (B10.5). */
  plausible: { min: number; max: number } | null;
}

function f(
  field: string,
  type: VocabType,
  label: string,
  opts: Partial<Omit<VocabField, "field" | "type" | "label">> = {},
): VocabField {
  return {
    field,
    type,
    label,
    unit: opts.unit ?? null,
    question: opts.question ?? null,
    category: opts.category ?? "condition",
    sensitive: opts.sensitive ?? false,
    derived: opts.derived ?? false,
    plausible: opts.plausible ?? null,
  };
}

export const VOCABULARY: VocabField[] = [
  // Demographics (derived)
  f("age", "number", "Age", {
    unit: "years",
    category: "demographic",
    derived: true,
    plausible: { min: 18, max: 110 },
  }),
  f("sex", "text", "Sex", { category: "demographic", derived: true }),

  // Diagnoses
  f("dx:type2_diabetes", "bool", "Type 2 diabetes", {
    question: "Have you been diagnosed with type 2 diabetes?",
  }),
  f("dx:type1_diabetes", "bool", "Type 1 diabetes", {
    question: "Have you been diagnosed with type 1 diabetes?",
  }),
  f("dx:prediabetes", "bool", "Prediabetes", {
    question: "Have you been told you have prediabetes?",
  }),
  f("dx:ckd", "bool", "Chronic kidney disease", {
    question: "Have you been diagnosed with chronic kidney disease?",
  }),
  f("dx:dialysis", "bool", "On dialysis", {
    question: "Are you currently on dialysis?",
  }),
  f("dx:heart_failure", "bool", "Heart failure", {
    question: "Have you been diagnosed with heart failure?",
  }),
  f("dx:hypertension", "bool", "High blood pressure", {
    question: "Have you been diagnosed with high blood pressure?",
  }),
  f("dx:retinopathy", "bool", "Diabetic eye disease", {
    question: "Have you been told you have diabetic eye disease (retinopathy)?",
  }),
  f("dx:cancer_active", "bool", "Active cancer", {
    question: "Are you currently being treated for cancer?",
  }),
  f("dx:liver_disease", "bool", "Liver disease", {
    question: "Have you been diagnosed with liver disease?",
  }),
  f("dx:pancreatitis_history", "bool", "History of pancreatitis", {
    question: "Have you ever had pancreatitis?",
  }),
  f("diabetes_duration_years", "number", "Years with type 2 diabetes", {
    unit: "years",
    derived: true,
    plausible: { min: 0, max: 80 },
  }),

  // Labs
  f("hba1c_pct", "number", "HbA1c (3-month blood sugar average)", {
    unit: "%",
    category: "lab",
    plausible: { min: 3, max: 20 },
  }),
  f("fasting_glucose_mgdl", "number", "Fasting blood sugar", {
    unit: "mg/dL",
    category: "lab",
    plausible: { min: 40, max: 600 },
  }),
  f("egfr", "number", "Kidney function (eGFR)", {
    unit: "mL/min/1.73m²",
    category: "lab",
    plausible: { min: 1, max: 200 },
  }),
  f("ldl_mgdl", "number", "LDL cholesterol", {
    unit: "mg/dL",
    category: "lab",
    plausible: { min: 10, max: 400 },
  }),
  f("triglycerides_mgdl", "number", "Triglycerides", {
    unit: "mg/dL",
    category: "lab",
    plausible: { min: 20, max: 3000 },
  }),
  f("alt_ul", "number", "Liver enzyme (ALT)", {
    unit: "U/L",
    category: "lab",
    plausible: { min: 1, max: 2000 },
  }),

  // Vitals
  f("bmi", "number", "Body mass index (BMI)", {
    unit: "kg/m²",
    category: "vital",
    plausible: { min: 12, max: 80 },
  }),
  f("weight_kg", "number", "Weight", {
    unit: "kg",
    category: "vital",
    plausible: { min: 30, max: 300 },
  }),
  f("systolic_bp", "number", "Systolic blood pressure", {
    unit: "mmHg",
    category: "vital",
    plausible: { min: 60, max: 260 },
  }),
  f("diastolic_bp", "number", "Diastolic blood pressure", {
    unit: "mmHg",
    category: "vital",
    plausible: { min: 30, max: 160 },
  }),

  // Medications
  f("med:metformin", "bool", "Metformin", {
    category: "medication",
    question: "Do you currently take metformin?",
  }),
  f("med:insulin", "bool", "Insulin", {
    category: "medication",
    question: "Do you currently use insulin?",
  }),
  f("med:glp1", "bool", "GLP-1 medication (e.g. Ozempic, Mounjaro)", {
    category: "medication",
    question: "Do you currently take a GLP-1 medication like Ozempic or Mounjaro?",
  }),
  f("med:sglt2", "bool", "SGLT2 inhibitor (e.g. Jardiance, Farxiga)", {
    category: "medication",
    question: "Do you take an SGLT2 inhibitor like Jardiance or Farxiga?",
  }),
  f("med:sulfonylurea", "bool", "Sulfonylurea", {
    category: "medication",
    question: "Do you take a sulfonylurea (e.g. glipizide, glimepiride)?",
  }),
  f("med:dpp4", "bool", "DPP-4 inhibitor", {
    category: "medication",
    question: "Do you take a DPP-4 inhibitor (e.g. Januvia)?",
  }),
  f("med:statin", "bool", "Statin (cholesterol medication)", {
    category: "medication",
    question: "Do you currently take a statin for cholesterol?",
  }),

  // History / events
  f("event:mi_6mo", "bool", "Heart attack in the past 6 months", {
    category: "history",
    question: "Have you had a heart attack in the past 6 months?",
  }),
  f("event:stroke_6mo", "bool", "Stroke in the past 6 months", {
    category: "history",
    question: "Have you had a stroke in the past 6 months?",
  }),
  f("event:bariatric_surgery", "bool", "Weight-loss (bariatric) surgery", {
    category: "history",
    question: "Have you ever had weight-loss surgery?",
  }),
  f("pregnant_or_breastfeeding", "bool", "Pregnant or breastfeeding", {
    category: "reproductive",
    sensitive: true,
    question: "Are you currently pregnant or breastfeeding?",
  }),
  f("current_smoker", "bool", "Current smoker", {
    category: "history",
    question: "Do you currently smoke?",
  }),

  // Wearables (derived)
  f("has_wearable", "bool", "Uses a smartwatch or fitness tracker", {
    category: "wearable",
    derived: true,
  }),
  f("has_cgm", "bool", "Uses a continuous glucose monitor", {
    category: "wearable",
    derived: true,
  }),
  f("avg_daily_steps", "number", "Average daily steps", {
    unit: "steps",
    category: "wearable",
    derived: true,
    plausible: { min: 0, max: 60000 },
  }),
  f("cgm_time_in_range_pct", "number", "Time with blood sugar in range", {
    unit: "%",
    category: "wearable",
    derived: true,
    plausible: { min: 0, max: 100 },
  }),
];

// Lookup helpers.
const BY_FIELD = new Map(VOCABULARY.map((v) => [v.field, v]));

export function getVocabField(field: string): VocabField | undefined {
  return BY_FIELD.get(field);
}

export function isVocabField(field: string): boolean {
  return BY_FIELD.has(field);
}

export function vocabLabel(field: string): string {
  return BY_FIELD.get(field)?.label ?? field;
}

export const VOCAB_FIELD_NAMES: string[] = VOCABULARY.map((v) => v.field);

/** Fields that have a yes/no question a patient can answer. */
export const QUESTION_FIELDS: VocabField[] = VOCABULARY.filter(
  (v) => v.type === "bool" && v.question !== null,
);
