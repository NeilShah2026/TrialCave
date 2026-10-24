/**
 * Canonical share-field list (B14.4.1). Used by the Apply dialog, invitation
 * approval, the pre-screen summary, and server-side validation. Client-safe.
 */
export interface ShareField {
  key: string;
  label: string;
  /** Default when approving an invitation or applying. */
  defaultOn: boolean;
  sensitive?: boolean;
}

export const SHARE_FIELDS: ShareField[] = [
  { key: "first_name", label: "First name", defaultOn: true },
  { key: "last_name", label: "Last name", defaultOn: false },
  { key: "email", label: "Email", defaultOn: true },
  { key: "phone", label: "Phone", defaultOn: false },
  { key: "age", label: "Age", defaultOn: true },
  { key: "sex", label: "Sex", defaultOn: true },
  { key: "town", label: "Town", defaultOn: true },
  { key: "condition_summary", label: "Condition summary (diagnoses only)", defaultOn: true },
  { key: "labs", label: "Lab results used by this study", defaultOn: true },
  { key: "medications", label: "Medications used by this study", defaultOn: false },
  { key: "wearable_summary", label: "Wearable summary (30-day averages)", defaultOn: false },
  { key: "scans", label: "Scan type and date (no images)", defaultOn: false },
  { key: "reproductive_health", label: "Pregnancy/breastfeeding answers", defaultOn: false, sensitive: true },
];

export const SHARE_FIELD_KEYS = new Set(SHARE_FIELDS.map((f) => f.key));

export function shareFieldLabel(key: string): string {
  return SHARE_FIELDS.find((f) => f.key === key)?.label ?? key;
}

/** Keep only known share-field keys (server-side validation). */
export function cleanShareFields(fields: unknown): string[] {
  if (!Array.isArray(fields)) return [];
  return [...new Set(fields.filter((f): f is string => typeof f === "string" && SHARE_FIELD_KEYS.has(f)))];
}

/** Loose phone validation: 7–15 digits, common separators allowed. */
export function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/[\s().+-]/g, "");
  return /^\d{7,15}$/.test(digits);
}
