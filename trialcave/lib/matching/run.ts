import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildFactMapFromRows,
  type ConfirmedFact,
  type FactMap,
} from "@/lib/matching/facts";
import { prefilterTrial, type PrefilterTrial } from "@/lib/matching/prefilter";
import { evaluateCriteria, type Answer } from "@/lib/matching/evaluate";
import { scoreTrial } from "@/lib/matching/score";
import { diffMatches, type MatchSnapshot } from "@/lib/matching/diff";
import type { CriterionResult, EvalCriterion } from "@/lib/matching/types";
import type { TrialLocation } from "@/lib/ctgov/normalize";

type Admin = ReturnType<typeof createAdminClient>;

export type Trigger =
  | { type: "document"; id: string; label: string }
  | { type: "answer"; id: string; label: string }
  | { type: "profile_edit"; id: string; label: string }
  | { type: "connector"; id: string; label: string }
  | { type: "lab_entry"; id: string; label: string }
  | { type: "silent" };

export interface MatchDiffResult {
  trigger: Trigger;
  changeCount: number;
}

interface TrialForMatch {
  id: string;
  source: "ctgov" | "clinic";
  overall_status: string;
  study_status: string;
  min_age_years: number | null;
  max_age_years: number | null;
  sex: "ALL" | "FEMALE" | "MALE";
  locations: TrialLocation[];
}

function toEvalCriterion(c: Record<string, unknown>): EvalCriterion {
  return {
    id: c.id as string,
    kind: c.kind as EvalCriterion["kind"],
    plainText: c.plain_text as string,
    category: c.category as string,
    field: (c.field as string | null) ?? null,
    operator: (c.operator as EvalCriterion["operator"]) ?? null,
    valueMin: (c.value_min as number | null) ?? null,
    valueMax: (c.value_max as number | null) ?? null,
    valueText: (c.value_text as string | null) ?? null,
    unit: (c.unit as string | null) ?? null,
    machineCheckable: Boolean(c.machine_checkable),
    patientQuestion: (c.patient_question as string | null) ?? null,
  };
}

async function loadPatientFactMap(admin: Admin, patientId: string): Promise<{
  factMap: FactMap;
  patient: { ageYears: number; sex: "female" | "male"; lat: number; lon: number; travelRadiusMiles: number };
} | null> {
  const { data: p } = await admin
    .from("patients")
    .select("id, date_of_birth, sex, lat, lon, travel_radius_miles")
    .eq("id", patientId)
    .maybeSingle();
  if (!p) return null;

  const { data: current } = await admin
    .from("patient_current_facts")
    .select("id, field, value_num, value_bool, value_text, unit, observed_at, source, document_id")
    .eq("patient_id", patientId);

  const { data: all } = await admin
    .from("patient_facts")
    .select("id, field, value_num, value_bool, value_text, unit, observed_at, source, document_id")
    .eq("patient_id", patientId)
    .eq("status", "confirmed");

  const { data: sources } = await admin
    .from("connected_sources")
    .select("source")
    .eq("patient_id", patientId);

  const { data: wearables } = await admin
    .from("wearable_daily")
    .select("day, steps, time_in_range_pct")
    .eq("patient_id", patientId);

  const { data: docs } = await admin
    .from("source_documents")
    .select("id, facility_name, document_date")
    .eq("patient_id", patientId);

  const factMap = buildFactMapFromRows({
    patient: { id: p.id, date_of_birth: p.date_of_birth, sex: p.sex },
    currentFacts: (current ?? []) as ConfirmedFact[],
    allConfirmedFacts: (all ?? []) as ConfirmedFact[],
    connectedSources: (sources ?? []).map((s) => s.source),
    wearableDays: wearables ?? [],
    documents: docs ?? [],
  });

  return {
    factMap,
    patient: {
      ageYears: Number(factMap["age"]?.value ?? 0),
      sex: p.sex,
      lat: p.lat,
      lon: p.lon,
      travelRadiusMiles: p.travel_radius_miles,
    },
  };
}

async function loadAllTrialsWithCriteria(admin: Admin): Promise<{
  trials: TrialForMatch[];
  criteriaByTrial: Map<string, EvalCriterion[]>;
}> {
  const trials: TrialForMatch[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data } = await admin
      .from("trials")
      .select("id, source, overall_status, study_status, min_age_years, max_age_years, sex, locations")
      .range(from, from + pageSize - 1);
    if (!data || data.length === 0) break;
    trials.push(...(data as TrialForMatch[]));
    if (data.length < pageSize) break;
  }

  const criteriaByTrial = new Map<string, EvalCriterion[]>();
  const trialIds = trials.map((t) => t.id);
  // Chunk trial ids AND paginate within each chunk: Supabase caps a select at
  // 1000 rows, and a chunk of trials can have far more criteria than that.
  for (let i = 0; i < trialIds.length; i += 100) {
    const chunk = trialIds.slice(i, i + 100);
    for (let page = 0; ; page++) {
      const { data } = await admin
        .from("trial_criteria")
        .select("*")
        .in("trial_id", chunk)
        .range(page * 1000, page * 1000 + 999);
      if (!data || data.length === 0) break;
      for (const row of data) {
        const tid = row.trial_id as string;
        if (!criteriaByTrial.has(tid)) criteriaByTrial.set(tid, []);
        criteriaByTrial.get(tid)!.push(toEvalCriterion(row));
      }
      if (data.length < 1000) break;
    }
  }
  return { trials, criteriaByTrial };
}

