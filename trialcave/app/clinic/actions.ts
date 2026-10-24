"use server";

import { revalidatePath } from "next/cache";

import { getSessionUser, getMyClinic, assertClinicOwnsTrial } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { sendInvitations as sendInvitesLib } from "@/lib/outreach/invite";
import { getOutreachCount } from "@/lib/outreach/eligible";
import { runMatchesForTrialLib } from "@/lib/matching/run-trial";
import { parseCriteria } from "@/lib/ai/parseCriteria";
import { fetchStudy } from "@/lib/ctgov/fetch";
import { normalizeStudy } from "@/lib/ctgov/normalize";
import { DEFAULT_INVITE_MESSAGE } from "@/lib/demo/studies";

export interface DraftCriterion {
  kind: "inclusion" | "exclusion";
  plainText: string;
  category: string;
  field: string | null;
  operator: string | null;
  valueMin: number | null;
  valueMax: number | null;
  valueText: string | null;
  unit: string | null;
  patientQuestion: string | null;
}

export interface StudyDraft {
  title: string;
  conditionCategory: string;
  plainSummary: string;
  whatIsInvolved: string;
  minAge: number | null;
  maxAge: number | null;
  sex: "ALL" | "FEMALE" | "MALE";
  criteria: DraftCriterion[];
}

/** Parse pasted text, a fetched NCT study, or (future) a PDF into a draft (B14.4 step 2). */
export async function parseProtocol(input: {
  title: string;
  conditions: string;
  eligibilityText?: string;
  nctId?: string;
}): Promise<{ ok: boolean; draft?: StudyDraft; error?: string }> {
  await getMyClinic();
  try {
    let title = input.title;
    let conditions = input.conditions.split(",").map((s) => s.trim()).filter(Boolean);
    let eligibilityText = input.eligibilityText ?? "";
    let minAge: number | null = null;
    let maxAge: number | null = null;
    let sex: "ALL" | "FEMALE" | "MALE" = "ALL";

    if (input.nctId) {
      const raw = await fetchStudy(input.nctId.trim());
      if (!raw) return { ok: false, error: "Couldn't find that NCT id." };
      const n = normalizeStudy(raw);
      if (!n) return { ok: false, error: "Couldn't read that study." };
      title = n.title;
      conditions = n.conditions;
      eligibilityText = n.eligibilityText ?? "";
      minAge = n.minAgeYears;
      maxAge = n.maxAgeYears;
      sex = n.sex;
    }

    const parsed = await parseCriteria({
      title,
      conditions,
      minAgeYears: minAge,
      maxAgeYears: maxAge,
      sex,
      briefSummary: null,
      eligibilityText,
    });

    return {
      ok: true,
      draft: {
        title,
        conditionCategory: "other",
        plainSummary: parsed.plain_summary,
        whatIsInvolved: parsed.what_is_involved,
        minAge,
        maxAge,
        sex,
        criteria: parsed.criteria.map((c) => ({
          kind: c.kind,
          plainText: c.plain_text,
          category: c.category,
          field: c.field,
          operator: c.operator,
          valueMin: c.value_min,
          valueMax: c.value_max,
          valueText: c.value_text,
          unit: c.unit,
          patientQuestion: c.patient_question,
        })),
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Parsing failed." };
  }
}

/** Save a study with its checklist + IRB attestation; activates it and re-matches (B14.4 step 4). */
export async function saveStudy(
  draft: StudyDraft,
  irbProtocolNumber: string,
  inviteMessage: string,
): Promise<{ ok: boolean; trialId?: string; error?: string }> {
  const user = await getSessionUser();
  const clinic = await getMyClinic();
  if (!user) return { ok: false, error: "Not signed in." };
  if (!irbProtocolNumber.trim()) return { ok: false, error: "An IRB protocol number is required." };

  const admin = createAdminClient();
  const { data: trial, error } = await admin
    .from("trials")
    .insert({
      source: "clinic",
      clinic_id: clinic.id,
      title: draft.title,
      plain_summary: draft.plainSummary,
      what_is_involved: draft.whatIsInvolved,
      conditions: [],
      condition_category: draft.conditionCategory,
      min_age_years: draft.minAge,
      max_age_years: draft.maxAge,
      sex: draft.sex,
      parse_status: "parsed",
      study_status: "active",
      irb_protocol_number: irbProtocolNumber,
      invite_message: inviteMessage || DEFAULT_INVITE_MESSAGE.replace("{study}", draft.title).replace("{clinic}", clinic.name),
      invite_message_attested_by: user.userId,
      invite_message_attested_at: new Date().toISOString(),
      locations: [{ facility: clinic.name, city: clinic.town, state: "MA", lat: clinic.lat, lon: clinic.lon, status: "RECRUITING" }],
    })
    .select("id")
    .single();
  if (error || !trial) return { ok: false, error: error?.message ?? "Could not save the study." };

  const criteriaRows = draft.criteria.map((c, i) => ({
    trial_id: trial.id,
    kind: c.kind,
    original_text: c.plainText,
    plain_text: c.plainText,
    category: c.category,
    field: c.field,
    operator: c.operator,
    value_min: c.valueMin,
    value_max: c.valueMax,
    value_text: c.valueText,
    unit: c.unit,
    machine_checkable: c.field !== null && c.operator !== null,
    patient_question: c.patientQuestion,
    sort_order: i,
  }));
  if (criteriaRows.length) await admin.from("trial_criteria").insert(criteriaRows);

  await logAudit({ actorUserId: user.userId, actorRole: "clinic", action: "study.created", targetType: "trial", targetId: trial.id });
  await runMatchesForTrialLib(trial.id);

  revalidatePath("/clinic");
  return { ok: true, trialId: trial.id };
}

export async function fetchOutreachCount(trialId: string): Promise<{ total: number; strong: number; possible: number; belowFloor: boolean }> {
  const clinic = await getMyClinic();
  await assertClinicOwnsTrial(clinic.id, trialId);
  return getOutreachCount(trialId);
}

export async function sendInvitations(trialId: string): Promise<{ ok: boolean; sent: number; error?: string }> {
  const user = await getSessionUser();
  const clinic = await getMyClinic();
  if (!user) return { ok: false, sent: 0, error: "Not signed in." };
  await assertClinicOwnsTrial(clinic.id, trialId);
  const res = await sendInvitesLib(trialId, clinic.id, user.userId);
  revalidatePath(`/clinic/studies/${trialId}`);
  return { ok: !res.error, sent: res.sent, error: res.error };
}

export async function updateApplicationStatus(
  applicationId: string,
  status: "under_review" | "contacted" | "not_a_fit",
): Promise<{ ok: boolean }> {
  const user = await getSessionUser();
  const clinic = await getMyClinic();
  if (!user) return { ok: false };
  const admin = createAdminClient();
  // Confirm the application's trial belongs to this clinic.
  const { data: app } = await admin
    .from("applications")
    .select("id, trials!inner(clinic_id)")
    .eq("id", applicationId)
    .maybeSingle();
  const ownerClinic = (app?.trials as unknown as { clinic_id: string } | undefined)?.clinic_id;
  if (ownerClinic !== clinic.id) return { ok: false };
  await admin.from("applications").update({ status }).eq("id", applicationId);
  revalidatePath("/clinic");
  return { ok: true };
}
