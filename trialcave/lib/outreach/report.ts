import "server-only";

import { differenceInYears, parseISO } from "date-fns";

import { createAdminClient } from "@/lib/supabase/admin";
import { getVocabField, vocabLabel } from "@/lib/matching/vocabulary";
import type { CriterionResult } from "@/lib/matching/types";

/**
 * Build the clinic-facing contact/pre-screen report (B14.4.3). Shows ONLY the
 * fields the patient shared. Lab values appear only if 'labs' shared; meds only
 * if 'medications' shared; reproductive criteria only if 'reproductive_health'
 * shared; AI-estimated results shown as "Not yet confirmed". Everything is
 * computed on the server after an ownership check.
 */

export interface ContactReportCriterion {
  plainText: string;
  kind: "inclusion" | "exclusion";
  icon: "pass" | "fail" | "unknown" | "na";
  detail: string;
}

export interface ContactReport {
  displayName: string; // shared first name, or "Participant #xxxxxx"
  contactMethod: string | null;
  town: string | null;
  age: number | null;
  sex: string | null;
  criteria: ContactReportCriterion[];
}

const LAB_CATEGORIES = new Set(["lab"]);

export async function buildContactReport(
  patientId: string,
  trialId: string,
  sharedFields: string[],
): Promise<ContactReport> {
  const admin = createAdminClient();
  const shared = new Set(sharedFields);

  const { data: patient } = await admin
    .from("patients")
    .select("display_name, date_of_birth, sex, town")
    .eq("id", patientId)
    .maybeSingle();

  const { data: profile } = await admin
    .from("profiles")
    .select("email")
    .eq("id", (await admin.from("patients").select("user_id").eq("id", patientId).maybeSingle()).data?.user_id ?? "")
    .maybeSingle();

  const firstName = patient?.display_name?.split(" ")[0] ?? null;
  const displayName = shared.has("first_name") && firstName ? firstName : `Participant #${patientId.slice(0, 6)}`;

  let contactMethod: string | null = null;
  if (shared.has("email") && profile?.email) contactMethod = profile.email;

  const age = patient?.date_of_birth ? differenceInYears(new Date(), parseISO(patient.date_of_birth)) : null;

  // Match details for the checklist.
  const { data: match } = await admin
    .from("match_results")
    .select("details")
    .eq("patient_id", patientId)
    .eq("trial_id", trialId)
    .maybeSingle();
  const details = (match?.details ?? []) as CriterionResult[];

  const criteria: ContactReportCriterion[] = details
    .filter((d) => d.status !== "na")
    .map((d) => {
      const vocab = d.field ? getVocabField(d.field) : undefined;
      const icon = d.source === "ai" ? "unknown" : d.status;

      let detail: string;
      if (vocab?.sensitive && !shared.has("reproductive_health")) {
        detail = "Not shared. Ask the participant directly.";
      } else if (d.source === "ai") {
        detail = "Not yet confirmed.";
      } else if (d.field && LAB_CATEGORIES.has(vocab?.category ?? "") && !shared.has("labs")) {
        detail = statusWord(d.status); // status only, no value
      } else if (d.field && vocab?.category === "medication" && !shared.has("medications")) {
        detail = statusWord(d.status);
      } else {
        detail = d.patientValue ? `${statusWord(d.status)} · ${d.patientValue}` : statusWord(d.status);
      }

      return { plainText: d.plainText, kind: d.kind, icon: icon as ContactReportCriterion["icon"], detail };
    });

  return {
    displayName,
    contactMethod,
    town: shared.has("town") ? patient?.town ?? null : null,
    age: shared.has("age") ? age : null,
    sex: shared.has("sex") ? patient?.sex ?? null : null,
    criteria,
  };
}

function statusWord(status: string): string {
  switch (status) {
    case "pass":
      return "Meets";
    case "fail":
      return "Does not meet";
    case "unknown":
      return "Not yet confirmed";
    default:
      return "—";
  }
}

export { vocabLabel };
