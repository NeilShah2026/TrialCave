import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { townEquity, VULNERABILITY_RANK, type VulnerabilityBand } from "@/lib/geo/equity";

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
  const townSet = new Set<string>();
  const { data: rows } = await admin
    .from("match_results")
    .select("patient_id, patients!inner(town)")
    .eq("trial_id", trialId)
    .in("status", ["strong", "possible"]);
  for (const r of rows ?? []) {
    const town = (r.patients as unknown as { town: string }).town;
    if (town) townSet.add(town);
  }

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
