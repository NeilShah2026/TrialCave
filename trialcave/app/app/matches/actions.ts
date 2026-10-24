"use server";

import { revalidatePath } from "next/cache";
import { format } from "date-fns";
import { z } from "zod";

import { getMyPatient, getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordConsent } from "@/lib/consent";
import { logAudit } from "@/lib/audit";
import { runMatchesForPatient } from "@/lib/matching/run";
import { getVocabField, vocabLabel } from "@/lib/matching/vocabulary";
import { cleanShareFields, isValidPhone } from "@/lib/share-fields";

const answerSchema = z.enum(["yes", "no", "unsure"]);
const uuid = z.string().uuid();

/**
 * Answer a trial question (B9.2). If the criterion maps to a vocabulary field,
 * write a self-report fact (applies to every trial). Otherwise store a
 * per-criterion answer. Then re-match.
 */
export async function answerQuestion(
  trialId: string,
  criterionId: string,
  answer: "yes" | "no" | "unsure",
): Promise<{ ok: boolean; changeCount: number; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, changeCount: 0, error: "Please sign in again." };
  const patient = await getMyPatient();
  if (!answerSchema.safeParse(answer).success || !uuid.safeParse(criterionId).success || !uuid.safeParse(trialId).success) {
    return { ok: false, changeCount: 0, error: "That answer couldn't be saved." };
  }
  const admin = createAdminClient();

  // The criterion must belong to this trial.
  const { data: crit } = await admin
    .from("trial_criteria")
    .select("field, operator, trial_id")
    .eq("id", criterionId)
    .eq("trial_id", trialId)
    .maybeSingle();
  if (!crit) return { ok: false, changeCount: 0, error: "That question is no longer part of this study." };

  const vocab = crit.field ? getVocabField(crit.field) : undefined;
  if (vocab?.type === "bool" && !vocab.derived) {
    if (answer === "unsure") {
      // Withdraw earlier yes/no answers for this field; keep record-based facts.
      await admin
        .from("patient_facts")
        .update({ status: "rejected" })
        .eq("patient_id", patient.id)
        .eq("field", crit.field)
        .eq("source", "self_report")
        .eq("status", "confirmed");
      await admin.from("criterion_answers").upsert(
        { patient_id: patient.id, criterion_id: criterionId, answer, answered_at: new Date().toISOString() },
        { onConflict: "patient_id,criterion_id" },
      );
    } else {
      // Write a self-report fact for the vocabulary field (applies everywhere).
      const { error } = await admin.from("patient_facts").insert({
        patient_id: patient.id,
        field: crit.field,
        label: vocabLabel(crit.field as string),
        value_bool: answer === "yes",
        observed_at: format(new Date(), "yyyy-MM-dd"),
        source: "self_report",
        status: "confirmed",
      });
      if (error) return { ok: false, changeCount: 0, error: "Couldn't save your answer. Try again." };
    }
  } else {
    // Per-criterion answer.
    const { error } = await admin.from("criterion_answers").upsert(
      { patient_id: patient.id, criterion_id: criterionId, answer, answered_at: new Date().toISOString() },
      { onConflict: "patient_id,criterion_id" },
    );
    if (error) return { ok: false, changeCount: 0, error: "Couldn't save your answer. Try again." };
  }

  const diff = await runMatchesForPatient(patient.id, { type: "answer", id: criterionId, label: "Your answer" });
  revalidatePath("/app", "layout");
  return { ok: true, changeCount: diff.changeCount };
}

