"use server";

import { revalidatePath } from "next/cache";

import { getSessionUser, getMyClinic, assertClinicOwnsTrial } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { sendInvitations as sendInvitesLib } from "@/lib/outreach/invite";
import { getOutreachCount, type OutreachCount } from "@/lib/outreach/eligible";
import { runMatchesForTrialLib } from "@/lib/matching/run-trial";
import { parseCriteria } from "@/lib/ai/parseCriteria";
import { fetchStudy } from "@/lib/ctgov/fetch";
import { normalizeStudy } from "@/lib/ctgov/normalize";
import { DEFAULT_INVITE_MESSAGE } from "@/lib/demo/studies";
import { getVocabField } from "@/lib/matching/vocabulary";
import { hasAnthropic } from "@/lib/env";
import { z } from "zod";

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
  conditions?: string[];
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
}): Promise<{ ok: boolean; draft?: StudyDraft; error?: string; rawText?: string }> {
  await getMyClinic();
  if (input.nctId && !/^NCT\d{8}$/i.test(input.nctId.trim())) {
    return { ok: false, error: "NCT ids look like NCT01234567." };
  }
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

    // Without an AI key, still prefill what we can and let the clinic type the checklist.
    if (!hasAnthropic()) {
      return {
        ok: false,
        error: "AI parsing isn't available here. We filled in what we could. Add the checklist by hand.",
        rawText: eligibilityText,
        draft: {
          title,
          conditionCategory: "other",
          conditions,
          plainSummary: "",
          whatIsInvolved: "",
          minAge: minAge != null ? Math.max(18, Math.round(minAge)) : null,
          maxAge: maxAge != null ? Math.round(maxAge) : null,
          sex,
          criteria: [],
        },
      };
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
      rawText: eligibilityText,
      draft: {
        title,
        conditionCategory: "other",
        conditions,
        plainSummary: parsed.plain_summary,
        whatIsInvolved: parsed.what_is_involved,
        minAge: minAge != null ? Math.max(18, Math.round(minAge)) : null,
        maxAge: maxAge != null ? Math.round(maxAge) : null,
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
    console.error("[study] parse failed", err instanceof Error ? err.message : "");
    return { ok: false, error: "We couldn't read those criteria automatically. Add the checklist by hand." };
  }
}

/** Save a study with its checklist + IRB attestation; activates it and re-matches (B14.4 step 4). */
const OPERATORS = ["gte", "lte", "between", "eq", "present", "absent"] as const;

const draftSchema = z.object({
  title: z.string().trim().min(3, "Give the study a title.").max(200),
  conditionCategory: z.enum(["diabetes_metabolic", "cardiology", "kidney", "oncology", "neurology", "other"]),
  conditions: z.array(z.string().trim().max(100)).max(20).optional(),
  plainSummary: z.string().max(2000),
  whatIsInvolved: z.string().max(1000),
  minAge: z.number().int().min(18).max(120).nullable(),
  maxAge: z.number().int().min(18).max(120).nullable(),
  sex: z.enum(["ALL", "FEMALE", "MALE"]),
  criteria: z
    .array(
      z.object({
        kind: z.enum(["inclusion", "exclusion"]),
        plainText: z.string().trim().min(3).max(500),
        category: z.string().max(40),
        field: z.string().nullable(),
        operator: z.enum(OPERATORS).nullable(),
        valueMin: z.number().finite().nullable(),
        valueMax: z.number().finite().nullable(),
        valueText: z.string().max(100).nullable(),
        unit: z.string().max(30).nullable(),
        patientQuestion: z.string().max(300).nullable(),
      }),
    )
    .min(1, "Add at least one eligibility criterion.")
    .max(80),
});

export async function saveStudy(
  draftInput: StudyDraft,
  irbProtocolNumber: string,
  inviteMessage: string,
  attested = false,
): Promise<{ ok: boolean; trialId?: string; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Please sign in again." };
  const clinic = await getMyClinic();
  if (!irbProtocolNumber.trim()) return { ok: false, error: "An IRB protocol number is required." };
  if (!attested) return { ok: false, error: "Confirm that your IRB approved the invitation and study text." };

  const parsedDraft = draftSchema.safeParse(draftInput);
  if (!parsedDraft.success) {
    return { ok: false, error: parsedDraft.error.issues[0]?.message ?? "Check the study details and try again." };
  }
  const draft = parsedDraft.data;
  if (draft.minAge !== null && draft.maxAge !== null && draft.minAge > draft.maxAge) {
    return { ok: false, error: "The minimum age is higher than the maximum age." };
  }
  // Only vocabulary fields can be machine-checked; anything else becomes a question.
  const criteria = draft.criteria.map((c) => {
    const vocab = c.field ? getVocabField(c.field) : undefined;
    const field = vocab ? c.field : null;
    const operator = field ? c.operator : null;
    return { ...c, field, operator, unit: field ? (c.unit ?? vocab?.unit ?? null) : null };
  });

  const admin = createAdminClient();
  const { data: trial, error } = await admin
    .from("trials")
    .insert({
      source: "clinic",
      clinic_id: clinic.id,
      title: draft.title,
      plain_summary: draft.plainSummary,
      what_is_involved: draft.whatIsInvolved,
      conditions: draft.conditions ?? [],
      condition_category: draft.conditionCategory,
      min_age_years: draft.minAge,
      max_age_years: draft.maxAge,
      sex: draft.sex,
      parse_status: "parsed",
      study_status: "active",
      irb_protocol_number: irbProtocolNumber.trim().slice(0, 60),
      invite_message: inviteMessage.trim().slice(0, 2000) || DEFAULT_INVITE_MESSAGE.replace("{study}", draft.title).replace("{clinic}", clinic.name),
      invite_message_attested_by: user.userId,
      invite_message_attested_at: new Date().toISOString(),
      locations: [{ facility: clinic.name, city: clinic.town, state: "MA", lat: clinic.lat, lon: clinic.lon, status: "RECRUITING" }],
    })
    .select("id")
    .single();
  if (error || !trial) return { ok: false, error: error?.message ?? "Could not save the study." };

  const criteriaRows = criteria.map((c, i) => ({
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
  const { error: critErr } = await admin.from("trial_criteria").insert(criteriaRows);
  if (critErr) {
    await admin.from("trials").delete().eq("id", trial.id);
    return { ok: false, error: "Could not save the checklist. Try again." };
  }

  await logAudit({ actorUserId: user.userId, actorRole: "clinic", action: "study.created", targetType: "trial", targetId: trial.id });
  try {
    await runMatchesForTrialLib(trial.id);
  } catch (err) {
    // The study is saved; matching can be retried by reopening it.
    console.error("[study] matching failed", err instanceof Error ? err.message : "");
  }

  revalidatePath("/clinic");
  return { ok: true, trialId: trial.id };
}

export async function fetchOutreachCount(trialId: string): Promise<OutreachCount> {
  const clinic = await getMyClinic();
  await assertClinicOwnsTrial(clinic.id, trialId);
  return getOutreachCount(trialId);
}

export async function sendInvitations(trialId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Please sign in again." };
  const clinic = await getMyClinic();
  try {
    await assertClinicOwnsTrial(clinic.id, trialId);
  } catch {
    return { ok: false, error: "You don't have access to this study." };
  }
  // DECISION (B15): one send per study per 24 hours.
  const admin = createAdminClient();
  const { data: recent } = await admin
    .from("invitations")
    .select("id")
    .eq("trial_id", trialId)
    .gt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .limit(1);
  if (recent && recent.length) return { ok: false, error: "Invitations for this study were sent in the last 24 hours. Try again tomorrow." };

  const res = await sendInvitesLib(trialId, clinic.id, user.userId);
  revalidatePath(`/clinic/studies/${trialId}`);
  revalidatePath("/clinic");
  // The exact number sent is never returned to the browser (small-count floor).
  return { ok: !res.error, error: res.error };
}

const APPLICATION_STATUSES = ["under_review", "contacted", "not_a_fit"] as const;

export async function updateApplicationStatus(
  applicationId: string,
  status: "under_review" | "contacted" | "not_a_fit",
): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Please sign in again." };
  const clinic = await getMyClinic();
  if (!(APPLICATION_STATUSES as readonly string[]).includes(status)) return { ok: false, error: "Unknown status." };
  const admin = createAdminClient();
  // Confirm the application's trial belongs to this clinic.
  const { data: app } = await admin
    .from("applications")
    .select("id, status, trial_id, trials!inner(clinic_id)")
    .eq("id", applicationId)
    .maybeSingle();
  const ownerClinic = (app?.trials as unknown as { clinic_id: string } | undefined)?.clinic_id;
  if (!app || ownerClinic !== clinic.id) return { ok: false, error: "Application not found." };
  // The patient withdrew: the clinic can't re-open it.
  if (app.status === "withdrawn") return { ok: false, error: "The participant withdrew this application." };
  const { error } = await admin.from("applications").update({ status }).eq("id", applicationId);
  if (error) return { ok: false, error: "Could not update. Try again." };
  await logAudit({ actorUserId: user.userId, actorRole: "clinic", action: "application.viewed", targetType: "application", targetId: applicationId, metadata: { statusSet: status } });
  revalidatePath(`/clinic/applications/${applicationId}`);
  revalidatePath(`/clinic/studies/${app.trial_id}`);
  return { ok: true };
}

/**
 * Close or reopen a study. Closed studies stop matching new patients into
 * outreach, can't send invitations, and don't accept applications.
 */
export async function setStudyStatus(trialId: string, status: "active" | "closed"): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Please sign in again." };
  const clinic = await getMyClinic();
  if (status !== "active" && status !== "closed") return { ok: false, error: "Unknown status." };
  try {
    await assertClinicOwnsTrial(clinic.id, trialId);
  } catch {
    return { ok: false, error: "You don't have access to this study." };
  }
  const admin = createAdminClient();
  const { error } = await admin.from("trials").update({ study_status: status }).eq("id", trialId);
  if (error) return { ok: false, error: "Couldn't update the study. Try again." };
  await logAudit({ actorUserId: user.userId, actorRole: "clinic", action: "study.criteria_saved", targetType: "trial", targetId: trialId, metadata: { studyStatus: status } });
  // Closing removes it from patients' matches; reopening adds it back.
  await runMatchesForTrialLib(trialId);
  revalidatePath(`/clinic/studies/${trialId}`);
  revalidatePath("/clinic");
  return { ok: true };
}
