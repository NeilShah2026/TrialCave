"use server";

import { revalidatePath } from "next/cache";

import { getSessionUser, getMyPatient } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordConsent } from "@/lib/consent";
import { logAudit } from "@/lib/audit";

/** Approve an invitation with chosen share fields (B14.4.1). */
export async function respondToInvitation(
  invitationId: string,
  decision: "approve" | "decline" | "mute",
  fields: string[] = [],
  phone?: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  const patient = await getMyPatient();
  if (!user) return { ok: false, error: "Not signed in." };
  const admin = createAdminClient();

  const { data: inv } = await admin
    .from("invitations")
    .select("id, clinic_id, status")
    .eq("id", invitationId)
    .eq("patient_id", patient.id)
    .maybeSingle();
  if (!inv) return { ok: false, error: "Invitation not found." };

  if (decision === "approve") {
    if (!fields.includes("email") && !fields.includes("phone")) {
      return { ok: false, error: "Share at least an email or phone so the clinic can reach you." };
    }
    await admin
      .from("invitations")
      .update({ status: "approved", shared_fields: fields, responded_at: new Date().toISOString() })
      .eq("id", invitationId);
    if (phone && fields.includes("phone")) {
      await admin.from("patient_facts").insert({
        patient_id: patient.id,
        field: null,
        label: "Phone (for invitations)",
        value_text: phone,
        source: "self_report",
        status: "confirmed",
      });
    }
    await recordConsent(patient.id, user.userId, "share_invitation", true, { invitation_id: invitationId, fields });
    await logAudit({ actorUserId: user.userId, actorRole: "patient", action: "invitation.approved", targetType: "invitation", targetId: invitationId });
  } else if (decision === "decline") {
    await admin.from("invitations").update({ status: "declined", responded_at: new Date().toISOString() }).eq("id", invitationId);
    await logAudit({ actorUserId: user.userId, actorRole: "patient", action: "invitation.declined", targetType: "invitation", targetId: invitationId });
  } else {
    await admin.from("invitations").update({ status: "declined", responded_at: new Date().toISOString() }).eq("id", invitationId);
    await admin.from("muted_clinics").upsert({ patient_id: patient.id, clinic_id: inv.clinic_id }, { onConflict: "patient_id,clinic_id" });
    await logAudit({ actorUserId: user.userId, actorRole: "patient", action: "invitation.muted", targetType: "invitation", targetId: invitationId });
  }

  revalidatePath("/app/inbox");
  return { ok: true };
}

/** Stop sharing with a clinic (B14.3) — clinic loses contact access immediately. */
export async function stopSharing(invitationId: string): Promise<{ ok: boolean }> {
  const user = await getSessionUser();
  const patient = await getMyPatient();
  if (!user) return { ok: false };
  const admin = createAdminClient();
  await admin
    .from("invitations")
    .update({ status: "withdrawn", shared_fields: [] })
    .eq("id", invitationId)
    .eq("patient_id", patient.id);
  await logAudit({ actorUserId: user.userId, actorRole: "patient", action: "application.withdrawn", targetType: "invitation", targetId: invitationId });
  revalidatePath("/app/inbox");
  return { ok: true };
}
