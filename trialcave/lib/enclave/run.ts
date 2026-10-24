import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { DONOR_SHARE } from "@/lib/env";
import { PAYABLE_SOURCES } from "@/lib/verification";
import { townEquity } from "@/lib/geo/equity";
import { differenceInYears, parseISO } from "date-fns";

import { runAnalysisWithContributors, ANALYSIS_META, type AnalysisKey, type AnalysisResult, type DonorRow } from "@/lib/enclave/analyses";

type Admin = ReturnType<typeof createAdminClient>;

export interface EligiblePool {
  patientIds: string[];
  count: number;
}

/**
 * Eligible donor pool for a project: donors who aren't withdrawn and whose
 * research consent allows EVERY data type of the project for its research type
 * (B14.5). Count only is ever exposed to the researcher.
 */
export async function eligibleDonorPool(
  admin: Admin,
  dataTypes: string[],
  researchType: string,
): Promise<EligiblePool> {
  // Donors not withdrawn (paged past the 1000-row cap).
  const donorIds: string[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from("patients")
      .select("id")
      .eq("is_donor", true)
      .eq("research_withdrawn", false)
      .order("id")
      .range(from, from + 999);
    if (error) throw new Error("Couldn't load the Donor pool.");
    if (!data || data.length === 0) break;
    donorIds.push(...data.map((d) => d.id as string));
    if (data.length < 1000) break;
  }
  if (donorIds.length === 0) return { patientIds: [], count: 0 };

  // Consent rows for this research type across the needed data types. Chunks of
  // 200 donors × at most 4 data types stay under the 1000-row cap.
  const eligible: string[] = [];
  for (let i = 0; i < donorIds.length; i += 200) {
    const chunk = donorIds.slice(i, i + 200);
    const { data: consents } = await admin
      .from("research_consents")
      .select("patient_id, data_type, allowed")
      .in("patient_id", chunk)
      .eq("research_type", researchType)
      .in("data_type", dataTypes)
      .eq("allowed", true);
    // Group by patient; must have an allowed row for EVERY needed data type.
    const byPatient = new Map<string, Set<string>>();
    for (const c of consents ?? []) {
      if (!byPatient.has(c.patient_id)) byPatient.set(c.patient_id, new Set());
      byPatient.get(c.patient_id)!.add(c.data_type);
    }
    for (const pid of chunk) {
      const allowed = byPatient.get(pid);
      if (allowed && dataTypes.every((dt) => allowed.has(dt))) eligible.push(pid);
    }
  }
  return { patientIds: eligible, count: eligible.length };
}

