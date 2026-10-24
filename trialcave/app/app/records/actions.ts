"use server";

import { revalidatePath } from "next/cache";
import { format, parseISO, isValid, isAfter, subDays } from "date-fns";
import { z } from "zod";

import { getMyPatient, getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { withinRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { ingestUpload, type UploadFile } from "@/lib/ingest/upload";
import { runMatchesForPatient } from "@/lib/matching/run";
import { renderDemoPdf } from "@/lib/demo/documents";
import { DEMO_MODE } from "@/lib/env";
import { getVocabField, vocabLabel } from "@/lib/matching/vocabulary";

export interface UploadResult {
  ok: boolean;
  documentId?: string;
  status?: "needs_review" | "failed";
  error?: string;
}

/** Parse a YYYY-MM-DD date as a local calendar date (avoids the UTC off-by-one). */
function localDate(iso: string): Date {
  return parseISO(iso);
}

/**
 * Upload one or more files (multi-photo capture). Returns the document id so the
 * client can navigate to the review screen.
 */
export async function uploadDocument(formData: FormData): Promise<UploadResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Please sign in again." };
  const patient = await getMyPatient();

  const entries = formData.getAll("files");
  const files: UploadFile[] = [];
  for (const e of entries) {
    if (e instanceof File && e.size > 0) {
      files.push({ fileName: e.name || "upload", bytes: new Uint8Array(await e.arrayBuffer()) });
    }
  }
  if (files.length === 0) return { ok: false, error: "Choose at least one file or photo." };
  if (files.length > 5) return { ok: false, error: "Add up to 5 pages at a time." };

  const allowed = await withinRateLimit({
    table: "source_documents",
    column: "patient_id",
    value: patient.id,
    windowMs: 60 * 60 * 1000,
    max: RATE_LIMITS.uploadPerHour,
  });
  if (!allowed) return { ok: false, error: "You've uploaded a lot recently. Try again in a bit." };

  try {
    const outcome = await ingestUpload({ patientId: patient.id, userId: user.userId, files });
    revalidatePath("/app/records");
    return { ok: true, documentId: outcome.documentId, status: outcome.status };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Upload failed." };
  }
}

export interface FactDecision {
  factId: string;
  decision: "confirm" | "reject";
  /** Optional edited value (number or boolean). */
  editValueNum?: number | null;
  editValueBool?: boolean | null;
}

const decisionSchema = z.array(
  z.object({
    factId: z.string().uuid(),
    decision: z.enum(["confirm", "reject"]),
    editValueNum: z.number().finite().nullish(),
    editValueBool: z.boolean().nullish(),
  }),
);

/**
 * Apply the patient's confirm/edit/reject decisions (B10.6), mark the document
 * reviewed, re-match, and return the change count for the "what changed" banner.
 */
export async function reviewDocumentFacts(
  documentId: string,
  decisions: FactDecision[],
): Promise<{ ok: boolean; changeCount: number; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, changeCount: 0, error: "Please sign in again." };
  const patient = await getMyPatient();
  const parsed = decisionSchema.safeParse(decisions);
  if (!parsed.success) return { ok: false, changeCount: 0, error: "Something in the form wasn't valid. Reload and try again." };
  const admin = createAdminClient();

  // Confirm ownership of the document.
  const { data: doc } = await admin
    .from("source_documents")
    .select("id, facility_name, document_date")
    .eq("id", documentId)
    .eq("patient_id", patient.id)
    .maybeSingle();
  if (!doc) return { ok: false, changeCount: 0, error: "Document not found." };

  // Only facts from this document, owned by this patient, can be decided here.
  const { data: docFacts } = await admin
    .from("patient_facts")
    .select("id, field")
    .eq("document_id", documentId)
    .eq("patient_id", patient.id);
  const factFields = new Map((docFacts ?? []).map((f) => [f.id as string, f.field as string | null]));

  let confirmed = 0;
  let rejected = 0;
  for (const d of parsed.data) {
    if (!factFields.has(d.factId)) continue;
    if (d.decision === "reject") {
      await admin.from("patient_facts").update({ status: "rejected" }).eq("id", d.factId);
      rejected++;
      continue;
    }
    const update: Record<string, unknown> = { status: "confirmed" };
    const field = factFields.get(d.factId);
    const vocab = field ? getVocabField(field) : undefined;
    if (d.editValueNum != null) {
      if (vocab?.plausible && (d.editValueNum < vocab.plausible.min || d.editValueNum > vocab.plausible.max)) {
        return {
          ok: false,
          changeCount: 0,
          error: `${vocabLabel(field ?? "")} of ${d.editValueNum} looks off. Check the number and try again.`,
        };
      }
      update.value_num = d.editValueNum;
    }
    if (d.editValueBool != null) update.value_bool = d.editValueBool;
    await admin.from("patient_facts").update(update).eq("id", d.factId);
    confirmed++;
  }

  // Anything the patient didn't decide on stays out of matching.
  const decided = new Set(parsed.data.map((d) => d.factId));
  const undecided = [...factFields.keys()].filter((id) => !decided.has(id));
  if (undecided.length) {
    await admin.from("patient_facts").update({ status: "rejected" }).in("id", undecided).eq("status", "pending");
  }

  await admin.from("source_documents").update({ status: "reviewed" }).eq("id", documentId);
  await logAudit({ actorUserId: user.userId, actorRole: "patient", action: "facts.confirmed", targetType: "document", targetId: documentId, metadata: { confirmed } });
  if (rejected) await logAudit({ actorUserId: user.userId, actorRole: "patient", action: "facts.rejected", targetType: "document", targetId: documentId, metadata: { rejected } });

  const facility = doc.facility_name ?? "your records";
  const dateLabel = doc.document_date ? format(localDate(doc.document_date), "MMM d") : "recent";
  const diff = await runMatchesForPatient(patient.id, {
    type: "document",
    id: documentId,
    label: `Your ${dateLabel} visit (${facility})`,
  });

  revalidatePath("/app", "layout");
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
  if (!user) return { ok: false, changeCount: 0, error: "Please sign in again." };
  const patient = await getMyPatient();
  if (!Array.isArray(labs) || labs.length === 0) return { ok: false, changeCount: 0, error: "Enter at least one value." };

  const rows = [];
  for (const l of labs) {
    const vocab = getVocabField(l.field);
    if (!vocab || vocab.type !== "number" || vocab.derived || !(vocab.category === "lab" || vocab.category === "vital")) {
      return { ok: false, changeCount: 0, error: "One of those fields isn't something we track." };
    }
    if (!Number.isFinite(l.value)) return { ok: false, changeCount: 0, error: `Enter a number for ${vocab.label}.` };
    if (vocab.plausible && (l.value < vocab.plausible.min || l.value > vocab.plausible.max)) {
      return {
        ok: false,
        changeCount: 0,
        error: `${vocab.label} should be between ${vocab.plausible.min} and ${vocab.plausible.max}${vocab.unit ? ` ${vocab.unit}` : ""}.`,
      };
    }
    const date = localDate(l.observedAt);
    if (!isValid(date) || isAfter(date, new Date())) {
      return { ok: false, changeCount: 0, error: "Pick a test date that isn't in the future." };
    }
    rows.push({
      patient_id: patient.id,
      field: l.field,
      label: vocab.label,
      value_num: l.value,
      unit: vocab.unit,
      observed_at: l.observedAt,
      // Typed-in values are self-reported (trust tier): matching only, never paid.
      source: "self_report" as const,
      status: "confirmed" as const,
    });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("patient_facts").insert(rows);
  if (error) return { ok: false, changeCount: 0, error: "Could not save your results. Try again." };

  const diff = await runMatchesForPatient(patient.id, { type: "lab_entry", id: "manual", label: "Lab results you entered" });
  revalidatePath("/app", "layout");
  return { ok: true, changeCount: diff.changeCount };
}

/**
 * Manual self-input of a yes/no health-history fact (B14.3 Health history).
 * `value === null` means "Not sure": earlier self-reported answers for that
 * field are withdrawn so they no longer count.
 */
export async function setHistoryFact(
  field: string,
  value: boolean | null,
): Promise<{ ok: boolean; changeCount: number; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, changeCount: 0, error: "Please sign in again." };
  const patient = await getMyPatient();

  const vocab = getVocabField(field);
  if (!vocab || vocab.type !== "bool" || vocab.derived) {
    return { ok: false, changeCount: 0, error: "That question isn't available." };
  }
  const admin = createAdminClient();

  if (value === null) {
    await admin
      .from("patient_facts")
      .update({ status: "rejected" })
      .eq("patient_id", patient.id)
      .eq("field", field)
      .eq("source", "self_report")
      .eq("status", "confirmed");
  } else {
    // DECISION: keep the earliest known date for diagnoses so "years with
    // diabetes" isn't reset to 0 by a yes/no answer.
    let observedAt = format(new Date(), "yyyy-MM-dd");
    if (value && field.startsWith("dx:")) {
      const { data: earlier } = await admin
        .from("patient_facts")
        .select("observed_at")
        .eq("patient_id", patient.id)
        .eq("field", field)
        .eq("value_bool", true)
        .eq("status", "confirmed")
        .not("observed_at", "is", null)
        .order("observed_at", { ascending: true })
        .limit(1);
      if (earlier?.[0]?.observed_at) observedAt = earlier[0].observed_at as string;
    }
    const { error } = await admin.from("patient_facts").insert({
      patient_id: patient.id,
      field,
      label: vocab.label,
      value_bool: value,
      observed_at: observedAt,
      source: "self_report",
      status: "confirmed",
    });
    if (error) return { ok: false, changeCount: 0, error: "Could not save your answer. Try again." };
  }

  const diff = await runMatchesForPatient(patient.id, { type: "profile_edit", id: field, label: "A health history update" });
  revalidatePath("/app", "layout");
  return { ok: true, changeCount: diff.changeCount };
}

