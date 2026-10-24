import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VULNERABILITY_LABEL, type VulnerabilityBand } from "@/lib/geo/equity";
import type { EquitySummary } from "@/lib/outreach/equity";

const BAND_VARIANT: Record<VulnerabilityBand, "success" | "warning" | "danger" | "muted"> = {
  low: "muted",
  moderate: "warning",
  high: "warning",
  very_high: "danger",
};

export function EquitySummaryView({ summary }: { summary: EquitySummary }) {
  if (summary.totalTowns === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-[1.05rem] text-tc-ink-2 sm:p-8">
          No communities to summarize yet. A town appears here once at least 5
          people there match your study, so no one can be singled out.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-6 p-6 sm:p-8">
        <div>
          <h2 className="text-[1.45rem] font-extrabold tracking-tight">Equitable reach</h2>
          <p className="mt-2 max-w-[48rem] text-[1.05rem] text-tc-ink-2">
            How your recruiting reach spreads across Massachusetts communities. This is
            community-level context (towns, not people) to support representative
            recruitment. Towns with fewer than 5 matching people aren&apos;t listed.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-tc-mist p-5">
            <p className="text-[2.4rem] font-extrabold leading-none tracking-tight text-tc-secondary">{summary.totalTowns}</p>
            <p className="mt-2 font-bold text-tc-ink-2">Towns in your eligible pool</p>
          </div>
          <div className="rounded-2xl bg-tc-mist p-5">
            <p className="text-[2.4rem] font-extrabold leading-none tracking-tight text-tc-secondary">{summary.ejCommunityCount}</p>
            <p className="mt-2 font-bold text-tc-ink-2">Environmental-justice communities</p>
          </div>
        </div>
        <p className="sr-only">
          Your eligible pool spans {summary.totalTowns} towns, including {summary.ejCommunityCount} environmental-justice communities.
        </p>

        <div className="flex flex-wrap gap-3">
          {(["very_high", "high", "moderate", "low"] as VulnerabilityBand[]).map((b) => (
            <Badge key={b} variant={BAND_VARIANT[b]} className="px-4 py-2 text-[0.95rem]">
              {VULNERABILITY_LABEL[b]}: {summary.bandCounts[b]}
            </Badge>
          ))}
        </div>

        <div>
          <h3 className="text-[1.15rem] font-bold">Communities in reach</h3>
          <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-[1.05rem] text-tc-ink sm:grid-cols-3 lg:grid-cols-4">
            {summary.towns.map((t) => (
              <li key={t.town}>
                {t.town} <span className="text-[0.95rem] text-tc-muted">({VULNERABILITY_LABEL[t.band].split(" ")[0].toLowerCase()})</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-[0.95rem] text-tc-muted">
          Source: MassGIS EJ2020 and the CDC/ATSDR Social Vulnerability Index.
          Underserved communities are historically under-represented in trials;
          reaching them improves how well results generalize.
        </p>
      </CardContent>
    </Card>
  );
}
