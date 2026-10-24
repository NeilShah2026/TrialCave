"use server";

import { revalidatePath } from "next/cache";

import { getSessionUser, requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { syncTrials } from "@/lib/ctgov/sync";
import { parsePendingTrials } from "@/lib/ctgov/parse";
import { seedDemo } from "@/lib/demo/seed";
import { runMatchesForAllPatients } from "@/lib/matching/run";

export async function verifyClinic(clinicId: string, verified: boolean): Promise<{ ok: boolean }> {
  const user = await getSessionUser();
  await requireRole("admin");
  const admin = createAdminClient();
  await admin.from("clinics").update({ verified, irb_on_file: verified }).eq("id", clinicId);
  await logAudit({ actorUserId: user?.userId ?? null, actorRole: "admin", action: "clinic.verified", targetType: "clinic", targetId: clinicId, metadata: { verified } });
  revalidatePath("/admin");
  return { ok: true };
}

export async function setProjectStatus(projectId: string, status: "approved" | "rejected"): Promise<{ ok: boolean }> {
  const user = await getSessionUser();
  await requireRole("admin");
  const admin = createAdminClient();
  await admin.from("research_projects").update({ status }).eq("id", projectId);
  await logAudit({ actorUserId: user?.userId ?? null, actorRole: "admin", action: status === "approved" ? "project.approved" : "project.rejected", targetType: "project", targetId: projectId });
  revalidatePath("/admin");
  return { ok: true };
}

export async function resyncTrials(): Promise<{ ok: boolean; fetched: number; error?: string }> {
  const user = await getSessionUser();
  await requireRole("admin");
  try {
    const result = await syncTrials({
      condition: process.env.CTGOV_CONDITION || undefined,
      location: process.env.CTGOV_LOCATION || "Massachusetts",
      geoFilter: process.env.CTGOV_FALLBACK_GEO || undefined,
      maxTrials: 50, // admin re-sync is capped (B14.6)
      minLocalTrials: 50,
      actorUserId: user?.userId ?? null,
    });
    revalidatePath("/admin");
    return { ok: true, fetched: result.fetched };
  } catch (err) {
    return { ok: false, fetched: 0, error: err instanceof Error ? err.message : "Sync failed." };
  }
}

export async function parsePending(): Promise<{ ok: boolean; parsed: number; failed: number }> {
  await requireRole("admin");
  const progress = await parsePendingTrials({ limit: 10, concurrency: 4 });
  revalidatePath("/admin");
  return { ok: true, parsed: progress.parsed, failed: progress.failed };
}

export async function resetDemo(): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  await requireRole("admin");
  try {
    await seedDemo();
    await runMatchesForAllPatients();
    await logAudit({ actorUserId: user?.userId ?? null, actorRole: "admin", action: "demo.reset" });
    revalidatePath("/admin");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Reset failed." };
  }
}
