"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { getMyPatient, getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { recordConsent } from "@/lib/consent";
import { logAudit } from "@/lib/audit";
import { DEMO_MODE } from "@/lib/env";
import { DEMO_ACCOUNTS } from "@/lib/demo/accounts";

type Admin = ReturnType<typeof createAdminClient>;

/** Withdraw from research (B14.3 Privacy): excluded from every future Enclave run. */
export async function withdrawFromResearch(): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Please sign in again." };
  const patient = await getMyPatient();
  const admin = createAdminClient();

  const { error } = await admin.from("patients").update({ research_withdrawn: true }).eq("id", patient.id);
  if (error) return { ok: false, error: "Couldn't withdraw. Try again." };
  await admin.from("research_consents").update({ allowed: false, updated_at: new Date().toISOString() }).eq("patient_id", patient.id);
  await recordConsent(patient.id, user.userId, "research", false, { all: true });
  await logAudit({ actorUserId: user.userId, actorRole: "patient", action: "research.withdrawn", targetType: "patient", targetId: patient.id });
  revalidatePath("/app", "layout");
  return { ok: true };
}

/** Undo a research withdrawal. Consents stay off until the Donor turns them back on. */
export async function rejoinResearch(): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Please sign in again." };
  const patient = await getMyPatient();
  const admin = createAdminClient();
  const { error } = await admin.from("patients").update({ research_withdrawn: false }).eq("id", patient.id);
  if (error) return { ok: false, error: "Couldn't update. Try again." };
  revalidatePath("/app", "layout");
  return { ok: true };
}

/** Remove every stored file under one bucket folder (documents/<uid>/<doc>/...). */
async function removeFolder(admin: Admin, bucket: string, folder: string): Promise<void> {
  const { data: entries } = await admin.storage.from(bucket).list(folder, { limit: 1000 });
  if (!entries || entries.length === 0) return;
  const files: string[] = [];
  for (const e of entries) {
    // Folders come back without an id; recurse one level (doc folders).
    if (e.id == null) {
      const { data: inner } = await admin.storage.from(bucket).list(`${folder}/${e.name}`, { limit: 1000 });
      for (const i of inner ?? []) files.push(`${folder}/${e.name}/${i.name}`);
    } else {
      files.push(`${folder}/${e.name}`);
    }
  }
  if (files.length) await admin.storage.from(bucket).remove(files);
}

/**
 * Delete all health data (B14.3). Keeps donor_earnings (payment records) and
 * consent_events (proof of what was agreed), as the Privacy Notice states.
 */
async function wipeHealthData(admin: Admin, patientId: string, userId: string): Promise<void> {
  await removeFolder(admin, "documents", userId);
  await removeFolder(admin, "scans", userId);
  await removeFolder(admin, "labs", userId);

  // Withdraw open sharing first so clinics lose access immediately.
  await admin.from("applications").update({ status: "withdrawn", shared_fields: [] }).eq("patient_id", patientId).neq("status", "withdrawn");
  await admin
    .from("invitations")
    .update({ status: "withdrawn", shared_fields: [] })
    .eq("patient_id", patientId)
    .in("status", ["pending", "approved"]);

  await admin.from("patient_facts").delete().eq("patient_id", patientId);
  await admin.from("source_documents").delete().eq("patient_id", patientId);
  await admin.from("wearable_daily").delete().eq("patient_id", patientId);
  await admin.from("connected_sources").delete().eq("patient_id", patientId);
  await admin.from("scans").delete().eq("patient_id", patientId);
  await admin.from("criterion_answers").delete().eq("patient_id", patientId);
  await admin.from("match_changes").delete().eq("patient_id", patientId);
  await admin.from("match_results").delete().eq("patient_id", patientId);
  await admin.from("research_consents").delete().eq("patient_id", patientId);
  await admin.from("contact_preferences").update({ allow_invitations: false, condition_categories: [] }).eq("patient_id", patientId);
  await admin.from("patients").update({ is_donor: false, research_withdrawn: true }).eq("id", patientId);
}

/** Delete my health data (type DELETE to confirm). */
export async function deleteMyHealthData(confirmText: string): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Please sign in again." };
  if (confirmText.trim() !== "DELETE") return { ok: false, error: 'Type DELETE to confirm.' };
  const patient = await getMyPatient();
  const admin = createAdminClient();

  try {
    await wipeHealthData(admin, patient.id, user.userId);
  } catch {
    return { ok: false, error: "Something went wrong while deleting. Try again; nothing was shared." };
  }
  await logAudit({ actorUserId: user.userId, actorRole: "patient", action: "data.deleted", targetType: "patient", targetId: patient.id });
  revalidatePath("/app", "layout");
  return { ok: true };
}

/**
 * Delete my account: health data as above, then the login. DECISION: payment
 * records and consent events must be kept (B14.3), and both reference the
 * patient row with ON DELETE CASCADE, so the patient row is kept but
 * anonymized and unlinked from the login instead of being deleted.
 */
export async function deleteMyAccount(confirmText: string): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Please sign in again." };
  if (confirmText.trim() !== "DELETE") return { ok: false, error: 'Type DELETE to confirm.' };
  // DECISION: shared demo logins can't be deleted, or the demo breaks for
  // everyone. Their data can still be wiped and restored with Admin → Reset demo.
  if (DEMO_MODE && DEMO_ACCOUNTS.some((a) => a.email === user.email)) {
    return { ok: false, error: "Demo accounts can't be deleted. You can delete the health data instead, and an admin can reset the demo." };
  }
  const patient = await getMyPatient();
  const admin = createAdminClient();

  try {
    await wipeHealthData(admin, patient.id, user.userId);
    await admin.from("muted_clinics").delete().eq("patient_id", patient.id);
    await admin
      .from("patients")
      .update({
        user_id: null,
        display_name: "Deleted account",
        preferred_language: "en",
        inbox_token: null,
        email_ingest_enabled: false,
      })
      .eq("id", patient.id);
  } catch {
    return { ok: false, error: "Something went wrong while deleting. Try again." };
  }

  await logAudit({ actorUserId: user.userId, actorRole: "patient", action: "account.deleted", targetType: "patient", targetId: patient.id });

  const { error } = await admin.auth.admin.deleteUser(user.userId);
  if (error) return { ok: false, error: "Your data was deleted, but we couldn't close the login. Contact us to finish." };

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/?deleted=1");
}
