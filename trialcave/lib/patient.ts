import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getMissingInfo, type MissingItem } from "@/lib/matching/missingInfo";
import { compareMatches } from "@/lib/matching/score";
import type { CriterionResult, MatchStatus } from "@/lib/matching/types";

export interface MatchRow {
  trialId: string;
  title: string;
  source: "ctgov" | "clinic";
  isDemo: boolean;
  conditionCategory: string;
  status: MatchStatus;
  score: number;
  passCount: number;
  failCount: number;
  unknownCount: number;
  details: CriterionResult[];
  distanceMiles: number | null;
}

export interface ChangeRow {
  id: string;
  trialId: string;
  trialTitle: string;
  fromStatus: MatchStatus | null;
  toStatus: MatchStatus | null;
  triggerType: string;
  triggerLabel: string;
  changedCriteria: { criterionId: string; plainText: string; from: string | null; to: string; reason: string }[];
  seenAt: string | null;
  createdAt: string;
}

export interface PatientProfile {
  id: string;
  displayName: string;
  isDonor: boolean;
  preferredLanguage: string;
  emailIngestEnabled: boolean;
  inboxToken: string | null;
}

/** Load the full patient row (more than lib/auth's getMyPatient). */
export async function loadProfile(patientId: string): Promise<PatientProfile | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("patients")
    .select("id, display_name, is_donor, preferred_language, email_ingest_enabled, inbox_token")
    .eq("id", patientId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    displayName: data.display_name,
    isDonor: data.is_donor,
    preferredLanguage: data.preferred_language,
    emailIngestEnabled: data.email_ingest_enabled,
    inboxToken: data.inbox_token,
  };
}

export async function loadMatches(patientId: string): Promise<MatchRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("match_results")
    .select("trial_id, status, score, pass_count, fail_count, unknown_count, details, distance_miles, trials!inner(title, source, is_demo, condition_category)")
    .eq("patient_id", patientId);

  const rows: MatchRow[] = (data ?? []).map((r) => {
    const trial = r.trials as unknown as { title: string; source: "ctgov" | "clinic"; is_demo: boolean; condition_category: string };
    return {
      trialId: r.trial_id,
      title: trial.title,
      source: trial.source,
      isDemo: trial.is_demo,
      conditionCategory: trial.condition_category,
      status: r.status,
      score: Number(r.score),
      passCount: r.pass_count,
      failCount: r.fail_count,
      unknownCount: r.unknown_count,
      details: (r.details ?? []) as CriterionResult[],
      distanceMiles: r.distance_miles != null ? Number(r.distance_miles) : null,
    };
  });

  rows.sort(compareMatches);
  return rows;
}

export function topMatches(rows: MatchRow[], n = 3): MatchRow[] {
  return rows.filter((r) => r.status !== "ineligible").slice(0, n);
}

export async function loadMissingInfo(rows: MatchRow[]): Promise<MissingItem[]> {
  return getMissingInfo(rows.map((r) => ({ status: r.status, details: r.details })));
}

export async function loadUnseenChanges(patientId: string): Promise<ChangeRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("match_changes")
    .select("id, trial_id, from_status, to_status, trigger_type, trigger_label, changed_criteria, seen_at, created_at, trials!inner(title)")
    .eq("patient_id", patientId)
    .is("seen_at", null)
    .order("created_at", { ascending: false });
  return (data ?? []).map((c) => ({
    id: c.id,
    trialId: c.trial_id,
    trialTitle: (c.trials as unknown as { title: string }).title,
    fromStatus: c.from_status,
    toStatus: c.to_status,
    triggerType: c.trigger_type,
    triggerLabel: c.trigger_label,
    changedCriteria: (c.changed_criteria ?? []) as ChangeRow["changedCriteria"],
    seenAt: c.seen_at,
    createdAt: c.created_at,
  }));
}

export async function loadAllChanges(patientId: string): Promise<ChangeRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("match_changes")
    .select("id, trial_id, from_status, to_status, trigger_type, trigger_label, changed_criteria, seen_at, created_at, trials!inner(title)")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });
  return (data ?? []).map((c) => ({
    id: c.id,
    trialId: c.trial_id,
    trialTitle: (c.trials as unknown as { title: string }).title,
    fromStatus: c.from_status,
    toStatus: c.to_status,
    triggerType: c.trigger_type,
    triggerLabel: c.trigger_label,
    changedCriteria: (c.changed_criteria ?? []) as ChangeRow["changedCriteria"],
    seenAt: c.seen_at,
    createdAt: c.created_at,
  }));
}

export interface DonorSummary {
  totalCents: number;
  donationCents: number;
  researchCents: number;
  studyCount: number;
  entries: { description: string; amountCents: number; kind: string; createdAt: string }[];
}

export async function loadDonorSummary(patientId: string): Promise<DonorSummary> {
  const admin = createAdminClient();
  const { data: earnings } = await admin
    .from("donor_earnings")
    .select("kind, amount_cents, description, created_at, status")
    .eq("patient_id", patientId)
    .neq("status", "void")
    .order("created_at", { ascending: false });

  let donation = 0;
  let research = 0;
  const entries = (earnings ?? []).map((e) => {
    if (e.kind === "donation") donation += e.amount_cents;
    else research += e.amount_cents;
    return { description: e.description, amountCents: e.amount_cents, kind: e.kind, createdAt: e.created_at };
  });

  const { count } = await admin
    .from("donor_contributions")
    .select("project_id", { count: "exact", head: true })
    .eq("patient_id", patientId);

  // Until real contributions are seeded (Phase 8), fall back to the number of
  // research-share earnings as the "studies supported" count for the demo.
  const researchShareCount = entries.filter((e) => e.kind === "research_share").length;
  const studyCount = count && count > 0 ? count : researchShareCount;

  return {
    totalCents: donation + research,
    donationCents: donation,
    researchCents: research,
    studyCount,
    entries,
  };
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
