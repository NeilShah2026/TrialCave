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
        <CardContent className="pt-6 text-sm text-muted-foreground">
          No communities to summarize yet. A town appears here once at least 5
          people there match your study, so no one can be singled out.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="text-lg font-semibold">Equitable reach</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          How your recruiting reach spreads across Massachusetts communities. This is
          community-level context (towns, not people) to support representative
          recruitment. Towns with fewer than 5 matching people aren&apos;t listed.
        </p>

        <p className="mt-4 text-sm">
          Your eligible pool spans <span className="font-semibold">{summary.totalTowns}</span> towns,
          including <span className="font-semibold">{summary.ejCommunityCount}</span> environmental-justice
          communities.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {(["very_high", "high", "moderate", "low"] as VulnerabilityBand[]).map((b) => (
            <Badge key={b} variant={BAND_VARIANT[b]}>
              {VULNERABILITY_LABEL[b]}: {summary.bandCounts[b]}
            </Badge>
          ))}
        </div>

        <div className="mt-4">
          <p className="text-sm font-semibold">Communities in reach</p>
          <ul className="mt-1 grid grid-cols-2 gap-x-6 text-sm text-muted-foreground sm:grid-cols-3">
            {summary.towns.map((t) => (
              <li key={t.town}>
                {t.town} <span className="text-xs">({VULNERABILITY_LABEL[t.band].split(" ")[0].toLowerCase()})</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Source: MassGIS EJ2020 and the CDC/ATSDR Social Vulnerability Index.
          Underserved communities are historically under-represented in trials;
          reaching them improves how well results generalize.
        </p>
      </CardContent>
    </Card>
  );
}