/**
 * Run the matching pipeline for one patient (B9.6). Upserts match_results and,
 * unless the trigger is silent, records match_changes.
 */
export async function runMatchesForPatient(
  patientId: string,
  trigger: Trigger,
): Promise<MatchDiffResult> {
  const admin = createAdminClient();

  const loaded = await loadPatientFactMap(admin, patientId);
  if (!loaded) return { trigger, changeCount: 0 };
  const { factMap, patient } = loaded;

  // Old results for the diff.
  const { data: oldRows } = await admin
    .from("match_results")
    .select("trial_id, status, score, details")
    .eq("patient_id", patientId);
  const oldMap = new Map<string, MatchSnapshot>(
    (oldRows ?? []).map((r) => [
      r.trial_id as string,
      { status: r.status, score: Number(r.score), details: (r.details ?? []) as CriterionResult[] },
    ]),
  );

  const { trials, criteriaByTrial } = await loadAllTrialsWithCriteria(admin);

  // Answers.
  const { data: answerRows } = await admin
    .from("criterion_answers")
    .select("criterion_id, answer")
    .eq("patient_id", patientId);
  const answers = new Map<string, Answer>(
    (answerRows ?? []).map((a) => [a.criterion_id as string, a.answer as Answer]),
  );

  const upserts: Record<string, unknown>[] = [];
  const keptTrialIds = new Set<string>();
  const newMap = new Map<string, MatchSnapshot>();

  for (const trial of trials) {
    const prefilterInput: PrefilterTrial = {
      source: trial.source,
      overallStatus: trial.overall_status,
      studyStatus: trial.study_status,
      minAgeYears: trial.min_age_years,
      maxAgeYears: trial.max_age_years,
      sex: trial.sex,
      locations: trial.locations ?? [],
    };
    const pre = prefilterTrial(patient, prefilterInput);
    if (!pre.keep) continue;
    keptTrialIds.add(trial.id);

    const criteria = criteriaByTrial.get(trial.id) ?? [];
    // Reuse cached AI results from old details.
    const oldDetails = oldMap.get(trial.id)?.details ?? [];
    const cachedAi = new Map<string, CriterionResult>(
      oldDetails.filter((d) => d.source === "ai").map((d) => [d.criterionId, d]),
    );

    const results = evaluateCriteria(criteria, factMap, answers, cachedAi);
    const scored = scoreTrial(results);

    newMap.set(trial.id, { status: scored.status, score: scored.score, details: results });
    upserts.push({
      patient_id: patientId,
      trial_id: trial.id,
      status: scored.status,
      score: scored.score,
      pass_count: scored.passCount,
      fail_count: scored.failCount,
      unknown_count: scored.unknownCount,
      details: results,
      distance_miles: pre.distanceMiles,
      computed_at: new Date().toISOString(),
    });
  }

  // Upsert in chunks of 500.
  for (let i = 0; i < upserts.length; i += 500) {
    const chunk = upserts.slice(i, i + 500);
    const { error } = await admin.from("match_results").upsert(chunk, { onConflict: "patient_id,trial_id" });
    if (error) console.error(`[match] upsert chunk failed: ${error.message}`);
  }

  // Delete rows for trials now prefiltered out.
  const staleTrialIds = [...oldMap.keys()].filter((id) => !keptTrialIds.has(id));
  if (staleTrialIds.length) {
    for (let i = 0; i < staleTrialIds.length; i += 200) {
      await admin
        .from("match_results")
        .delete()
        .eq("patient_id", patientId)
        .in("trial_id", staleTrialIds.slice(i, i + 200));
    }
  }

  if (trigger.type === "silent") {
    return { trigger, changeCount: 0 };
  }

  // Record changes.
  const changes = diffMatches(oldMap, newMap);
  if (changes.length) {
    const rows = changes.map((c) => ({
      patient_id: patientId,
      trial_id: c.trialId,
      from_status: c.fromStatus,
      to_status: c.toStatus,
      from_score: c.fromScore,
      to_score: c.toScore,
      trigger_type: trigger.type,
      trigger_id: trigger.id,
      trigger_label: trigger.label,
      changed_criteria: c.changedCriteria,
    }));
    await admin.from("match_changes").insert(rows);
  }

  return { trigger, changeCount: changes.length };
}

/** Re-match all non-withdrawn patients against everything (silent). Used after a
 *  clinic saves a study, and by the precompute script. */
export async function runMatchesForAllPatients(): Promise<number> {
  const admin = createAdminClient();
  const ids: string[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data } = await admin
      .from("patients")
      .select("id")
      .eq("research_withdrawn", false)
      .range(from, from + pageSize - 1);
    if (!data || data.length === 0) break;
    ids.push(...data.map((p) => p.id));
    if (data.length < pageSize) break;
  }
  for (const id of ids) {
    await runMatchesForPatient(id, { type: "silent" });
  }
  return ids.length;
}
