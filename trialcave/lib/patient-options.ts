/** Option lists shared by onboarding, settings and the donor page. Client-safe. */
import { CATEGORY_LABELS } from "@/lib/categories";

export const TRAVEL_RADII = [10, 20, 30, 50] as const;

export const CONDITION_CATEGORIES = Object.entries(CATEGORY_LABELS)
  .filter(([value]) => value !== "other")
  .map(([value, label]) => ({ value, label }));

export const DATA_TYPES = [
  { value: "wearables", label: "Wearables" },
  { value: "labs", label: "Lab results" },
  { value: "imaging", label: "Scans" },
  { value: "history", label: "Health history" },
] as const;

export const RESEARCH_TYPES = [
  { value: "academic", label: "Academic" },
  { value: "pharma", label: "Drug companies" },
  { value: "ai", label: "Medical AI" },
  { value: "device", label: "Device makers" },
] as const;

export const DATA_TYPE_VALUES: string[] = DATA_TYPES.map((d) => d.value);
export const RESEARCH_TYPE_VALUES: string[] = RESEARCH_TYPES.map((r) => r.value);

export const CONNECTOR_SOURCES = [
  { value: "apple_health", label: "Apple Health", kind: "wearable" },
  { value: "google_health_connect", label: "Google Health Connect", kind: "wearable" },
  { value: "fitbit", label: "Fitbit", kind: "wearable" },
  { value: "oura", label: "Oura", kind: "wearable" },
  { value: "whoop", label: "Whoop", kind: "wearable" },
  { value: "dexcom", label: "Dexcom CGM", kind: "cgm" },
  { value: "patient_portal", label: "Patient portal", kind: "portal" },
] as const;

export type ConnectorSource = (typeof CONNECTOR_SOURCES)[number]["value"];

export function sourceLabel(source: string): string {
  switch (source) {
    case "self_report":
      return "Your answer";
    case "document":
      return "From a record";
    case "lab":
      return "Lab entry";
    case "wearable":
      return "Device";
    case "portal":
      return "Patient portal";
    case "imaging":
      return "Scan";
    case "demo":
      return "Sample data";
    default:
      return source;
  }
}