/**
 * Correct a confirmed fact (B15 editFact): insert a corrected copy and retire
 * the old one, so the history stays auditable. Pass null to remove the fact.
 */
export async function editFact(
  factId: string,
  value: { num?: number; bool?: boolean } | null,
): Promise<{ ok: boolean; changeCount: number; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, changeCount: 0, error: "Please sign in again." };
  const patient = await getMyPatient();
  if (!z.string().uuid().safeParse(factId).success) return { ok: false, changeCount: 0, error: "Fact not found." };
  const admin = createAdminClient();

  const { data: fact } = await admin
    .from("patient_facts")
    .select("id, field, label, unit, observed_at, value_num, value_bool, source")
    .eq("id", factId)
    .eq("patient_id", patient.id)
    .eq("status", "confirmed")
    .maybeSingle();
  if (!fact) return { ok: false, changeCount: 0, error: "Fact not found." };
  if (fact.source === "wearable" || fact.source === "portal") {
    return { ok: false, changeCount: 0, error: "Values from connected devices can't be edited. Disconnect the device instead." };
  }

  if (value !== null) {
    const vocab = fact.field ? getVocabField(fact.field) : undefined;
    const insert: Record<string, unknown> = {
      patient_id: patient.id,
      field: fact.field,
      label: fact.label,
      unit: fact.unit,
      observed_at: fact.observed_at,
      source: "self_report",
      status: "confirmed",
    };
    if (vocab?.type === "number") {
      if (value.num == null || !Number.isFinite(value.num)) return { ok: false, changeCount: 0, error: "Enter a number." };
      if (vocab.plausible && (value.num < vocab.plausible.min || value.num > vocab.plausible.max)) {
        return { ok: false, changeCount: 0, error: `${vocab.label} should be between ${vocab.plausible.min} and ${vocab.plausible.max}.` };
      }
      insert.value_num = value.num;
    } else if (vocab?.type === "bool") {
      if (typeof value.bool !== "boolean") return { ok: false, changeCount: 0, error: "Choose Yes or No." };
      insert.value_bool = value.bool;
    } else {
      return { ok: false, changeCount: 0, error: "This item can only be removed, not edited." };
    }
    const { error } = await admin.from("patient_facts").insert(insert);
    if (error) return { ok: false, changeCount: 0, error: "Could not save the correction." };
  }

  await admin.from("patient_facts").update({ status: "rejected" }).eq("id", factId);
  await logAudit({ actorUserId: user.userId, actorRole: "patient", action: "data.corrected", targetType: "fact", targetId: factId, metadata: { removed: value === null } });

  const diff = await runMatchesForPatient(patient.id, { type: "profile_edit", id: fact.field ?? "fact", label: "A correction to your profile" });
  revalidatePath("/app", "layout");
  return { ok: true, changeCount: diff.changeCount };
}

