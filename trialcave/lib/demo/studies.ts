/**
 * Demo clinics and studies (B13.4). Hand-written criteria, no AI, so the demo
 * works with the AI API down (B0 rule 8). All clinics/studies are fictional.
 */

export interface DemoClinic {
  email: string; // owner login
  name: string;
  town: string;
  lat: number;
  lon: number;
  verified: boolean;
  irbOnFile: boolean;
}

export const DEMO_CLINICS: DemoClinic[] = [
  {
    email: "commonwealth@example.com",
    name: "Commonwealth Metabolic Research Center",
    town: "Boston",
    lat: 42.3388,
    lon: -71.106,
    verified: true,
    irbOnFile: true,
  },
  {
    email: "northshore@example.com",
    name: "Northshore Endocrine Research Group",
    town: "Salem",
    lat: 42.5195,
    lon: -70.8967,
    verified: true,
    irbOnFile: true,
  },
  {
    email: "newclinic@example.com",
    name: "Pioneer Valley Research Associates",
    town: "Springfield",
    lat: 42.1015,
    lon: -72.5898,
    verified: false,
    irbOnFile: false,
  },
];

export type CriterionKind = "inclusion" | "exclusion";
export type CriterionOperator =
  | "gte"
  | "lte"
  | "between"
  | "eq"
  | "present"
  | "absent";
export type CriterionCategory =
  | "demographic"
  | "diagnosis"
  | "lab"
  | "medication"
  | "vital"
  | "history"
  | "lifestyle"
  | "logistics"
  | "other";

export interface DemoCriterion {
  kind: CriterionKind;
  plainText: string;
  category: CriterionCategory;
  field: string | null;
  operator: CriterionOperator | null;
  valueMin: number | null;
  valueMax: number | null;
  valueText: string | null;
  unit: string | null;
  question: string | null;
}

export interface DemoStudy {
  clinicEmail: string;
  title: string;
  conditionCategory:
    | "diabetes_metabolic"
    | "cardiology"
    | "kidney"
    | "oncology"
    | "neurology"
    | "other";
  phases: string[];
  studyType: string;
  irbProtocolNumber: string;
  plainSummary: string;
  whatIsInvolved: string;
  logistics: {
    visit_count: number | null;
    duration_weeks: number | null;
    remote_option: boolean | null;
    compensation_mentioned: boolean | null;
  };
  minAge: number | null;
  maxAge: number | null;
  sex: "ALL" | "FEMALE" | "MALE";
  criteria: DemoCriterion[];
}

/** Helpers to keep criteria terse. */
function inc(
  plainText: string,
  category: CriterionCategory,
  extra: Partial<DemoCriterion> = {},
): DemoCriterion {
  return {
    kind: "inclusion",
    plainText,
    category,
    field: extra.field ?? null,
    operator: extra.operator ?? null,
    valueMin: extra.valueMin ?? null,
    valueMax: extra.valueMax ?? null,
    valueText: extra.valueText ?? null,
    unit: extra.unit ?? null,
    question: extra.question ?? null,
  };
}
function exc(
  plainText: string,
  category: CriterionCategory,
  extra: Partial<DemoCriterion> = {},
): DemoCriterion {
  return { ...inc(plainText, category, extra), kind: "exclusion" };
}

export const DEFAULT_INVITE_MESSAGE =
  "Hello. Based on the health information you keep in TrialCave, you may be a good fit " +
  "for {study}, a research study at {clinic}. Taking part is voluntary, and saying no " +
  "won't affect your care. If you'd like to learn more, approve this invitation and our " +
  "study team will contact you.";

