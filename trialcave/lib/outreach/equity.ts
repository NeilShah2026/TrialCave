import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { townEquity, VULNERABILITY_RANK, type VulnerabilityBand } from "@/lib/geo/equity";
import { OUTREACH_COUNT_FLOOR } from "@/lib/env";

/** Minimum matching people in a town before the town is listed. */
const EQUITY_TOWN_MIN = Math.max(5, OUTREACH_COUNT_FLOOR);

/**
 * Community-level equity summary of a study's eligible pool (town-level only;
 * never exposes individuals). Answers: how representative is this recruiting
 * reach across Massachusetts' more- and less-vulnerable communities?
 */
export interface EquitySummary {
  totalTowns: number;
  ejCommunityCount: number;
  bandCounts: Record<VulnerabilityBand, number>;
  /** Towns in the pool, with their vulnerability band, sorted most-vulnerable first. */
  towns: { town: string; band: VulnerabilityBand; ejShare: number }[];
}

export async function getEquitySummary(trialId: string): Promise<EquitySummary> {
  const admin = createAdminClient();

  // Recruiting-reach pool = patients who match the study (strong/possible),
  // aggregated to TOWN level (never finer). This shows how representative the
  // study's reach is, independent of who has opted into invitations yet.
  // DECISION: count people per town and only list a town once it has at least
  // EQUITY_TOWN_MIN matching people, so a town name can never point at one or
  // two individuals. Withdrawn patients are left out. Paged past the 1000-row cap.
  const perTown = new Map<string, number>();
  for (let from = 0; ; from += 1000) {
    const { data: rows, error } = await admin
      .from("match_results")
      .select("patient_id, patients!inner(town, research_withdrawn)")
      .eq("trial_id", trialId)
      .in("status", ["strong", "possible"])
      .range(from, from + 999);
    if (error || !rows || rows.length === 0) break;
    for (const r of rows) {
      const p = r.patients as unknown as { town: string; research_withdrawn: boolean };
      if (!p.town || p.research_withdrawn) continue;
      perTown.set(p.town, (perTown.get(p.town) ?? 0) + 1);
    }
    if (rows.length < 1000) break;
  }
  const townSet = new Set([...perTown.entries()].filter(([, n]) => n >= EQUITY_TOWN_MIN).map(([t]) => t));

  const bandCounts: Record<VulnerabilityBand, number> = { low: 0, moderate: 0, high: 0, very_high: 0 };
  let ejCount = 0;
  const towns = [...townSet].map((t) => {
    const eq = townEquity(t);
    bandCounts[eq.svi]++;
    if (eq.ejShare >= 0.5) ejCount++;
    return { town: t, band: eq.svi, ejShare: eq.ejShare };
  });
  towns.sort((a, b) => VULNERABILITY_RANK[b.band] - VULNERABILITY_RANK[a.band]);

  return { totalTowns: towns.length, ejCommunityCount: ejCount, bandCounts, towns };
}
