import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Role } from "@/lib/types";

/**
 * Actions we log to audit_log (B7.7). Keep this list in sync with the spec; the
 * union keeps call sites honest.
 */
export type AuditAction =
  | "document.uploaded"
  | "document.email_received"
  | "document.email_rejected"
  | "document.extracted"
  | "document.extraction_failed"
  | "facts.confirmed"
  | "facts.rejected"
  | "consent.recorded"
  | "invitation.sent"
  | "invitation.approved"
  | "invitation.declined"
  | "invitation.muted"
  | "invitation.expired"
  | "application.submitted"
  | "application.withdrawn"
  | "contact.viewed"
  | "application.viewed"
  | "study.created"
  | "study.criteria_saved"
  | "enclave.run"
  | "enclave.export"
  | "enclave.raw_download_blocked"
  | "data.exported"
  | "data.corrected"
  | "data.deleted"
  | "account.deleted"
  | "document.deleted"
  | "source.connected"
  | "settings.updated"
  | "donor.enabled"
  | "donor.disabled"
  | "research.withdrawn"
  | "clinic.verified"
  | "project.approved"
  | "project.rejected"
  | "trials.synced"
  | "demo.reset";

export interface AuditEntry {
  actorUserId: string | null;
  actorRole: Role | null;
  action: AuditAction;
  targetType?: string | null;
  targetId?: string | null;
  /** Ids and counts only. Never patient facts or document text (B0 rule 10). */
  metadata?: Record<string, unknown>;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("audit_log").insert({
    actor_user_id: entry.actorUserId,
    actor_role: entry.actorRole,
    action: entry.action,
    target_type: entry.targetType ?? null,
    target_id: entry.targetId ?? null,
    metadata: entry.metadata ?? {},
  });
  if (error) {
    // Auditing must never crash the primary action, but we surface it in logs.
    console.error("[audit] failed to write entry", entry.action, error.message);
  }
}
