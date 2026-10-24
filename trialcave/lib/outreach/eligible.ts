import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { OUTREACH_MIN_SCORE, OUTREACH_COUNT_FLOOR, DEMO_MODE } from "@/lib/env";
import { haversineMiles } from "@/lib/geo/distance";
import type { CriterionResult, MatchStatus } from "@/lib/matching/types";
import type { TrialLocation } from "@/lib/ctgov/normalize";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Outreach eligibility (B14.4.2). A patient is counted/invited for a study only
 * if ALL conditions hold. AI-estimated criterion results are treated as unknown
 * (only `data` and `answer` passes count), so outreach never relies on AI.
 */

export interface OutreachResult {
  eligiblePatientIds: string[];
  strongCount: number;
  possibleCount: number;
}

/** Recompute status from details, treating AI results as unknown (B14.4.2 rule 1). */
function nonAiStatus(details: CriterionResult[]): { status: MatchStatus; score: number } {
  let pass = 0;
  let fail = 0;
  let unknown = 0;
  for (const d of details) {
    if (d.status === "na") continue;
    // AI-sourced results count as unknown for outreach.
    const effective = d.source === "ai" ? "unknown" : d.status;
    if (effective === "pass") pass++;
    else if (effective === "fail") fail++;
    else unknown++;
  }
  if (fail > 0) return { status: "ineligible", score: pass / Math.max(1, pass + fail + unknown) };
  const denom = pass + unknown;
  if (denom === 0) return { status: "needs_info", score: 0 };
  const score = pass / denom;
  const status: MatchStatus = score >= 0.8 ? "strong" : score >= 0.5 ? "possible" : "needs_info";
  return { status, score };
}

export async function computeOutreach(admin: Admin, trialId: string): Promise<OutreachResult> {
  // Trial location + condition category.
  const { data: trial } = await admin
    .from("trials")
    .select("clinic_id, condition_category, locations")
    .eq("id", trialId)
    .maybeSingle();
  if (!trial) return { eligiblePatientIds: [], strongCount: 0, possibleCount: 0 };

  const locations = (trial.locations ?? []) as TrialLocation[];
  const site = locations.find((l) => l.lat != null && l.lon != null) ?? null;

  // Muted clinic set.
  const { data: muted } = await admin
    .from("muted_clinics")
    .select("patient_id")
    .eq("clinic_id", trial.clinic_id);
  const mutedSet = new Set((muted ?? []).map((m) => m.patient_id));

  // Existing invitations (one per patient per study).
  const { data: invited } = await admin.from("invitations").select("patient_id").eq("trial_id", trialId);
  const invitedSet = new Set((invited ?? []).map((i) => i.patient_id));

  // All match rows for this trial (strong/possible, fail_count 0).
  const { data: matchRows } = await admin
    .from("match_results")
    .select("patient_id, status, fail_count, details, patients!inner(lat, lon, travel_radius_miles, research_withdrawn, is_synthetic)")
    .eq("trial_id", trialId)
    .in("status", ["strong", "possible"]);

  // Contact prefs.
  const patientIds = (matchRows ?? []).map((r) => r.patient_id);
  const prefMap = new Map<string, { allow: boolean; categories: string[] }>();
  for (let i = 0; i < patientIds.length; i += 500) {
    const chunk = patientIds.slice(i, i + 500);
    const { data: prefs } = await admin
      .from("contact_preferences")
      .select("patient_id, allow_invitations, condition_categories")
      .in("patient_id", chunk);
    for (const p of prefs ?? []) prefMap.set(p.patient_id, { allow: p.allow_invitations, categories: p.condition_categories ?? [] });
  }

  const eligible: string[] = [];
  let strong = 0;
  let possible = 0;

  for (const row of matchRows ?? []) {
    if (row.fail_count > 0) continue;
    const patient = row.patients as unknown as {
      lat: number; lon: number; travel_radius_miles: number; research_withdrawn: boolean; is_synthetic: boolean;
    };
    if (patient.research_withdrawn) continue;
    if (!patient.is_synthetic ? false : !DEMO_MODE) continue; // synthetic only allowed in demo mode

    // Rule 1: non-AI score >= OUTREACH_MIN_SCORE.
    const { status, score } = nonAiStatus((row.details ?? []) as CriterionResult[]);
    if (status !== "strong" && status !== "possible") continue;
    if (score < OUTREACH_MIN_SCORE) continue;

    // Rule 2: invitations allowed + category match.
    const pref = prefMap.get(row.patient_id);
    if (!pref || !pref.allow) continue;
    if (!pref.categories.includes(trial.condition_category)) continue;

    // Rule 3: distance within travel radius.
    if (site && site.lat != null && site.lon != null) {
      const miles = haversineMiles(patient.lat, patient.lon, site.lat, site.lon);
      if (miles > patient.travel_radius_miles) continue;
    }

    // Rule 4 & 5: not muted, no existing invitation.
    if (mutedSet.has(row.patient_id)) continue;
    if (invitedSet.has(row.patient_id)) continue;

    eligible.push(row.patient_id);
    if (status === "strong") strong++;
    else possible++;
  }

  return { eligiblePatientIds: eligible, strongCount: strong, possibleCount: possible };
}

export interface OutreachCount {
  total: number;
  strong: number;
  possible: number;
  /** True if the count is below the floor and should be shown as "fewer than N". */
  belowFloor: boolean;
}

export async function getOutreachCount(trialId: string): Promise<OutreachCount> {
  const admin = createAdminClient();
  const r = await computeOutreach(admin, trialId);
  const total = r.eligiblePatientIds.length;
  return {
    total,
    strong: r.strongCount,
    possible: r.possibleCount,
    belowFloor: total < OUTREACH_COUNT_FLOOR,
  };
}
