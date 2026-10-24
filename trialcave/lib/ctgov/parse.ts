import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { parseCriteria, type ParsedTrial } from "@/lib/ai/parseCriteria";

type Admin = ReturnType<typeof createAdminClient>;

export interface ParseProgress {
  parsed: number;
  failed: number;
  total: number;
}

interface PendingTrial {
  id: string;
  title: string;
  conditions: string[];
  min_age_years: number | null;
  max_age_years: number | null;
  sex: string;
  brief_summary: string | null;
  eligibility_text: string | null;
}

async function saveParsed(admin: Admin, trialId: string, parsed: ParsedTrial): Promise<void> {
  // Replace any existing criteria for this trial.
  await admin.from("trial_criteria").delete().eq("trial_id", trialId);

  const rows = parsed.criteria.map((c, i) => ({
    trial_id: trialId,
    kind: c.kind,
    original_text: c.original_text,
    plain_text: c.plain_text,
    category: c.category,
    field: c.field,
    operator: c.operator,
    value_min: c.value_min,
    value_max: c.value_max,
    value_text: c.value_text,
    unit: c.unit,
    machine_checkable: c.machine_checkable,
    patient_question: c.patient_question,
    sort_order: i,
  }));
  if (rows.length) await admin.from("trial_criteria").insert(rows);

  await admin
    .from("trials")
    .update({
      plain_summary: parsed.plain_summary,
      what_is_involved: parsed.what_is_involved,
      logistics: parsed.logistics,
      parse_status: "parsed",
    })
    .eq("id", trialId);
}

async function parseOne(admin: Admin, t: PendingTrial): Promise<"parsed" | "failed"> {
  try {
    const parsed = await parseCriteria({
      title: t.title,
      conditions: t.conditions,
      minAgeYears: t.min_age_years,
      maxAgeYears: t.max_age_years,
      sex: t.sex,
      briefSummary: t.brief_summary,
      eligibilityText: t.eligibility_text,
    });
    await saveParsed(admin, t.id, parsed);
    return "parsed";
  } catch (err) {
    console.error(`[parse] ${t.id} failed: ${err instanceof Error ? err.message : err}`);
    await admin.from("trials").update({ parse_status: "failed" }).eq("id", t.id);
    return "failed";
  }
}

/**
 * Parse pending ctgov trials (B11.2). Concurrency-limited and resumable: only
 * trials with parse_status='pending' are touched, so re-running continues.
 */
export async function parsePendingTrials(opts: { limit?: number; concurrency?: number } = {}): Promise<ParseProgress> {
  const admin = createAdminClient();
  const concurrency = opts.concurrency ?? 4;

  let query = admin
    .from("trials")
    .select("id, title, conditions, min_age_years, max_age_years, sex, brief_summary, eligibility_text")
    .eq("source", "ctgov")
    .eq("parse_status", "pending");
  if (opts.limit) query = query.limit(opts.limit);

  const { data, error } = await query;
  if (error) throw new Error(`load pending failed: ${error.message}`);
  const pending = (data ?? []) as PendingTrial[];

  const progress: ParseProgress = { parsed: 0, failed: 0, total: pending.length };

  // Simple concurrency pool.
  let index = 0;
  async function worker() {
    while (index < pending.length) {
      const t = pending[index++];
      const result = await parseOne(admin, t);
      if (result === "parsed") progress.parsed++;
      else progress.failed++;
      if ((progress.parsed + progress.failed) % 10 === 0) {
        console.log(`  …${progress.parsed + progress.failed}/${progress.total}`);
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  return progress;
}
