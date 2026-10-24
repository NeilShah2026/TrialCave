"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { syncTrials } from "@/lib/ctgov/sync";
import { parsePendingTrials } from "@/lib/ctgov/parse";
import { seedDemo } from "@/lib/demo/seed";
import { runMatchesForAllPatients } from "@/lib/matching/run";
import { DEMO_MODE, hasAnthropic } from "@/lib/env";

type Result = { ok: boolean; error?: string };
const uuid = z.string().uuid();

export async function verifyClinic(clinicId: string, verified: boolean): Promise<Result> {
  const user = await requireRole("admin");
  if (!uuid.safeParse(clinicId).success || typeof verified !== "boolean") return { ok: false, error: "Invalid request." };
  const admin = createAdminClient();
  const { error } = await admin.from("clinics").update({ verified }).eq("id", clinicId);
  if (error) return { ok: false, error: "Couldn't update the clinic." };
  if (!verified) {
    // Unverifying stops outreach immediately: pending invitations are withdrawn.
    await admin.from("invitations").update({ status: "withdrawn" }).eq("clinic_id", clinicId).eq("status", "pending");
  }
  await logAudit({ actorUserId: user.userId, actorRole: "admin", action: "clinic.verified", targetType: "clinic", targetId: clinicId, metadata: { verified } });
  revalidatePath("/admin");
  return { ok: true };
}

export async function setIrbOnFile(clinicId: string, onFile: boolean): Promise<Result> {
  const user = await requireRole("admin");
  if (!uuid.safeParse(clinicId).success || typeof onFile !== "boolean") return { ok: false, error: "Invalid request." };
  const admin = createAdminClient();
  const { error } = await admin.from("clinics").update({ irb_on_file: onFile }).eq("id", clinicId);
  if (error) return { ok: false, error: "Couldn't update the clinic." };
  await logAudit({ actorUserId: user.userId, actorRole: "admin", action: "clinic.verified", targetType: "clinic", targetId: clinicId, metadata: { irbOnFile: onFile } });
  revalidatePath("/admin");
  return { ok: true };
}

export async function setProjectStatus(projectId: string, status: "approved" | "rejected" | "pending"): Promise<Result> {
  const user = await requireRole("admin");
  if (!uuid.safeParse(projectId).success || !["approved", "rejected", "pending"].includes(status)) {
    return { ok: false, error: "Invalid request." };
  }
  const admin = createAdminClient();
  const { error } = await admin.from("research_projects").update({ status }).eq("id", projectId);
  if (error) return { ok: false, error: "Couldn't update the project." };
  await logAudit({
    actorUserId: user.userId,
    actorRole: "admin",
    action: status === "approved" ? "project.approved" : "project.rejected",
    targetType: "project",
    targetId: projectId,
    metadata: { status },
  });
  revalidatePath("/admin");
  return { ok: true };
}

export async function resyncTrials(): Promise<{ ok: boolean; fetched: number; error?: string }> {
  const user = await requireRole("admin");
  try {
    const result = await syncTrials({
      condition: process.env.CTGOV_CONDITION || undefined,
      location: process.env.CTGOV_LOCATION || "Massachusetts",
      geoFilter: process.env.CTGOV_FALLBACK_GEO || undefined,
      maxTrials: 50, // admin re-sync is capped (B14.6)
      minLocalTrials: 50,
      actorUserId: user.userId,
    });
    revalidatePath("/admin");
    return { ok: true, fetched: result.fetched };
  } catch (err) {
    return { ok: false, fetched: 0, error: err instanceof Error ? err.message : "Sync failed." };
  }
}

export async function parsePending(): Promise<{ ok: boolean; parsed: number; failed: number; error?: string }> {
  await requireRole("admin");
  if (!hasAnthropic()) {
    return { ok: false, parsed: 0, failed: 0, error: "Parsing needs ANTHROPIC_API_KEY in .env.local." };
  }
  try {
    const progress = await parsePendingTrials({ limit: 10, concurrency: 4 });
    revalidatePath("/admin");
    return { ok: true, parsed: progress.parsed, failed: progress.failed };
  } catch (err) {
    return { ok: false, parsed: 0, failed: 0, error: err instanceof Error ? err.message : "Parsing failed." };
  }
}

export async function resetDemo(): Promise<Result> {
  const user = await requireRole("admin");
  // DECISION: reset wipes data, so it only exists in demo environments.
  if (!DEMO_MODE) return { ok: false, error: "Reset is only available in demo mode." };
  try {
    await seedDemo();
    await runMatchesForAllPatients();
    await logAudit({ actorUserId: user.userId, actorRole: "admin", action: "demo.reset" });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Reset failed." };
  }
}
