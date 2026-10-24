import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { STATUS_LABEL, STATUS_VARIANT, scorePct } from "@/lib/match-status";
import type { MatchRow } from "@/lib/patient";

export function MatchCard({ match }: { match: MatchRow }) {
  const total = match.passCount + match.failCount + match.unknownCount;
  const topReason = match.details.find((d) => d.status === "fail")?.reason
    ?? match.details.find((d) => d.status === "unknown")?.reason
    ?? match.details.find((d) => d.status === "pass")?.reason
    ?? "";

  return (
    <Link href={`/app/matches/${match.trialId}`} className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <Card className="transition-colors hover:border-primary">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-semibold leading-snug">{match.title}</h3>
            <Badge variant={STATUS_VARIANT[match.status]}>{STATUS_LABEL[match.status]}</Badge>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <Progress value={scorePct(match.score)} className="max-w-[160px]" aria-label={`Match score ${scorePct(match.score)}%`} />
            <span className="text-sm text-muted-foreground">
              {match.passCount} of {total} criteria met
              {match.unknownCount > 0 ? ` · ${match.unknownCount} unknown` : ""}
            </span>
          </div>
          {topReason ? <p className="mt-2 text-sm text-muted-foreground">{topReason}</p> : null}
          <p className="mt-2 text-xs text-muted-foreground">
            {match.isDemo ? "Demo study (fictional)" : match.source === "clinic" ? "TrialCave clinic study" : "ClinicalTrials.gov"}
            {match.distanceMiles != null ? ` · ${match.distanceMiles} mi` : ""}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
