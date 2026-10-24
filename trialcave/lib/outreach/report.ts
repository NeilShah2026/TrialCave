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
  displayName: string; // shared first name, or "Participant #<reference>"
  contactMethod: string | null;
  phone: string | null;
  town: string | null;
  age: number | null;
  sex: string | null;
  conditions: string[] | null;
  criteria: ContactReportCriterion[];
}

const LAB_CATEGORIES = new Set(["lab", "vital"]);

/** Which share field (if any) governs a criterion's details. */
function governingField(category: string | undefined, field: string | null, criterionCategory: string): string | null {
  if (category === "reproductive") return "reproductive_health";
  if (category && LAB_CATEGORIES.has(category)) return "labs";
  if (category === "medication") return "medications";
  if (category === "wearable") return "wearable_summary";
  if (category === "demographic") return field === "sex" ? "sex" : "age";
  if (category === "condition" || category === "history") return "condition_summary";
  // Free-text criteria: reproductive wording is sensitive even without a field.
  if (/pregnan|breastfeed|lactat|contracept/i.test(criterionCategory)) return "reproductive_health";
  return null;
}

/**
 * @param referenceId A per-invitation/application reference shown when no name
 *   is shared. DECISION: never derive it from the patient id, so clinics can't
 *   link the same person across studies.
 */
export async function buildContactReport(
  patientId: string,
  trialId: string,
  sharedFields: string[],
  referenceId: string,
): Promise<ContactReport> {
  const admin = createAdminClient();
  const shared = new Set(sharedFields);

  const { data: patient } = await admin
    .from("patients")
    .select("user_id, display_name, date_of_birth, sex, town")
    .eq("id", patientId)
    .maybeSingle();

  let email: string | null = null;
  if (shared.has("email") && patient?.user_id) {
    const { data: profile } = await admin.from("profiles").select("email").eq("id", patient.user_id).maybeSingle();
    email = profile?.email ?? null;
  }

  let phone: string | null = null;
  if (shared.has("phone")) {
    const { data: phoneFact } = await admin
      .from("patient_facts")
      .select("value_text")
      .eq("patient_id", patientId)
      .is("field", null)
      .like("label", "Phone%")
      .eq("status", "confirmed")
      .order("created_at", { ascending: false })
      .limit(1);
    phone = phoneFact?.[0]?.value_text ?? null;
  }

  const names = (patient?.display_name ?? "").split(" ");
  const nameParts = [shared.has("first_name") ? names[0] : "", shared.has("last_name") ? names.slice(1).join(" ") : ""].filter(Boolean);
  const displayName = nameParts.length ? nameParts.join(" ") : `Participant #${referenceId}`;

  const age = patient?.date_of_birth ? differenceInYears(new Date(), parseISO(patient.date_of_birth)) : null;

  // Condition summary: confirmed diagnosis labels only.
  let conditions: string[] | null = null;
  if (shared.has("condition_summary")) {
    const { data: dx } = await admin
      .from("patient_current_facts")
      .select("field, label, value_bool")
      .eq("patient_id", patientId)
      .like("field", "dx:%")
      .eq("value_bool", true);
    conditions = (dx ?? []).map((d) => d.label as string);
  }

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
      const gov = governingField(vocab?.category, d.field, `${d.category} ${d.plainText}`);
      const allowed = gov === null || shared.has(gov);

      if (vocab?.sensitive || gov === "reproductive_health") {
        if (!shared.has("reproductive_health")) {
          return { plainText: d.plainText, kind: d.kind, icon: "unknown" as const, detail: "Not shared. Ask the participant directly." };
        }
      }
      if (d.source === "ai") {
        return { plainText: d.plainText, kind: d.kind, icon: "unknown" as const, detail: "Not yet confirmed." };
      }
      if (!allowed) {
        // The patient didn't share this kind of detail: show status only, no value.
        return { plainText: d.plainText, kind: d.kind, icon: d.status, detail: statusWord(d.status, d.kind) };
      }
      const detail = d.patientValue ? `${statusWord(d.status, d.kind)} · ${d.patientValue}` : statusWord(d.status, d.kind);
      return { plainText: d.plainText, kind: d.kind, icon: d.status, detail };
    });

  return {
    displayName,
    contactMethod: email,
    phone,
    town: shared.has("town") ? patient?.town ?? null : null,
    age: shared.has("age") ? age : null,
    sex: shared.has("sex") ? patient?.sex ?? null : null,
    conditions,
    criteria,
  };
}

function statusWord(status: string, kind: "inclusion" | "exclusion"): string {
  switch (status) {
    case "pass":
      return kind === "exclusion" ? "Doesn't apply" : "Meets";
    case "fail":
      return kind === "exclusion" ? "Excluded by this" : "Does not meet";
    case "unknown":
      return "Not yet confirmed";
    default:
      return "—";
  }
}

export { vocabLabel };
