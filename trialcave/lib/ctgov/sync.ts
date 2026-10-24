import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { fetchTrials, type RawStudy } from "@/lib/ctgov/fetch";
import { normalizeStudy, type NormalizedTrial } from "@/lib/ctgov/normalize";

export interface SyncOptions {
  condition?: string;
  location: string;
  geoFilter?: string;
  maxTrials: number;
  minLocalTrials: number;
  actorUserId?: string | null;
}

export interface SyncResult {
  fetched: number;
  inserted: number;
  updated: number;
  totalAvailable: number;
  usedGeoFallback: boolean;
}

function toRow(t: NormalizedTrial) {
  return {
    source: "ctgov" as const,
    nct_id: t.nctId,
    title: t.title,
    official_title: t.officialTitle,
    brief_summary: t.briefSummary,
    conditions: t.conditions,
    condition_category: t.conditionCategory,
    phases: t.phases,
    overall_status: t.overallStatus,
    study_type: t.studyType,
    sponsor: t.sponsor,
    min_age_years: t.minAgeYears,
    max_age_years: t.maxAgeYears,
    sex: t.sex,
    healthy_volunteers: t.healthyVolunteers,
    eligibility_text: t.eligibilityText,
    enrollment: t.enrollment,
    locations: t.locations,
    contacts: t.contacts,
    ctgov_last_updated: t.ctgovLastUpdated,
    study_status: "active" as const,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Loads recruiting trials from ClinicalTrials.gov and upserts by nct_id (B8.2).
 * If a trial's ctgov_last_updated changed, resets parse_status to 'pending' and
 * deletes its criteria so it re-parses.
 */
export async function syncTrials(opts: SyncOptions): Promise<SyncResult> {
  const admin = createAdminClient();

  // 1. Primary pull (location-based).
  const primary = await fetchTrials({
    condition: opts.condition,
    location: opts.location,
    maxTrials: opts.maxTrials,
  });

  const studies: RawStudy[] = primary.studies;
  let usedGeoFallback = false;

  // 2. Geo fallback if too few.
  if (studies.length < opts.minLocalTrials && opts.geoFilter) {
    const fallback = await fetchTrials(
      {
        condition: opts.condition,
        geoFilter: opts.geoFilter,
        maxTrials: opts.maxTrials,
      },
      true,
    );
    // Merge, de-duping by nctId.
    const seen = new Set(
      studies
        .map((s) => normalizeStudy(s)?.nctId)
        .filter((x): x is string => Boolean(x)),
    );
    for (const s of fallback.studies) {
      const n = normalizeStudy(s);
      if (n && !seen.has(n.nctId)) {
        studies.push(s);
        seen.add(n.nctId);
      }
      if (studies.length >= opts.maxTrials) break;
    }
    usedGeoFallback = true;
  }

  const normalized = studies
    .map(normalizeStudy)
    .filter((t): t is NormalizedTrial => t !== null);

  // 3. Load existing rows to detect updates and ctgov_last_updated changes.
  const nctIds = normalized.map((t) => t.nctId);
  const existing = new Map<string, { id: string; ctgov_last_updated: string | null }>();
  for (let i = 0; i < nctIds.length; i += 500) {
    const chunk = nctIds.slice(i, i + 500);
    const { data } = await admin
      .from("trials")
      .select("id, nct_id, ctgov_last_updated")
      .in("nct_id", chunk);
    for (const row of data ?? []) existing.set(row.nct_id, { id: row.id, ctgov_last_updated: row.ctgov_last_updated });
  }

  let inserted = 0;
  let updated = 0;
  const changedTrialIds: string[] = [];

  for (const t of normalized) {
    const prev = existing.get(t.nctId);
    const row = toRow(t);
    const dateChanged = !prev || prev.ctgov_last_updated !== t.ctgovLastUpdated;

    const { error } = await admin.from("trials").upsert(
      {
        ...row,
        // Only reset parse_status when the ctgov date changed (or new).
        ...(dateChanged ? { parse_status: "pending" } : {}),
      },
      { onConflict: "nct_id" },
    );
    if (error) {
      console.error(`[ctgov] upsert ${t.nctId} failed: ${error.message}`);
      continue;
    }
    if (prev) {
      updated++;
      if (dateChanged) changedTrialIds.push(prev.id);
    } else {
      inserted++;
    }
  }

  // 4. Delete stale criteria for trials whose ctgov date changed, so they re-parse.
  if (changedTrialIds.length) {
    for (let i = 0; i < changedTrialIds.length; i += 200) {
      await admin.from("trial_criteria").delete().in("trial_id", changedTrialIds.slice(i, i + 200));
    }
  }

  await logAudit({
    actorUserId: opts.actorUserId ?? null,
    actorRole: "admin",
    action: "trials.synced",
    metadata: { fetched: normalized.length, inserted, updated },
  });

  return {
    fetched: normalized.length,
    inserted,
    updated,
    totalAvailable: primary.totalCount,
    usedGeoFallback,
  };
}