/** Delete a document and its file; optionally remove the facts it produced (B15). */
export async function deleteDocument(
  documentId: string,
  alsoFacts: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Please sign in again." };
  const patient = await getMyPatient();
  const admin = createAdminClient();

  const { data: doc } = await admin
    .from("source_documents")
    .select("id")
    .eq("id", documentId)
    .eq("patient_id", patient.id)
    .maybeSingle();
  if (!doc) return { ok: false, error: "Document not found." };

  // Remove every stored page for this document.
  const folder = `${user.userId}/${documentId}`;
  const { data: objects } = await admin.storage.from("documents").list(folder);
  if (objects && objects.length) {
    await admin.storage.from("documents").remove(objects.map((o) => `${folder}/${o.name}`));
  }

  let factCount = 0;
  if (alsoFacts) {
    const { data: removed } = await admin
      .from("patient_facts")
      .delete()
      .eq("document_id", documentId)
      .eq("patient_id", patient.id)
      .select("id");
    factCount = removed?.length ?? 0;
  } else {
    // Pending facts from a deleted document can never be reviewed, so drop them.
    await admin.from("patient_facts").delete().eq("document_id", documentId).eq("status", "pending");
  }

  const { error } = await admin.from("source_documents").delete().eq("id", documentId);
  if (error) return { ok: false, error: "Could not delete the document." };

  await logAudit({ actorUserId: user.userId, actorRole: "patient", action: "document.deleted", targetType: "document", targetId: documentId, metadata: { factsRemoved: factCount } });
  if (factCount > 0) {
    await runMatchesForPatient(patient.id, { type: "profile_edit", id: documentId, label: "A record you deleted" });
  }
  revalidatePath("/app", "layout");
  return { ok: true };
}

/** Short-lived signed URL to view the original file (B14.3 Records "View original"). */
export async function getDocumentUrl(documentId: string): Promise<{ ok: boolean; url?: string; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Please sign in again." };
  const patient = await getMyPatient();
  const admin = createAdminClient();
  const { data: doc } = await admin
    .from("source_documents")
    .select("storage_path")
    .eq("id", documentId)
    .eq("patient_id", patient.id)
    .maybeSingle();
  if (!doc?.storage_path) return { ok: false, error: "The original file isn't available." };
  const { data, error } = await admin.storage.from("documents").createSignedUrl(doc.storage_path, 60);
  if (error || !data) return { ok: false, error: "The original file isn't available." };
  return { ok: true, url: data.signedUrl };
}

/** Demo-only: render a sample visit summary for download (B10.7). */
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