export const DEMO_STUDIES: DemoStudy[] = [
  // 1. COMPASS-T2D (Commonwealth)
  {
    clinicEmail: "commonwealth@example.com",
    title: "COMPASS-T2D",
    conditionCategory: "diabetes_metabolic",
    phases: ["PHASE2"],
    studyType: "INTERVENTIONAL",
    irbProtocolNumber: "CMRC-2026-014 (fictional)",
    plainSummary:
      "Tests whether an investigational once-weekly injection helps adults with type 2 " +
      "diabetes lower their blood sugar when metformin alone isn't enough.",
    whatIsInvolved:
      "About 8 clinic visits over 26 weeks, weekly at-home injections, and wearing a glucose sensor.",
    logistics: { visit_count: 8, duration_weeks: 26, remote_option: false, compensation_mentioned: true },
    minAge: 18,
    maxAge: 75,
    sex: "ALL",
    criteria: [
      inc("Diagnosed with type 2 diabetes", "diagnosis", { field: "dx:type2_diabetes", operator: "present", question: "Have you been diagnosed with type 2 diabetes?" }),
      inc("Diabetes for at least 1 year", "diagnosis", { field: "diabetes_duration_years", operator: "gte", valueMin: 1 }),
      inc("HbA1c between 7% and 10.5%", "lab", { field: "hba1c_pct", operator: "between", valueMin: 7.0, valueMax: 10.5, unit: "%" }),
      inc("BMI between 25 and 45", "vital", { field: "bmi", operator: "between", valueMin: 25, valueMax: 45, unit: "kg/m²" }),
      inc("Currently taking metformin", "medication", { field: "med:metformin", operator: "present", question: "Do you currently take metformin?" }),
      exc("Uses insulin", "medication", { field: "med:insulin", operator: "present", question: "Do you currently use insulin?" }),
      exc("Reduced kidney function (eGFR under 45)", "lab", { field: "egfr", operator: "lte", valueMax: 44.9, unit: "mL/min/1.73m²" }),
      exc("Heart attack in the past 6 months", "history", { field: "event:mi_6mo", operator: "present", question: "Have you had a heart attack in the past 6 months?" }),
      exc("Stroke in the past 6 months", "history", { field: "event:stroke_6mo", operator: "present", question: "Have you had a stroke in the past 6 months?" }),
      exc("Pregnant or breastfeeding", "history", { field: "pregnant_or_breastfeeding", operator: "present", question: "Are you currently pregnant or breastfeeding?" }),
      exc("Type 1 diabetes", "diagnosis", { field: "dx:type1_diabetes", operator: "present", question: "Have you been diagnosed with type 1 diabetes?" }),
      inc("Able to attend clinic visits in Boston", "logistics"),
    ],
  },
  // 2. KIDNEY-SHIELD (Commonwealth)
  {
    clinicEmail: "commonwealth@example.com",
    title: "KIDNEY-SHIELD",
    conditionCategory: "kidney",
    phases: [],
    studyType: "OBSERVATIONAL",
    irbProtocolNumber: "CMRC-2026-021 (fictional)",
    plainSummary:
      "Follows adults with type 2 diabetes and reduced kidney function to learn which " +
      "everyday health signals predict kidney changes.",
    whatIsInvolved: "4 visits over 1 year with blood and urine tests. No study medication.",
    logistics: { visit_count: 4, duration_weeks: 52, remote_option: false, compensation_mentioned: false },
    minAge: 50,
    maxAge: null,
    sex: "ALL",
    criteria: [
      inc("Diagnosed with type 2 diabetes", "diagnosis", { field: "dx:type2_diabetes", operator: "present", question: "Have you been diagnosed with type 2 diabetes?" }),
      inc("eGFR between 25 and 60", "lab", { field: "egfr", operator: "between", valueMin: 25, valueMax: 60, unit: "mL/min/1.73m²" }),
      exc("Currently on dialysis", "diagnosis", { field: "dx:dialysis", operator: "present", question: "Are you currently on dialysis?" }),
      exc("Type 1 diabetes", "diagnosis", { field: "dx:type1_diabetes", operator: "present", question: "Have you been diagnosed with type 1 diabetes?" }),
      exc("Active cancer", "diagnosis", { field: "dx:cancer_active", operator: "present", question: "Are you currently being treated for cancer?" }),
      inc("Able to attend 4 visits over 1 year", "logistics"),
    ],
  },
  // 3. STRIDE (Northshore)
  {
    clinicEmail: "northshore@example.com",
    title: "STRIDE",
    conditionCategory: "diabetes_metabolic",
    phases: [],
    studyType: "INTERVENTIONAL",
    irbProtocolNumber: "NERG-2026-007 (fictional)",
    plainSummary:
      "A 6-month program that uses your smartwatch or fitness ring to coach small daily " +
      "changes for adults with prediabetes.",
    whatIsInvolved:
      "2 clinic visits, a short weekly check-in on your phone, and keeping your wearable connected.",
    logistics: { visit_count: 2, duration_weeks: 26, remote_option: true, compensation_mentioned: false },
    minAge: 30,
    maxAge: 65,
    sex: "ALL",
    criteria: [
      inc("HbA1c between 5.7% and 6.4%", "lab", { field: "hba1c_pct", operator: "between", valueMin: 5.7, valueMax: 6.4, unit: "%" }),
      inc("BMI 25 or higher", "vital", { field: "bmi", operator: "gte", valueMin: 25, unit: "kg/m²" }),
      inc("Uses a smartwatch or fitness tracker", "lifestyle", { field: "has_wearable", operator: "present" }),
      exc("Diagnosed with type 2 diabetes", "diagnosis", { field: "dx:type2_diabetes", operator: "present", question: "Have you been diagnosed with type 2 diabetes?" }),
      exc("Pregnant or breastfeeding", "history", { field: "pregnant_or_breastfeeding", operator: "present", question: "Are you currently pregnant or breastfeeding?" }),
      exc("Bariatric (weight-loss) surgery", "history", { field: "event:bariatric_surgery", operator: "present", question: "Have you ever had weight-loss surgery?" }),
    ],
  },
  // 4. GLUCOSE-SLEEP (Pioneer Valley, unverified)
  {
    clinicEmail: "newclinic@example.com",
    title: "GLUCOSE-SLEEP",
    conditionCategory: "diabetes_metabolic",
    phases: [],
    studyType: "OBSERVATIONAL",
    irbProtocolNumber: "PVRA-2026-002 (fictional)",
    plainSummary:
      "Looks at how nightly sleep relates to blood sugar in adults with type 2 diabetes who " +
      "use a continuous glucose monitor.",
    whatIsInvolved: "Keep your glucose monitor and wearable connected for 3 months. No visits.",
    logistics: { visit_count: 0, duration_weeks: 12, remote_option: true, compensation_mentioned: false },
    minAge: 30,
    maxAge: 75,
    sex: "ALL",
    criteria: [
      inc("Diagnosed with type 2 diabetes", "diagnosis", { field: "dx:type2_diabetes", operator: "present", question: "Have you been diagnosed with type 2 diabetes?" }),
      inc("Uses a continuous glucose monitor", "lifestyle", { field: "has_cgm", operator: "present" }),
    ],
  },
];
