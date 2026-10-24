import "server-only";

import { createHash } from "node:crypto";

import { CONSENT_VERSION } from "@/lib/env";
import { logAudit } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";

export type ConsentType =
  | "terms"
  | "privacy_notice"
  | "donor_agreement"
  | "research"
  | "contact"
  | "email_ingest"
  | "share_application"
  | "share_invitation";

/**
 * The exact text shown for each consent screen. The hash of this text is stored
 * in consent_events as proof of what the patient agreed to (B7.8, C3.4). Demo
 * text; real versions are reviewed by counsel before launch (C4).
 */
export const CONSENT_TEXT: Record<ConsentType, string> = {
  terms:
    "I agree to the TrialCave Terms of Service. TrialCave is for adults 18 and older. " +
    "TrialCave does not provide medical advice, and the study team always makes the final " +
    "eligibility decision.",
  privacy_notice:
    "I have read the TrialCave Privacy Notice. My health data stays in my vault, nothing is " +
    "shared without my approval, and TrialCave never sells personal data. I can download, " +
    "correct, delete, or withdraw my data at any time.",
  donor_agreement:
    "I agree to the Data Donor Agreement. Donating is voluntary and does not affect trial " +
    "matching. My de-identified data stays inside the Enclave, researchers only ever receive " +
    "aggregate results, and I can withdraw at any time. Donor paychecks are thank-you payments, " +
    "not wages, and may be taxable.",
  research:
    "I allow my donated data of this type to be used in aggregate analyses for this kind of " +
    "research inside the Enclave. I can turn this off at any time, and it only affects future analyses.",
  contact:
    "I allow verified research clinics to invite me when I meet a study's criteria. Clinics never " +
    "see who I am until I approve an invitation, and I choose exactly which fields to share.",
  email_ingest:
    "I want to add records by forwarding emails to my personal TrialCave address. Only emails sent " +
    "from my account email are accepted, and I review every item before it is used.",
  share_application:
    "I choose to share the selected fields with this study team by applying to their study. I can " +
    "withdraw my application at any time.",
  share_invitation:
    "I approve this invitation and choose to share the selected fields with this clinic. I can stop " +
    "sharing at any time.",
};

export function hashText(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Records a consent decision (B7.8). Inserts an append-only consent_events row
 * with the current version and a hash of the exact text shown, then audits it.
 */
export async function recordConsent(
  patientId: string,
  actorUserId: string,
  consentType: ConsentType,
  granted: boolean,
  scope: Record<string, unknown> = {},
): Promise<void> {
  const admin = createAdminClient();
  const text = CONSENT_TEXT[consentType];

  const { error } = await admin.from("consent_events").insert({
    patient_id: patientId,
    consent_type: consentType,
    consent_version: CONSENT_VERSION,
    text_sha256: hashText(text),
    granted,
    scope,
  });
  if (error) {
    throw new Error(`Failed to record consent (${consentType}): ${error.message}`);
  }

  await logAudit({
    actorUserId,
    actorRole: "patient",
    action: "consent.recorded",
    targetType: "consent",
    targetId: consentType,
    metadata: { granted, version: CONSENT_VERSION, scope },
  });
}
