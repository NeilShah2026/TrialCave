"use server";

import { getSessionUser, getMyResearchPartner, assertApprovedProjectOwner } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { runEnclaveAnalysis } from "@/lib/enclave/run";
import type { AnalysisKey, AnalysisResult } from "@/lib/enclave/analyses";

export async function runAnalysisAction(
  projectId: string,
  analysisKey: AnalysisKey,
): Promise<{ ok: boolean; result?: AnalysisResult; donorCount?: number; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const partner = await getMyResearchPartner();
  await assertApprovedProjectOwner(partner.id, projectId);

  try {
    const outcome = await runEnclaveAnalysis(projectId, analysisKey, user.userId);
    return { ok: true, result: outcome.result, donorCount: outcome.donorCount };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Run failed." };
  }
}

/** Log a blocked raw-download attempt (B14.5). There is no route that returns rows. */
export async function logBlockedRawDownload(projectId: string): Promise<void> {
  const user = await getSessionUser();
  await logAudit({
    actorUserId: user?.userId ?? null,
    actorRole: "researcher",
    action: "enclave.raw_download_blocked",
    targetType: "project",
    targetId: projectId,
  });
}

/** Export the latest run's aggregate table as CSV (B14.5). Aggregates only. */
export async function exportRunCsv(runId: string): Promise<{ ok: boolean; csv?: string; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const partner = await getMyResearchPartner();
  const admin = createAdminClient();

  const { data: run } = await admin
    .from("enclave_runs")
    .select("id, result, project_id, research_projects!inner(partner_id)")
    .eq("id", runId)
    .maybeSingle();
  const owner = (run?.research_projects as unknown as { partner_id: string } | undefined)?.partner_id;
  if (!run || owner !== partner.id) return { ok: false, error: "Not authorized." };

  const result = run.result as unknown as AnalysisResult;
  const header = "band,n,value";
  const lines = result.rows.map((r) => `${JSON.stringify(r.band)},${r.n},${r.value ?? ""}`);
  const csv = [header, ...lines].join("\n");

  await logAudit({ actorUserId: user.userId, actorRole: "researcher", action: "enclave.export", targetType: "run", targetId: runId });
  return { ok: true, csv };
}
