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
    const { data, error } = await admin
      .from("trials")
      .select("id, source, overall_status, study_status, min_age_years, max_age_years, sex, locations")
      .range(from, from + pageSize - 1);
    // A failed read must never look like "no trials" (that would wipe matches).
    if (error) throw new Error(`Could not load trials: ${error.message}`);
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
      const { data, error } = await admin
        .from("trial_criteria")
        .select("*")
        .in("trial_id", chunk)
        .range(page * 1000, page * 1000 + 999);
      if (error) throw new Error(`Could not load trial criteria: ${error.message}`);
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

  // Old results for the diff. Paged: a patient can match more than 1000 trials.
  const oldRows: { trial_id: string; status: MatchSnapshot["status"]; score: number; details: unknown }[] = [];
  for (let page = 0; ; page++) {
    const { data, error } = await admin
      .from("match_results")
      .select("trial_id, status, score, details")
      .eq("patient_id", patientId)
      .range(page * 1000, page * 1000 + 999);
    if (error) throw new Error(`Could not load current matches: ${error.message}`);
    if (!data || data.length === 0) break;
    oldRows.push(...data);
    if (data.length < 1000) break;
  }
  const oldMap = new Map<string, MatchSnapshot>(
    oldRows.map((r) => [
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

  // Upsert in chunks of 500. If any write fails, stop before deleting rows or
  // recording changes that never persisted.
  for (let i = 0; i < upserts.length; i += 500) {
    const chunk = upserts.slice(i, i + 500);
    const { error } = await admin.from("match_results").upsert(chunk, { onConflict: "patient_id,trial_id" });
    if (error) {
      console.error(`[match] upsert chunk failed: ${error.message}`);
      return { trigger, changeCount: 0 };
    }
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

/** Page through a Supabase select (1000-row cap) for a set of patient ids. */
async function selectByPatients<T>(
  run: (ids: string[], from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  patientIds: string[],
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < patientIds.length; i += 100) {
    const chunk = patientIds.slice(i, i + 100);
    for (let page = 0; ; page++) {
      const { data, error } = await run(chunk, page * 1000, page * 1000 + 999);
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) break;
      out.push(...data);
      if (data.length < 1000) break;
    }
  }
  return out;
}

function groupBy<T>(rows: T[], key: (r: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(r);
  }
  return m;
}

/**
 * Re-match every non-withdrawn patient against ONE trial (B9.6
 * runMatchesForTrial), silently. Used after a clinic saves a study. Loads all
 * patient inputs in bulk instead of re-running the full pipeline per patient,
 * so saving a study takes seconds, not minutes.
 */
export async function runMatchesForTrial(trialId: string): Promise<number> {
  const admin = createAdminClient();

  const { data: trial, error: tErr } = await admin
    .from("trials")
    .select("id, source, overall_status, study_status, min_age_years, max_age_years, sex, locations")
    .eq("id", trialId)
    .maybeSingle();
  if (tErr) throw new Error(`Could not load the study: ${tErr.message}`);
  if (!trial) return 0;

  const { data: critRows, error: cErr } = await admin.from("trial_criteria").select("*").eq("trial_id", trialId);
  if (cErr) throw new Error(`Could not load the study's criteria: ${cErr.message}`);
  const criteria = (critRows ?? []).map(toEvalCriterion);
  const criterionIds = criteria.map((c) => c.id);

  // Patients (paged).
  const patients: { id: string; date_of_birth: string; sex: "female" | "male"; lat: number; lon: number; travel_radius_miles: number }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from("patients")
      .select("id, date_of_birth, sex, lat, lon, travel_radius_miles")
      .eq("research_withdrawn", false)
      .range(from, from + 999);
    if (error) throw new Error(`Could not load patients: ${error.message}`);
    if (!data || data.length === 0) break;
    patients.push(...data);
    if (data.length < 1000) break;
  }
  const ids = patients.map((p) => p.id);
  if (ids.length === 0) return 0;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 31);
  const cutoffIso = cutoff.toISOString().slice(0, 10);
  const factCols = "id, patient_id, field, value_num, value_bool, value_text, unit, observed_at, source, document_id";

  const [current, all, sources, wearables, docs, answers, oldRows] = await Promise.all([
    selectByPatients<ConfirmedFact & { patient_id: string }>((c, f, t) => admin.from("patient_current_facts").select(factCols).in("patient_id", c).range(f, t), ids),
    selectByPatients<ConfirmedFact & { patient_id: string }>(
      (c, f, t) => admin.from("patient_facts").select(factCols).in("patient_id", c).eq("status", "confirmed").eq("field", "dx:type2_diabetes").range(f, t),
      ids,
    ),
    selectByPatients<{ patient_id: string; source: string }>((c, f, t) => admin.from("connected_sources").select("patient_id, source").in("patient_id", c).range(f, t), ids),
    selectByPatients<{ patient_id: string; day: string; steps: number | null; time_in_range_pct: number | null }>(
      (c, f, t) => admin.from("wearable_daily").select("patient_id, day, steps, time_in_range_pct").in("patient_id", c).gte("day", cutoffIso).range(f, t),
      ids,
    ),
    selectByPatients<{ patient_id: string; id: string; facility_name: string | null; document_date: string | null }>(
      (c, f, t) => admin.from("source_documents").select("patient_id, id, facility_name, document_date").in("patient_id", c).range(f, t),
      ids,
    ),
    criterionIds.length
      ? selectByPatients<{ patient_id: string; criterion_id: string; answer: Answer }>(
          (c, f, t) => admin.from("criterion_answers").select("patient_id, criterion_id, answer").in("patient_id", c).in("criterion_id", criterionIds).range(f, t),
          ids,
        )
      : Promise.resolve([]),
    selectByPatients<{ patient_id: string; details: unknown }>(
      (c, f, t) => admin.from("match_results").select("patient_id, details").eq("trial_id", trialId).in("patient_id", c).range(f, t),
      ids,
    ),
  ]);

  const byCurrent = groupBy(current, (r) => r.patient_id);
  const byAll = groupBy(all, (r) => r.patient_id);
  const bySources = groupBy(sources, (r) => r.patient_id);
  const byWear = groupBy(wearables, (r) => r.patient_id);
  const byDocs = groupBy(docs, (r) => r.patient_id);
  const byAnswers = groupBy(answers, (r) => r.patient_id);
  const oldDetails = new Map(oldRows.map((r) => [r.patient_id, (r.details ?? []) as CriterionResult[]]));

  const prefilterInput: PrefilterTrial = {
    source: trial.source,
    overallStatus: trial.overall_status,
    studyStatus: trial.study_status,
    minAgeYears: trial.min_age_years,
    maxAgeYears: trial.max_age_years,
    sex: trial.sex,
    locations: (trial.locations ?? []) as TrialLocation[],
  };

  const upserts: Record<string, unknown>[] = [];
  const drop: string[] = [];
  for (const p of patients) {
    const factMap = buildFactMapFromRows({
      patient: { id: p.id, date_of_birth: p.date_of_birth, sex: p.sex },
      currentFacts: byCurrent.get(p.id) ?? [],
      allConfirmedFacts: byAll.get(p.id) ?? [],
      connectedSources: (bySources.get(p.id) ?? []).map((s) => s.source),
      wearableDays: byWear.get(p.id) ?? [],
      documents: byDocs.get(p.id) ?? [],
    });
    const age = Number(factMap["age"]?.value);
    if (!Number.isFinite(age) || p.lat == null || p.lon == null) continue;

    const pre = prefilterTrial(
      { ageYears: age, sex: p.sex, lat: p.lat, lon: p.lon, travelRadiusMiles: p.travel_radius_miles ?? 25 },
      prefilterInput,
    );
    if (!pre.keep) {
      if (oldDetails.has(p.id)) drop.push(p.id);
      continue;
    }

    const answerMap = new Map<string, Answer>((byAnswers.get(p.id) ?? []).map((a) => [a.criterion_id, a.answer]));
    const cachedAi = new Map<string, CriterionResult>(
      (oldDetails.get(p.id) ?? []).filter((d) => d.source === "ai").map((d) => [d.criterionId, d]),
    );
    const results = evaluateCriteria(criteria, factMap, answerMap, cachedAi);
    const scored = scoreTrial(results);
    upserts.push({
      patient_id: p.id,
      trial_id: trialId,
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

  for (let i = 0; i < upserts.length; i += 500) {
    const { error } = await admin.from("match_results").upsert(upserts.slice(i, i + 500), { onConflict: "patient_id,trial_id" });
    if (error) throw new Error(`Could not save matches: ${error.message}`);
  }
  for (let i = 0; i < drop.length; i += 200) {
    await admin.from("match_results").delete().eq("trial_id", trialId).in("patient_id", drop.slice(i, i + 200));
  }
  return upserts.length;
}
