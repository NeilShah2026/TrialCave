"use server";

import { revalidatePath } from "next/cache";

import { getMyPatient, getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { ingestUpload, type UploadFile } from "@/lib/ingest/upload";
import { runMatchesForPatient } from "@/lib/matching/run";
import { renderDemoPdf } from "@/lib/demo/documents";
import { DEMO_MODE } from "@/lib/env";
import { vocabLabel } from "@/lib/matching/vocabulary";
import { format, subDays } from "date-fns";

export interface UploadResult {
  ok: boolean;
  documentId?: string;
  status?: "needs_review" | "failed";
  error?: string;
}

/**
 * Upload one or more files (multi-photo capture). Returns the document id so the
 * client can navigate to the review screen.
 */
export async function uploadDocument(formData: FormData): Promise<UploadResult> {
  const user = await getSessionUser();
  const patient = await getMyPatient();
  if (!user) return { ok: false, error: "Not signed in." };

  const entries = formData.getAll("files");
  const files: UploadFile[] = [];
  for (const e of entries) {
    if (e instanceof File) {
      files.push({ fileName: e.name || "upload", bytes: new Uint8Array(await e.arrayBuffer()) });
    }
  }
  if (files.length === 0) return { ok: false, error: "Choose at least one file or photo." };

  try {
    const outcome = await ingestUpload({ patientId: patient.id, userId: user.userId, files });
    return { ok: true, documentId: outcome.documentId, status: outcome.status };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Upload failed." };
  }
}

export interface FactDecision {
  factId: string;
  decision: "confirm" | "reject";
  /** Optional edited value (number or boolean or text). */
  editValueNum?: number | null;
  editValueBool?: boolean | null;
}

/**
 * Apply the patient's confirm/edit/reject decisions (B10.6), mark the document
 * reviewed, re-match, and return the change count for the "what changed" banner.
 */
export async function reviewDocumentFacts(
  documentId: string,
  decisions: FactDecision[],
): Promise<{ ok: boolean; changeCount: number; error?: string }> {
  const user = await getSessionUser();
  const patient = await getMyPatient();
  if (!user) return { ok: false, changeCount: 0, error: "Not signed in." };
  const admin = createAdminClient();

  // Confirm ownership of the document.
  const { data: doc } = await admin
    .from("source_documents")
    .select("id, facility_name, document_date")
    .eq("id", documentId)
    .eq("patient_id", patient.id)
    .maybeSingle();
  if (!doc) return { ok: false, changeCount: 0, error: "Document not found." };

  let confirmed = 0;
  let rejected = 0;
  for (const d of decisions) {
    if (d.decision === "reject") {
      await admin.from("patient_facts").update({ status: "rejected" }).eq("id", d.factId).eq("patient_id", patient.id);
      rejected++;
    } else {
      const update: Record<string, unknown> = { status: "confirmed" };
      if (d.editValueNum !== undefined && d.editValueNum !== null) update.value_num = d.editValueNum;
      if (d.editValueBool !== undefined && d.editValueBool !== null) update.value_bool = d.editValueBool;
      await admin.from("patient_facts").update(update).eq("id", d.factId).eq("patient_id", patient.id);
      confirmed++;
    }
  }

  await admin.from("source_documents").update({ status: "reviewed" }).eq("id", documentId);
  await logAudit({ actorUserId: user.userId, actorRole: "patient", action: "facts.confirmed", targetType: "document", targetId: documentId, metadata: { confirmed } });
  if (rejected) await logAudit({ actorUserId: user.userId, actorRole: "patient", action: "facts.rejected", targetType: "document", targetId: documentId, metadata: { rejected } });

  const facility = doc.facility_name ?? "your records";
  const dateLabel = doc.document_date ? format(new Date(doc.document_date), "MMM d") : "recent";
  const diff = await runMatchesForPatient(patient.id, {
    type: "document",
    id: documentId,
    label: `Your ${dateLabel} visit (${facility})`,
  });

  revalidatePath("/app");
  revalidatePath("/app/records");
  return { ok: true, changeCount: diff.changeCount };
}

/** Manual self-input of lab results (B14.3 Labs tab / B10.5 fields). */
export interface ManualLab {
  field: string;
  value: number;
  observedAt: string;
}

export async function addLabResults(labs: ManualLab[]): Promise<{ ok: boolean; changeCount: number; error?: string }> {
  const user = await getSessionUser();
  const patient = await getMyPatient();
  if (!user) return { ok: false, changeCount: 0, error: "Not signed in." };
  const admin = createAdminClient();

  const rows = labs.map((l) => ({
    patient_id: patient.id,
    field: l.field,
    label: vocabLabel(l.field),
    value_num: l.value,
    unit: null,
    observed_at: l.observedAt,
    source: "self_report" as const,
    status: "confirmed" as const,
  }));
  if (rows.length === 0) return { ok: true, changeCount: 0 };
  const { error } = await admin.from("patient_facts").insert(rows);
  if (error) return { ok: false, changeCount: 0, error: error.message };

  const diff = await runMatchesForPatient(patient.id, { type: "lab_entry", id: "manual", label: "Lab results you entered" });
  revalidatePath("/app");
  return { ok: true, changeCount: diff.changeCount };
}

/** Manual self-input of a yes/no health-history fact (B14.3 Health history). */
export async function setHistoryFact(field: string, value: boolean): Promise<{ ok: boolean; changeCount: number }> {
  const user = await getSessionUser();
  const patient = await getMyPatient();
  if (!user) return { ok: false, changeCount: 0 };
  const admin = createAdminClient();

  await admin.from("patient_facts").insert({
    patient_id: patient.id,
    field,
    label: vocabLabel(field),
    value_bool: value,
    observed_at: format(new Date(), "yyyy-MM-dd"),
    source: "self_report",
    status: "confirmed",
  });
  const diff = await runMatchesForPatient(patient.id, { type: "profile_edit", id: field, label: "A health history update" });
  revalidatePath("/app");
  return { ok: true, changeCount: diff.changeCount };
}

/** Demo-only: render Maria's sample visit summary for download (B10.7). */
export async function getDemoDocument(): Promise<{ ok: boolean; base64?: string; fileName?: string; error?: string }> {
  if (!DEMO_MODE) return { ok: false, error: "Demo mode is off." };
  const patient = await getMyPatient();
  // Use Maria's doc for her; others get a generic sample visit summary.
  const key = patient.displayName.includes("James") ? "james-lab-report" : "maria-visit-summary";
  const docDate = subDays(new Date(), key === "maria-visit-summary" ? 4 : 10);
  const bytes = await renderDemoPdf(key, docDate);
  return {
    ok: true,
    base64: Buffer.from(bytes).toString("base64"),
    fileName: key === "maria-visit-summary" ? "sample-visit-summary.pdf" : "sample-lab-report.pdf",
  };
}
