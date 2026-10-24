"use server";

import { revalidatePath } from "next/cache";

import { getSessionUser, getMyResearchPartner, assertApprovedProjectOwner } from "@/lib/auth";
import { ANALYSIS_META } from "@/lib/enclave/analyses";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { runEnclaveAnalysis } from "@/lib/enclave/run";
import { resultToCsv, type AnalysisKey, type AnalysisResult } from "@/lib/enclave/analyses";

export async function runAnalysisAction(
  projectId: string,
  analysisKey: AnalysisKey,
): Promise<{ ok: boolean; result?: AnalysisResult; donorCount?: number; runId?: string; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Please sign in again." };
  const partner = await getMyResearchPartner();
  try {
    await assertApprovedProjectOwner(partner.id, projectId);
    const outcome = await runEnclaveAnalysis(projectId, analysisKey, user.userId);
    revalidatePath(`/enclave/${projectId}`);
    return { ok: true, result: outcome.result, donorCount: outcome.donorCount, runId: outcome.runId ?? undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Run failed." };
  }
}

/** Log a blocked raw-download attempt (B14.5). There is no route that returns rows. */
export async function logBlockedRawDownload(projectId: string): Promise<void> {
  const user = await getSessionUser();
  if (!user || user.role !== "researcher") return;
  const partner = await getMyResearchPartner();
  try {
    await assertApprovedProjectOwner(partner.id, projectId);
  } catch {
    return;
  }
  await logAudit({
    actorUserId: user.userId,
    actorRole: "researcher",
    action: "enclave.raw_download_blocked",
    targetType: "project",
    targetId: projectId,
  });
}

/** Export a run's aggregate table as CSV (B14.5). Aggregates only, audited. */
export async function exportRunCsv(runId: string): Promise<{ ok: boolean; csv?: string; fileName?: string; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Please sign in again." };
  const partner = await getMyResearchPartner();
  const admin = createAdminClient();

  const { data: run } = await admin
    .from("enclave_runs")
    .select("id, result, analysis_key, project_id, research_projects!inner(partner_id, status)")
    .eq("id", runId)
    .maybeSingle();
  const project = run?.research_projects as unknown as { partner_id: string; status: string } | undefined;
  if (!run || project?.partner_id !== partner.id) return { ok: false, error: "Not authorized." };
  if (project.status !== "approved") return { ok: false, error: "This project is no longer approved." };

  const csv = resultToCsv(run.result as unknown as AnalysisResult);
  await logAudit({ actorUserId: user.userId, actorRole: "researcher", action: "enclave.export", targetType: "run", targetId: runId });
  return { ok: true, csv, fileName: `enclave-${run.analysis_key}-${runId.slice(0, 8)}.csv` };
}

const ANALYSIS_KEYS = ["hba1c_by_age", "steps_by_hba1c", "tir_by_hba1c", "retinopathy_by_duration", "hba1c_by_vulnerability"] as const;

/** Request a new research project (A8.5). TrialCave admins approve it before any run. */
export async function requestProject(input: {
  title: string;
  description: string;
  researchType: string;
  dataTypes: string[];
  analyses: string[];
}): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Please sign in again." };
  const partner = await getMyResearchPartner();

  const title = (input.title ?? "").trim();
  const description = (input.description ?? "").trim();
  if (title.length < 5 || title.length > 200) return { ok: false, error: "Give the project a title (5–200 characters)." };
  if (description.length < 20 || description.length > 2000) return { ok: false, error: "Describe the research question in at least 20 characters." };
  if (!["academic", "pharma", "ai", "device"].includes(input.researchType)) return { ok: false, error: "Pick a research type." };
  const dataTypes = [...new Set((input.dataTypes ?? []).filter((d) => ["wearables", "labs", "imaging", "history"].includes(d)))];
  const analyses = [...new Set((input.analyses ?? []).filter((a): a is (typeof ANALYSIS_KEYS)[number] => (ANALYSIS_KEYS as readonly string[]).includes(a)))];
  if (dataTypes.length === 0) return { ok: false, error: "Pick at least one data type." };
  if (analyses.length === 0) return { ok: false, error: "Pick at least one analysis." };

  // Every requested analysis must be covered by the requested data types (consent scope).
  const uncovered = analyses.filter((a) => ANALYSIS_META[a].needs.some((n) => !dataTypes.includes(n)));
  if (uncovered.length) {
    return { ok: false, error: `${ANALYSIS_META[uncovered[0]].label} needs ${ANALYSIS_META[uncovered[0]].needs.join(" and ")} data.` };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("research_projects").insert({
    partner_id: partner.id,
    title,
    description,
    research_type: input.researchType,
    data_types: dataTypes,
    allowed_analyses: analyses,
    status: "pending",
  });
  if (error) return { ok: false, error: "Couldn't submit the request. Try again." };
  revalidatePath("/enclave");
  return { ok: true };
}
