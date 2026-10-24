"use server";

import { revalidatePath } from "next/cache";
import { format } from "date-fns";

import { getMyPatient, getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordConsent } from "@/lib/consent";
import { logAudit } from "@/lib/audit";
import { runMatchesForPatient } from "@/lib/matching/run";
import { getVocabField, vocabLabel } from "@/lib/matching/vocabulary";

/**
 * Answer a trial question (B9.2). If the criterion maps to a vocabulary field,
 * write a self-report fact (applies to every trial). Otherwise store a
 * per-criterion answer. Then re-match.
 */
export async function answerQuestion(
  trialId: string,
  criterionId: string,
  answer: "yes" | "no" | "unsure",
): Promise<{ ok: boolean; changeCount: number }> {
  const user = await getSessionUser();
  const patient = await getMyPatient();
  if (!user) return { ok: false, changeCount: 0 };
  const admin = createAdminClient();

  // Look up the criterion to see if it has a vocabulary field.
  const { data: crit } = await admin
    .from("trial_criteria")
    .select("field, operator")
    .eq("id", criterionId)
    .maybeSingle();

  if (crit?.field && getVocabField(crit.field)?.type === "bool" && answer !== "unsure") {
    // Write a self-report fact for the vocabulary field (applies everywhere).
    await admin.from("patient_facts").insert({
      patient_id: patient.id,
      field: crit.field,
      label: vocabLabel(crit.field),
      value_bool: answer === "yes",
      observed_at: format(new Date(), "yyyy-MM-dd"),
      source: "self_report",
      status: "confirmed",
    });
  } else {
    // Per-criterion answer.
    await admin.from("criterion_answers").upsert(
      { patient_id: patient.id, criterion_id: criterionId, answer },
      { onConflict: "patient_id,criterion_id" },
    );
  }

  const diff = await runMatchesForPatient(patient.id, { type: "answer", id: criterionId, label: "Your answer" });
  revalidatePath("/app");
  revalidatePath(`/app/matches/${trialId}`);
  return { ok: true, changeCount: diff.changeCount };
}

/** Apply to a clinic study with chosen share fields (B14.4.1). */
export async function applyToStudy(
  trialId: string,
  fields: string[],
  phone?: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  const patient = await getMyPatient();
  if (!user) return { ok: false, error: "Not signed in." };
  if (!fields.includes("email") && !fields.includes("phone")) {
    return { ok: false, error: "Share at least an email or phone so the study team can reach you." };
  }
  const admin = createAdminClient();

  const { data: trial } = await admin.from("trials").select("id, source").eq("id", trialId).maybeSingle();
  if (!trial || trial.source !== "clinic") return { ok: false, error: "This trial doesn't accept in-app applications." };

  const { error } = await admin.from("applications").upsert(
    { patient_id: patient.id, trial_id: trialId, shared_fields: fields, status: "submitted" },
    { onConflict: "patient_id,trial_id" },
  );
  if (error) return { ok: false, error: "Could not submit your application." };

  // Store phone as a fact if shared (not stored elsewhere).
  if (phone && fields.includes("phone")) {
    await admin.from("patient_facts").insert({
      patient_id: patient.id,
      field: null,
      label: "Phone (for applications)",
      value_text: phone,
      source: "self_report",
      status: "confirmed",
    });
  }

  await recordConsent(patient.id, user.userId, "share_application", true, { trial_id: trialId, fields });
  await logAudit({ actorUserId: user.userId, actorRole: "patient", action: "application.submitted", targetType: "trial", targetId: trialId, metadata: { fieldCount: fields.length } });
  revalidatePath(`/app/matches/${trialId}`);
  return { ok: true };
}

/** Mark all unseen match_changes as seen (B9.7). */
export async function markChangesSeen(): Promise<void> {
  const patient = await getMyPatient();
  const admin = createAdminClient();
  await admin
    .from("match_changes")
    .update({ seen_at: new Date().toISOString() })
    .eq("patient_id", patient.id)
    .is("seen_at", null);
  revalidatePath("/app");
}
