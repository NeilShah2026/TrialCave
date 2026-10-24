import "server-only";

import { createHash } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { DEMO_MODE, MAX_UPLOAD_MB, hasAnthropic } from "@/lib/env";
import { extractRecord, type DocumentBlock } from "@/lib/ai/extractRecord";
import { mapFacts, type CurrentFactSnapshot } from "@/lib/ingest/mapFacts";
import { readDemoMarker, demoFixture } from "@/lib/demo/documents";
import type { ExtractedRecord } from "@/lib/ingest/types";
import { format } from "date-fns";

type Admin = ReturnType<typeof createAdminClient>;

export type MimeType = "application/pdf" | "image/jpeg" | "image/png" | "text/plain";

export interface UploadFile {
  fileName: string;
  bytes: Uint8Array;
}

export interface UploadOutcome {
  documentId: string;
  status: "needs_review" | "failed";
  factCount: number;
  reused: boolean;
}

/** Validate file type by magic bytes, not extension (B10.2). */
export function detectMime(bytes: Uint8Array): MimeType | null {
  if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return "application/pdf"; // %PDF
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png"; // PNG
  }
  return null;
}

/** A valid calendar date in YYYY-MM-DD that isn't in the future, else null. */
function safeDate(value: string | null | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T12:00:00`);
  if (Number.isNaN(d.getTime()) || d.getTime() > Date.now() + 24 * 60 * 60 * 1000) return null;
  if (d.getFullYear() < 1900) return null;
  return value;
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

async function loadCurrentFacts(admin: Admin, patientId: string): Promise<CurrentFactSnapshot[]> {
  const { data } = await admin
    .from("patient_current_facts")
    .select("field, value_num, value_bool, observed_at")
    .eq("patient_id", patientId);
  return (data ?? []).map((r) => ({
    field: r.field as string,
    valueNum: r.value_num,
    valueBool: r.value_bool,
    observedAt: r.observed_at,
  }));
}

/**
 * Extract from one or more files. Multi-photo capture passes several image
 * files; they're sent together so facts merge across pages (B10.4).
 * Uses the demo fixture when a demo-marked PDF is seen in demo mode.
 */
async function runExtraction(files: UploadFile[], mimes: MimeType[]): Promise<{ record: ExtractedRecord; source: "ai" | "fixture" }> {
  const today = format(new Date(), "yyyy-MM-dd");

  // Demo fixture path: a single demo-marked PDF.
  if (DEMO_MODE && files.length === 1 && mimes[0] === "application/pdf") {
    const marker = await readDemoMarker(files[0].bytes);
    if (marker) {
      return { record: demoFixture(marker.key, marker.date), source: "fixture" };
    }
  }

  if (!hasAnthropic()) {
    throw new Error("AI extraction is unavailable (no API key). Enter results by hand instead.");
  }

  const blocks: DocumentBlock[] = files.map((f, i) => {
    const mime = mimes[i];
    if (mime === "application/pdf") return { kind: "pdf", base64: toBase64(f.bytes) };
    if (mime === "image/jpeg") return { kind: "image", base64: toBase64(f.bytes), mediaType: "image/jpeg" };
    if (mime === "image/png") return { kind: "image", base64: toBase64(f.bytes), mediaType: "image/png" };
    return { kind: "text", text: new TextDecoder().decode(f.bytes) };
  });

  const record = await extractRecord(blocks, today);
  return { record, source: "ai" };
}

export interface UploadParams {
  patientId: string;
  userId: string;
  files: UploadFile[];
}

/**
 * Full upload pipeline (B10.2). Returns the document id; the client navigates to
 * the review screen. Multiple files (multi-photo capture) become one document.
 */
export async function ingestUpload(params: UploadParams): Promise<UploadOutcome> {
  const admin = createAdminClient();
  const { patientId, userId, files } = params;

  if (files.length === 0) throw new Error("No file provided.");
  if (files.length > 5) throw new Error("Please upload at most 5 pages at once.");

  const mimes: MimeType[] = [];
  for (const f of files) {
    const mime = detectMime(f.bytes);
    if (!mime) throw new Error("Please upload a PDF, JPG, or PNG.");
    if (f.bytes.length > MAX_UPLOAD_MB * 1024 * 1024) {
      throw new Error(`Each file must be under ${MAX_UPLOAD_MB} MB.`);
    }
    mimes.push(mime);
  }

  // Dedup on the first file's hash (a representative doc hash).
  const primaryHash = sha256(files[0].bytes);
  const { data: existing } = await admin
    .from("source_documents")
    .select("id, status")
    .eq("patient_id", patientId)
    .eq("sha256", primaryHash)
    .limit(1)
    .maybeSingle();
  if (existing) {
    if (existing.status === "failed" || existing.status === "processing") {
      // A failed or stuck attempt: clear it so the same file can be retried.
      await admin.from("patient_facts").delete().eq("document_id", existing.id).eq("status", "pending");
      await admin.from("source_documents").delete().eq("id", existing.id);
    } else {
      return { documentId: existing.id, status: "needs_review", factCount: 0, reused: true };
    }
  }

  // Insert the document row (processing).
  const primaryMime = mimes[0];
  const { data: doc, error: docErr } = await admin
    .from("source_documents")
    .insert({
      patient_id: patientId,
      origin: "upload",
      file_name: files[0].fileName,
      mime_type: primaryMime,
      size_bytes: files.reduce((s, f) => s + f.bytes.length, 0),
      sha256: primaryHash,
      status: "processing",
    })
    .select("id")
    .single();
  if (docErr || !doc) throw new Error(`Could not create document: ${docErr?.message}`);
  const documentId = doc.id;

  // Store files.
  const storagePaths: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const path = `${userId}/${documentId}/${i}-${files[i].fileName}`;
    await admin.storage.from("documents").upload(path, files[i].bytes, { contentType: mimes[i], upsert: true });
    storagePaths.push(path);
  }
  await admin.from("source_documents").update({ storage_path: storagePaths[0] }).eq("id", documentId);
  await logAudit({ actorUserId: userId, actorRole: "patient", action: "document.uploaded", targetType: "document", targetId: documentId });

  // Extract.
  let record: ExtractedRecord;
  let extractionSource: "ai" | "fixture";
  try {
    const result = await runExtraction(files, mimes);
    record = result.record;
    extractionSource = result.source;
  } catch (err) {
    await admin
      .from("source_documents")
      .update({ status: "failed", error: err instanceof Error ? err.message.slice(0, 500) : "Extraction failed" })
      .eq("id", documentId);
    await logAudit({ actorUserId: userId, actorRole: "patient", action: "document.extraction_failed", targetType: "document", targetId: documentId });
    return { documentId, status: "failed", factCount: 0, reused: false };
  }

  // AI output is untrusted: keep only real, non-future YYYY-MM-DD dates.
  record = {
    ...record,
    documentDate: safeDate(record.documentDate),
    facts: record.facts.map((f) => ({ ...f, date: safeDate(f.date) })),
  };

  // For text documents, drop facts whose quote isn't in the text (B10.4).
  let facts = record.facts;
  if (primaryMime === "text/plain") {
    const text = new TextDecoder().decode(files[0].bytes).toLowerCase().replace(/\s+/g, " ");
    facts = facts.filter((f) => text.includes(f.sourceQuote.toLowerCase().replace(/\s+/g, " ")));
  }

  // Map to vocabulary.
  const current = await loadCurrentFacts(admin, patientId);
  const mapped = mapFacts(facts, record.documentDate, current);

  // Insert pending facts.
  const factRows = mapped.map((m) => ({
    patient_id: patientId,
    field: m.field,
    label: m.label,
    value_num: m.valueNum,
    value_bool: m.valueBool,
    value_text: m.valueText,
    unit: m.unit,
    observed_at: m.observedAt,
    source: "document" as const,
    document_id: documentId,
    source_quote: m.sourceQuote,
    status: "pending" as const,
  }));
  if (factRows.length) {
    const { error: factErr } = await admin.from("patient_facts").insert(factRows);
    if (factErr) {
      await admin
        .from("source_documents")
        .update({ status: "failed", error: "Could not save the items we found." })
        .eq("id", documentId);
      return { documentId, status: "failed", factCount: 0, reused: false };
    }
  }

  await admin
    .from("source_documents")
    .update({
      status: "needs_review",
      document_date: record.documentDate,
      facility_name: record.facilityName,
      extraction_source: extractionSource,
    })
    .eq("id", documentId);
  await logAudit({ actorUserId: userId, actorRole: "patient", action: "document.extracted", targetType: "document", targetId: documentId, metadata: { factCount: factRows.length } });

  return { documentId, status: "needs_review", factCount: factRows.length, reused: false };
}