/** Load analysis-relevant facts for the pool (de-identified; no PII). */
async function loadDonorRows(admin: Admin, patientIds: string[]): Promise<DonorRow[]> {
  const rows: DonorRow[] = [];
  const today = new Date();

  for (let i = 0; i < patientIds.length; i += 200) {
    const chunk = patientIds.slice(i, i + 200);

    const { data: patients } = await admin
      .from("patients")
      .select("id, date_of_birth, town")
      .in("id", chunk);
    const ageById = new Map<string, number>();
    const vulnById = new Map<string, string>();
    for (const p of patients ?? []) {
      if (p.date_of_birth) {
        const age = differenceInYears(today, parseISO(p.date_of_birth));
        if (Number.isFinite(age)) ageById.set(p.id, age);
      }
      // Town-level community vulnerability only — never finer than town.
      vulnById.set(p.id, townEquity(p.town).svi);
    }

    // ANTI-FRAUD: the paid pool draws ONLY on provenance-backed facts. Exclude
    // self-reported (typed/yes-no) facts so fabricated data can never earn money.
    const facts: { patient_id: string; field: string; value_num: number | null; value_bool: boolean | null; observed_at: string | null }[] = [];
    for (let page = 0; ; page++) {
      const { data: f } = await admin
        .from("patient_current_facts")
        .select("patient_id, field, value_num, value_bool, observed_at, source")
        .in("patient_id", chunk)
        .in("source", PAYABLE_SOURCES)
        .range(page * 1000, page * 1000 + 999);
      if (!f || f.length === 0) break;
      facts.push(...f);
      if (f.length < 1000) break;
    }
    const factsByPatient = new Map<string, Map<string, FactCell>>();
    for (const f of facts) {
      if (!factsByPatient.has(f.patient_id)) factsByPatient.set(f.patient_id, new Map());
      factsByPatient.get(f.patient_id)!.set(f.field, {
        num: f.value_num != null ? Number(f.value_num) : null,
        bool: f.value_bool,
        observedAt: f.observed_at,
      });
    }

    // Wearable 30-day averages. Filter to the window in the query and paginate:
    // Supabase caps a single select at 1000 rows, and a chunk of 200 donors ×
    // 30 days can exceed that, which would silently drop data.
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffIso = cutoff.toISOString().slice(0, 10);
    const wearables: { patient_id: string; steps: number | null; time_in_range_pct: number | null; day: string }[] = [];
    for (let page = 0; ; page++) {
      const { data: w } = await admin
        .from("wearable_daily")
        .select("patient_id, steps, time_in_range_pct, day")
        .in("patient_id", chunk)
        .gte("day", cutoffIso)
        .range(page * 1000, page * 1000 + 999);
      if (!w || w.length === 0) break;
      wearables.push(...w);
      if (w.length < 1000) break;
    }

    const wearByPatient = new Map<string, { steps: number[]; tir: number[] }>();
    for (const w of wearables) {
      if (!wearByPatient.has(w.patient_id)) wearByPatient.set(w.patient_id, { steps: [], tir: [] });
      const e = wearByPatient.get(w.patient_id)!;
      if (w.steps != null) e.steps.push(w.steps);
      if (w.time_in_range_pct != null) e.tir.push(w.time_in_range_pct);
    }
    const mean = (xs: number[]) => (xs.length >= 7 ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

    for (const pid of chunk) {
      const f = factsByPatient.get(pid) ?? new Map();
      const w = wearByPatient.get(pid) ?? { steps: [], tir: [] };
      const t2d = f.get("dx:type2_diabetes");
      rows.push({
        age: ageById.get(pid) ?? null,
        vulnerability: vulnById.get(pid) ?? null,
        hba1c: f.get("hba1c_pct")?.num ?? null,
        avgDailySteps: mean(w.steps),
        cgmTimeInRange: mean(w.tir),
        // Duration approximated from the fact's absence of a stored value; the
        // engine's diabetes_duration_years derivation isn't persisted, so we
        // use a null-safe fallback: treat presence of t2d with retinopathy bands.
        diabetesDurationYears: t2d?.bool ? estimateDuration(f) : null,
        hasRetinopathy: f.get("dx:retinopathy")?.bool ?? null,
      });
    }
  }
  return rows;
}

interface FactCell {
  num: number | null;
  bool: boolean | null;
  observedAt: string | null;
}

// Diabetes duration for the retinopathy analysis, in whole years, from the
// diagnosis date on the provenance-backed fact. Missing → excluded (never invented).
function estimateDuration(f: Map<string, FactCell>): number | null {
  const t2d = f.get("dx:type2_diabetes");
  if (!t2d?.bool || !t2d.observedAt) return null;
  const years = differenceInYears(new Date(), parseISO(t2d.observedAt));
  return Number.isFinite(years) && years >= 0 ? years : null;
}

export interface RunOutcome {
  result: AnalysisResult;
  donorCount: number;
  runId: string | null;
}

/**
 * Run an Enclave analysis (B14.5): filter to the consenting pool, compute the
 * suppressed aggregate, record the run + contributions, credit donor payouts,
 * and audit. Never returns row-level data.
 */
export async function runEnclaveAnalysis(
  projectId: string,
  analysisKey: AnalysisKey,
  runByUserId: string,
): Promise<RunOutcome> {
  const admin = createAdminClient();

  const { data: project } = await admin
    .from("research_projects")
    .select("id, data_types, research_type, allowed_analyses, access_fee_per_run_cents, title")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) throw new Error("Project not found.");
  if (!project.allowed_analyses.includes(analysisKey)) throw new Error("Analysis not allowed for this project.");
  const meta = ANALYSIS_META[analysisKey];
  if (!meta) throw new Error("Unknown analysis.");
  // Consent scope: an analysis may only use data types the project (and so every
  // Donor in its pool) consented to.
  const missing = meta.needs.filter((dt) => !project.data_types.includes(dt));
  if (missing.length) throw new Error(`This analysis needs ${missing.join(" and ")} data, which this project isn't approved for.`);

  // DECISION: throttle repeated runs to make differencing attacks expensive.
  const { count: recentRuns } = await admin
    .from("enclave_runs")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .gt("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
  if ((recentRuns ?? 0) >= 20) throw new Error("This project has run 20 analyses in the last hour. Try again later.");

  const pool = await eligibleDonorPool(admin, project.data_types, project.research_type);
  const donorRows = await loadDonorRows(admin, pool.patientIds);
  const { result, contributors } = runAnalysisWithContributors(analysisKey, donorRows);
  // Only Donors whose provenance-backed data landed in a shown group powered
  // this result, so only they are recorded and paid (anti-fraud trust tiers).
  const contributorIds = contributors.map((i) => pool.patientIds[i]).filter(Boolean);

  // Record the run (aggregates only).
  const { data: run, error: runErr } = await admin
    .from("enclave_runs")
    .insert({
      project_id: projectId,
      analysis_key: analysisKey,
      result: result as unknown as Record<string, unknown>,
      suppressed_cells: result.suppressedCells,
      donor_count: contributorIds.length,
      run_by: runByUserId,
    })
    .select("id")
    .single();
  if (runErr || !run) throw new Error("Couldn't record the run. Try again.");

  // Record contributions + credit payouts.
  if (contributorIds.length > 0) {
    const shareCents = Math.floor((project.access_fee_per_run_cents * DONOR_SHARE) / contributorIds.length);
    const contributions = contributorIds.map((pid) => ({ patient_id: pid, project_id: projectId, run_id: run.id }));
    for (let i = 0; i < contributions.length; i += 500) {
      await admin.from("donor_contributions").insert(contributions.slice(i, i + 500));
    }
    if (shareCents > 0) {
      const earnings = contributorIds.map((pid) => ({
        patient_id: pid,
        kind: "research_share" as const,
        amount_cents: shareCents,
        description: `Your donation supported '${project.title}' (${project.research_type})`,
        related_run_id: run.id,
        status: "accrued" as const,
      }));
      for (let i = 0; i < earnings.length; i += 500) {
        await admin.from("donor_earnings").insert(earnings.slice(i, i + 500));
      }
    }
  }

  await logAudit({ actorUserId: runByUserId, actorRole: "researcher", action: "enclave.run", targetType: "project", targetId: projectId, metadata: { analysisKey, donorCount: contributorIds.length, suppressedCells: result.suppressedCells } });

  return { result, donorCount: contributorIds.length, runId: run.id };
}

export { ANALYSIS_META };
