import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { INVITATION_EXPIRY_DAYS } from "@/lib/env";
import { computeOutreach } from "@/lib/outreach/eligible";

/**
 * Create invitations for all outreach-eligible patients of a study (B14.4.2).
 * Uses the study's stored IRB-approved invite_message. Returns the count sent.
 */
export async function sendInvitations(
  trialId: string,
  clinicId: string,
  actorUserId: string,
): Promise<{ sent: number; error?: string }> {
  const admin = createAdminClient();

  const { data: trial } = await admin
    .from("trials")
    .select("invite_message, invite_message_attested_at, study_status")
    .eq("id", trialId)
    .eq("clinic_id", clinicId)
    .maybeSingle();
  if (!trial) return { sent: 0, error: "Study not found." };
  if (!trial.invite_message || !trial.invite_message_attested_at) {
    return { sent: 0, error: "This study needs an IRB-attested invitation before you can send." };
  }

  // Verify the clinic is verified.
  const { data: clinic } = await admin.from("clinics").select("verified").eq("id", clinicId).maybeSingle();
  if (!clinic?.verified) return { sent: 0, error: "Invitations are disabled until TrialCave verifies your clinic." };

  const outreach = await computeOutreach(admin, trialId);
  if (outreach.eligiblePatientIds.length === 0) return { sent: 0, error: "No eligible people to invite right now." };

  const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const rows = outreach.eligiblePatientIds.map((pid) => ({
    trial_id: trialId,
    clinic_id: clinicId,
    patient_id: pid,
    status: "pending" as const,
    message: trial.invite_message,
    match_score: 0,
    shared_fields: [],
    expires_at: expiresAt,
  }));

  const { error } = await admin.from("invitations").upsert(rows, { onConflict: "trial_id,patient_id", ignoreDuplicates: true });
  if (error) return { sent: 0, error: error.message };

  await logAudit({ actorUserId, actorRole: "clinic", action: "invitation.sent", targetType: "trial", targetId: trialId, metadata: { count: rows.length } });
  return { sent: rows.length };
}

/** Lazily expire pending invitations past their expiry (B15). */
export async function expireStaleInvitations(scopeColumn: "patient_id" | "clinic_id", scopeId: string): Promise<void> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("invitations")
    .select("id")
    .eq(scopeColumn, scopeId)
    .eq("status", "pending")
    .lt("expires_at", new Date().toISOString());
  if (data && data.length) {
    await admin.from("invitations").update({ status: "expired" }).in("id", data.map((i) => i.id));
    for (const i of data) {
      await logAudit({ actorUserId: null, actorRole: null, action: "invitation.expired", targetType: "invitation", targetId: i.id });
    }
  }
}
