/**
 * Normalize a raw ClinicalTrials.gov study into our trial shape (B8.3).
 * Every JSON path is optional; validate and default safely.
 */

export type ConditionCategory =
  | "diabetes_metabolic"
  | "cardiology"
  | "kidney"
  | "oncology"
  | "neurology"
  | "other";

export interface TrialLocation {
  facility: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  status: string | null;
  lat: number | null;
  lon: number | null;
}

export interface TrialContact {
  name: string | null;
  role: string | null;
  phone: string | null;
  email: string | null;
}

export interface NormalizedTrial {
  nctId: string;
  title: string;
  officialTitle: string | null;
  overallStatus: string;
  ctgovLastUpdated: string | null;
  briefSummary: string | null;
  conditions: string[];
  phases: string[];
  studyType: string | null;
  enrollment: number | null;
  eligibilityText: string | null;
  sex: "ALL" | "FEMALE" | "MALE";
  minAgeYears: number | null;
  maxAgeYears: number | null;
  healthyVolunteers: boolean | null;
  sponsor: string | null;
  locations: TrialLocation[];
  contacts: TrialContact[];
  conditionCategory: ConditionCategory;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function get(obj: any, path: string): unknown {
  return path.split(".").reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** "18 Years", "6 Months", "52 Weeks", "30 Days" → years (B8.3). */
export function parseAgeToYears(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  const m = raw.trim().match(/^(\d+(?:\.\d+)?)\s*(year|month|week|day)s?$/i);
  if (!m) return null;
  const value = parseFloat(m[1]);
  const unit = m[2].toLowerCase();
  switch (unit) {
    case "year":
      return value;
    case "month":
      return Math.round((value / 12) * 100) / 100;
    case "week":
      return Math.round((value / 52) * 100) / 100;
    case "day":
      return Math.round((value / 365) * 100) / 100;
    default:
      return null;
  }
}

/** Unescape characters ClinicalTrials.gov escapes in criteria text (B8.3). */
export function unescapeCriteria(text: string): string {
  return text
    .replace(/\\>/g, ">")
    .replace(/\\</g, "<")
    .replace(/\\≥/g, "≥")
    .replace(/\\≤/g, "≤")
    .replace(/\\=/g, "=");
}

const CATEGORY_RULES: Array<{ category: ConditionCategory; keywords: string[] }> = [
  // Order matters: kidney beats diabetes when both appear (B8.2).
  { category: "kidney", keywords: ["kidney", "renal", "ckd", "nephropathy", "dialysis"] },
  { category: "diabetes_metabolic", keywords: ["diabetes", "glucose", "obesity", "metabolic", "insulin", "prediabetes"] },
  { category: "cardiology", keywords: ["heart", "cardio", "hypertension", "coronary", "cardiac"] },
  { category: "oncology", keywords: ["cancer", "tumor", "oncology", "carcinoma", "lymphoma", "leukemia"] },
  { category: "neurology", keywords: ["alzheimer", "parkinson", "neuro", "dementia", "epilepsy", "multiple sclerosis"] },
];

export function categorizeCondition(conditions: string[], title: string): ConditionCategory {
  const hay = `${conditions.join(" ")} ${title}`.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((k) => hay.includes(k))) return rule.category;
  }
  return "other";
}

function normalizeSex(v: unknown): "ALL" | "FEMALE" | "MALE" {
  if (v === "FEMALE" || v === "MALE") return v;
  return "ALL";
}

export function normalizeStudy(raw: unknown): NormalizedTrial | null {
  const nctId = asString(get(raw, "protocolSection.identificationModule.nctId"));
  const title = asString(get(raw, "protocolSection.identificationModule.briefTitle"));
  if (!nctId || !title) return null;

  const conditions = asStringArray(get(raw, "protocolSection.conditionsModule.conditions"));
  const eligibilityRaw = asString(get(raw, "protocolSection.eligibilityModule.eligibilityCriteria"));

  const locationsRaw = get(raw, "protocolSection.contactsLocationsModule.locations");
  const locations: TrialLocation[] = Array.isArray(locationsRaw)
    ? locationsRaw.map((l: unknown) => ({
        facility: asString(get(l, "facility")),
        city: asString(get(l, "city")),
        state: asString(get(l, "state")),
        zip: asString(get(l, "zip")),
        country: asString(get(l, "country")),
        status: asString(get(l, "status")),
        lat: asNumber(get(l, "geoPoint.lat")),
        lon: asNumber(get(l, "geoPoint.lon")),
      }))
    : [];

  const contactsRaw = get(raw, "protocolSection.contactsLocationsModule.centralContacts");
  const contacts: TrialContact[] = Array.isArray(contactsRaw)
    ? contactsRaw.map((c: unknown) => ({
        name: asString(get(c, "name")),
        role: asString(get(c, "role")),
        phone: asString(get(c, "phone")),
        email: asString(get(c, "email")),
      }))
    : [];

  const hv = get(raw, "protocolSection.eligibilityModule.healthyVolunteers");

  return {
    nctId,
    title,
    officialTitle: asString(get(raw, "protocolSection.identificationModule.officialTitle")),
    overallStatus: asString(get(raw, "protocolSection.statusModule.overallStatus")) ?? "RECRUITING",
    ctgovLastUpdated: asString(get(raw, "protocolSection.statusModule.lastUpdatePostDateStruct.date")),
    briefSummary: asString(get(raw, "protocolSection.descriptionModule.briefSummary")),
    conditions,
    phases: asStringArray(get(raw, "protocolSection.designModule.phases")),
    studyType: asString(get(raw, "protocolSection.designModule.studyType")),
    enrollment: asNumber(get(raw, "protocolSection.designModule.enrollmentInfo.count")),
    eligibilityText: eligibilityRaw ? unescapeCriteria(eligibilityRaw) : null,
    sex: normalizeSex(get(raw, "protocolSection.eligibilityModule.sex")),
    minAgeYears: parseAgeToYears(get(raw, "protocolSection.eligibilityModule.minimumAge")),
    maxAgeYears: parseAgeToYears(get(raw, "protocolSection.eligibilityModule.maximumAge")),
    healthyVolunteers: typeof hv === "boolean" ? hv : null,
    sponsor: asString(get(raw, "protocolSection.sponsorCollaboratorsModule.leadSponsor.name")),
    locations,
    contacts,
    conditionCategory: categorizeCondition(conditions, title),
  };
}

/** Keep Massachusetts sites first when displaying (B8.3). */
export function sortMassachusettsFirst(locations: TrialLocation[]): TrialLocation[] {
  return [...locations].sort((a, b) => {
    const aMa = a.state === "Massachusetts" ? 0 : 1;
    const bMa = b.state === "Massachusetts" ? 0 : 1;
    return aMa - bMa;
  });
}