/** Apply to a clinic study with chosen share fields (B14.4.1). */
export async function applyToStudy(
  trialId: string,
  fields: string[],
  phone?: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Please sign in again." };
  const patient = await getMyPatient();
  if (!uuid.safeParse(trialId).success) return { ok: false, error: "Study not found." };

  const clean = cleanShareFields(fields);
  if (!clean.includes("email") && !clean.includes("phone")) {
    return { ok: false, error: "Share at least an email or phone so the study team can reach you." };
  }
  if (clean.includes("phone") && (!phone || !isValidPhone(phone))) {
    return { ok: false, error: "Enter a valid phone number, or uncheck Phone." };
  }
  const admin = createAdminClient();

  const { data: trial } = await admin
    .from("trials")
    .select("id, source, study_status, clinic_id, clinics(name, verified)")
    .eq("id", trialId)
    .maybeSingle();
  if (!trial || trial.source !== "clinic") return { ok: false, error: "This trial doesn't accept in-app applications." };
  if (trial.study_status !== "active") return { ok: false, error: "This study isn't accepting applications right now." };
  // DECISION: patients can only share data with clinics TrialCave has verified.
  const clinicRow = trial.clinics as unknown as { name: string; verified: boolean } | null;
  if (!clinicRow?.verified) {
    return { ok: false, error: "This clinic hasn't been verified by TrialCave yet, so applications are paused." };
  }

  // Don't overwrite a clinic's progress on an existing application.
  const { data: existing } = await admin
    .from("applications")
    .select("id, status")
    .eq("patient_id", patient.id)
    .eq("trial_id", trialId)
    .maybeSingle();
  if (existing && existing.status !== "withdrawn") {
    return { ok: false, error: "You've already applied to this study." };
  }

  const { error } = existing
    ? await admin
        .from("applications")
        .update({ shared_fields: clean, status: "submitted", created_at: new Date().toISOString() })
        .eq("id", existing.id)
    : await admin.from("applications").insert({ patient_id: patient.id, trial_id: trialId, shared_fields: clean, status: "submitted" });
  if (error) return { ok: false, error: "Could not submit your application." };

  // Store phone as a display-only fact if shared (not stored elsewhere).
  if (phone && clean.includes("phone")) {
    await admin.from("patient_facts").insert({
      patient_id: patient.id,
      field: null,
      label: "Phone (for applications)",
      value_text: phone.trim(),
      source: "self_report",
      status: "confirmed",
    });
  }

  await recordConsent(patient.id, user.userId, "share_application", true, { trial_id: trialId, fields: clean });
  await logAudit({ actorUserId: user.userId, actorRole: "patient", action: "application.submitted", targetType: "trial", targetId: trialId, metadata: { fieldCount: clean.length } });
  revalidatePath(`/app/matches/${trialId}`);
  return { ok: true };
}

/** Withdraw an application (B15): the clinic loses access to the shared fields. */
export async function withdrawApplication(trialId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Please sign in again." };
  const patient = await getMyPatient();
  const admin = createAdminClient();

  const { data: app } = await admin
    .from("applications")
    .select("id, status")
    .eq("patient_id", patient.id)
    .eq("trial_id", trialId)
    .maybeSingle();
  if (!app || app.status === "withdrawn") return { ok: false, error: "There's no active application to withdraw." };

  const { error } = await admin.from("applications").update({ status: "withdrawn", shared_fields: [] }).eq("id", app.id);
  if (error) return { ok: false, error: "Couldn't withdraw. Try again." };
  await recordConsent(patient.id, user.userId, "share_application", false, { trial_id: trialId });
  await logAudit({ actorUserId: user.userId, actorRole: "patient", action: "application.withdrawn", targetType: "application", targetId: app.id });
  revalidatePath(`/app/matches/${trialId}`);
  return { ok: true };
}

/** Mark the given match_changes as seen (B9.7). */
export async function markChangesSeen(ids?: string[]): Promise<void> {
  const patient = await getMyPatient();
  const admin = createAdminClient();
  let q = admin
    .from("match_changes")
    .update({ seen_at: new Date().toISOString() })
    .eq("patient_id", patient.id)
    .is("seen_at", null);
  if (ids && ids.length) q = q.in("id", ids.filter((id) => uuid.safeParse(id).success));
  await q;
  revalidatePath("/app");
}
