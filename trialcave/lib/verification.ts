/**
 * Data-integrity trust tiers (anti-fraud). Money only attaches to data with
 * provenance. See steering "Data-integrity trust tiers".
 */

export type VerificationTier = "verified" | "document_backed" | "self_reported";

export type FactSource =
  | "lab"
  | "wearable"
  | "self_report"
  | "portal"
  | "imaging"
  | "document"
  | "demo";

/**
 * Derive a fact's trust tier from its source.
 * - Device/portal/imaging/lab feeds and seeded demo data → verified (provenance).
 * - Uploaded/photographed documents → document_backed (evidence on file).
 * - Typed-in / yes-no answers → self_reported (matching only, never paid).
 */
export function verificationTier(source: FactSource): VerificationTier {
  switch (source) {
    case "wearable":
    case "portal":
    case "imaging":
    case "lab":
    case "demo":
      return "verified";
    case "document":
      return "document_backed";
    case "self_report":
    default:
      return "self_reported";
  }
}

/** Only these tiers may earn Enclave money / count toward donor payouts. */
export function isPayable(tier: VerificationTier): boolean {
  return tier === "verified" || tier === "document_backed";
}

/** Sources whose facts are eligible for the paid pool. */
export const PAYABLE_SOURCES: FactSource[] = ["wearable", "portal", "imaging", "lab", "demo", "document"];

export function isPayableSource(source: FactSource): boolean {
  return PAYABLE_SOURCES.includes(source);
}
