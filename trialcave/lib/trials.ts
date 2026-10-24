import "server-only";

import { createClient } from "@/lib/supabase/server";
import { sortMassachusettsFirst, type TrialLocation } from "@/lib/ctgov/normalize";
import { haversineMiles, roundMiles } from "@/lib/geo/distance";

export interface TrialListItem {
  id: string;
  source: "ctgov" | "clinic";
  nctId: string | null;
  title: string;
  plainSummary: string | null;
  briefSummary: string | null;
  conditions: string[];
  conditionCategory: string;
  phases: string[];
  isDemo: boolean;
  locations: TrialLocation[];
  nearestMiles: number | null;
  nearestFacility: string | null;
}

export interface TrialDetail extends TrialListItem {
  officialTitle: string | null;
  whatIsInvolved: string | null;
  logistics: Record<string, unknown>;
  sponsor: string | null;
  studyType: string | null;
  overallStatus: string;
  studyStatus: string;
  sex: string;
  minAgeYears: number | null;
  maxAgeYears: number | null;
  eligibilityText: string | null;
  ctgovLastUpdated: string | null;
  parseStatus: string;
  irbProtocolNumber: string | null;
  contacts: { name: string | null; role: string | null; phone: string | null; email: string | null }[];
}

export interface Criterion {
  id: string;
  kind: "inclusion" | "exclusion";
  plainText: string;
  originalText: string;
  category: string;
  field: string | null;
  machineCheckable: boolean;
  patientQuestion: string | null;
  sortOrder: number;
}

function nearest(
  locations: TrialLocation[],
  origin: { lat: number; lon: number } | null,
): { miles: number | null; facility: string | null } {
  if (!origin) {
    const first = locations[0];
    return { miles: null, facility: first?.facility ?? null };
  }
  let best: { miles: number; facility: string | null } | null = null;
  for (const loc of locations) {
    if (loc.lat == null || loc.lon == null) continue;
    const m = haversineMiles(origin.lat, origin.lon, loc.lat, loc.lon);
    if (!best || m < best.miles) best = { miles: m, facility: loc.facility };
  }
  return best ? { miles: roundMiles(best.miles), facility: best.facility } : { miles: null, facility: locations[0]?.facility ?? null };
}

export interface SearchTrialsParams {
  query?: string;
  category?: string;
  page?: number;
  pageSize?: number;
  massachusettsOnly?: boolean;
  includeDemo?: boolean;
  origin?: { lat: number; lon: number } | null;
}

export interface SearchTrialsResult {
  items: TrialListItem[];
  total: number;
  lastSync: string | null;
}

export async function searchTrials(params: SearchTrialsParams): Promise<SearchTrialsResult> {
  const supabase = await createClient();
  const pageSize = params.pageSize ?? 20;
  const page = params.page ?? 1;
  const from = (page - 1) * pageSize;

  let q = supabase
    .from("trials")
    .select(
      "id, source, nct_id, title, plain_summary, brief_summary, conditions, condition_category, phases, is_demo, locations, updated_at",
      { count: "exact" },
    )
    .or("source.eq.ctgov,study_status.eq.active");

  if (params.query) {
    q = q.textSearch("search", params.query, { type: "websearch" });
  }
  if (params.category && params.category !== "all") {
    q = q.eq("condition_category", params.category);
  }
  if (!params.includeDemo) {
    q = q.eq("is_demo", false);
  }

  q = q.order("updated_at", { ascending: false }).range(from, from + pageSize - 1);

  const { data, count, error } = await q;
  if (error) throw new Error(`searchTrials failed: ${error.message}`);

  const items: TrialListItem[] = (data ?? []).map((row) => {
    const locations = (row.locations ?? []) as TrialLocation[];
    const n = nearest(locations, params.origin ?? null);
    return {
      id: row.id,
      source: row.source,
      nctId: row.nct_id,
      title: row.title,
      plainSummary: row.plain_summary,
      briefSummary: row.brief_summary,
      conditions: row.conditions ?? [],
      conditionCategory: row.condition_category,
      phases: row.phases ?? [],
      isDemo: row.is_demo,
      locations: sortMassachusettsFirst(locations),
      nearestMiles: n.miles,
      nearestFacility: n.facility,
    };
  });

  // Last sync = newest ctgov updated_at.
  const { data: lastRow } = await supabase
    .from("trials")
    .select("updated_at")
    .eq("source", "ctgov")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return { items, total: count ?? 0, lastSync: lastRow?.updated_at ?? null };
}

export async function getTrialDetail(
  id: string,
  origin?: { lat: number; lon: number } | null,
): Promise<{ trial: TrialDetail; criteria: Criterion[] } | null> {
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("trials")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !row) return null;

  const { data: critRows } = await supabase
    .from("trial_criteria")
    .select("*")
    .eq("trial_id", id)
    .order("sort_order", { ascending: true });

  const locations = (row.locations ?? []) as TrialLocation[];
  const n = nearest(locations, origin ?? null);

  const trial: TrialDetail = {
    id: row.id,
    source: row.source,
    nctId: row.nct_id,
    title: row.title,
    officialTitle: row.official_title,
    plainSummary: row.plain_summary,
    briefSummary: row.brief_summary,
    whatIsInvolved: row.what_is_involved,
    logistics: row.logistics ?? {},
    conditions: row.conditions ?? [],
    conditionCategory: row.condition_category,
    phases: row.phases ?? [],
    isDemo: row.is_demo,
    locations: sortMassachusettsFirst(locations),
    nearestMiles: n.miles,
    nearestFacility: n.facility,
    sponsor: row.sponsor,
    studyType: row.study_type,
    overallStatus: row.overall_status,
    studyStatus: row.study_status,
    sex: row.sex,
    minAgeYears: row.min_age_years,
    maxAgeYears: row.max_age_years,
    eligibilityText: row.eligibility_text,
    ctgovLastUpdated: row.ctgov_last_updated,
    parseStatus: row.parse_status,
    irbProtocolNumber: row.irb_protocol_number,
    contacts: (row.contacts ?? []) as TrialDetail["contacts"],
  };

  const criteria: Criterion[] = (critRows ?? []).map((c) => ({
    id: c.id,
    kind: c.kind,
    plainText: c.plain_text,
    originalText: c.original_text,
    category: c.category,
    field: c.field,
    machineCheckable: c.machine_checkable,
    patientQuestion: c.patient_question,
    sortOrder: c.sort_order,
  }));

  return { trial, criteria };
}
