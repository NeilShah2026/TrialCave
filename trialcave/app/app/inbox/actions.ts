"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSessionUser, getMyPatient } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordConsent } from "@/lib/consent";
import { logAudit } from "@/lib/audit";
import { cleanShareFields, isValidPhone } from "@/lib/share-fields";

const decisionSchema = z.enum(["approve", "decline", "mute"]);

/** Approve an invitation with chosen share fields (B14.4.1), decline, or mute. */
export async function respondToInvitation(
  invitationId: string,
  decision: "approve" | "decline" | "mute",
  fields: string[] = [],
  phone?: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Please sign in again." };
  const patient = await getMyPatient();
  if (!decisionSchema.safeParse(decision).success || !z.string().uuid().safeParse(invitationId).success) {
    return { ok: false, error: "That response couldn't be saved." };
  }
  const admin = createAdminClient();

  const { data: inv } = await admin
    .from("invitations")
    .select("id, clinic_id, status, expires_at, clinics(name)")
    .eq("id", invitationId)
    .eq("patient_id", patient.id)
    .maybeSingle();
  if (!inv) return { ok: false, error: "Invitation not found." };
  if (inv.status !== "pending") return { ok: false, error: `This invitation is already ${inv.status}.` };
  if (new Date(inv.expires_at) < new Date()) {
    await admin.from("invitations").update({ status: "expired" }).eq("id", invitationId);
    return { ok: false, error: "This invitation has expired." };
  }
  const now = new Date().toISOString();

  if (decision === "approve") {
    const clean = cleanShareFields(fields);
    if (!clean.includes("email") && !clean.includes("phone")) {
      return { ok: false, error: "Share at least an email or phone so the clinic can reach you." };
    }
    if (clean.includes("phone") && (!phone || !isValidPhone(phone))) {
      return { ok: false, error: "Enter a valid phone number, or uncheck Phone." };
    }
    const { error } = await admin
      .from("invitations")
      .update({ status: "approved", shared_fields: clean, responded_at: now })
      .eq("id", invitationId);
    if (error) return { ok: false, error: "Couldn't save your response. Try again." };
    if (phone && clean.includes("phone")) {
      await admin.from("patient_facts").insert({
        patient_id: patient.id,
        field: null,
        label: "Phone (for invitations)",
        value_text: phone.trim(),
        source: "self_report",
        status: "confirmed",
      });
    }
    await recordConsent(patient.id, user.userId, "share_invitation", true, { invitation_id: invitationId, fields: clean });
    await logAudit({ actorUserId: user.userId, actorRole: "patient", action: "invitation.approved", targetType: "invitation", targetId: invitationId });
  } else {
    const { error } = await admin.from("invitations").update({ status: "declined", responded_at: now }).eq("id", invitationId);
    if (error) return { ok: false, error: "Couldn't save your response. Try again." };
    if (decision === "mute") {
      await admin.from("muted_clinics").upsert({ patient_id: patient.id, clinic_id: inv.clinic_id }, { onConflict: "patient_id,clinic_id" });
    }
    await logAudit({
      actorUserId: user.userId,
      actorRole: "patient",
      action: decision === "mute" ? "invitation.muted" : "invitation.declined",
      targetType: "invitation",
      targetId: invitationId,
    });
  }

  revalidatePath("/app", "layout");
  return { ok: true };
}

/** Stop sharing with a clinic (B14.3) — the clinic loses contact access immediately. */
export async function stopSharing(invitationId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Please sign in again." };
  const patient = await getMyPatient();
  const admin = createAdminClient();
  const { data: inv } = await admin
    .from("invitations")
    .select("id, status")
    .eq("id", invitationId)
    .eq("patient_id", patient.id)
    .maybeSingle();
  if (!inv || inv.status !== "approved") return { ok: false, error: "You're not sharing anything with this clinic." };

  const { error } = await admin.from("invitations").update({ status: "withdrawn", shared_fields: [] }).eq("id", invitationId);
  if (error) return { ok: false, error: "Couldn't stop sharing. Try again." };
  await recordConsent(patient.id, user.userId, "share_invitation", false, { invitation_id: invitationId });
  await logAudit({ actorUserId: user.userId, actorRole: "patient", action: "invitation.declined", targetType: "invitation", targetId: invitationId, metadata: { stoppedSharing: true } });
  revalidatePath("/app", "layout");
  return { ok: true };
}
