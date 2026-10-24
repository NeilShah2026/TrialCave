import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { STATUS_LABEL, scorePct } from "@/lib/match-status";
import type { MatchStatus } from "@/lib/matching/types";
import type { MatchRow } from "@/lib/patient";

/** Design v3 pill colors: fit = sage, possible = teal, unknown = amber, not a fit = coral. */
export const PILL_VARIANT: Record<MatchStatus, "success" | "teal" | "warning" | "danger"> = {
  strong: "success",
  possible: "teal",
  needs_info: "warning",
  ineligible: "danger",
};

export function MatchCard({ match }: { match: MatchRow }) {
  const total = match.passCount + match.failCount + match.unknownCount;
  const topReason = match.details.find((d) => d.status === "fail")?.reason
    ?? match.details.find((d) => d.status === "unknown")?.reason
    ?? match.details.find((d) => d.status === "pass")?.reason
    ?? "";

  return (
    <Link
      href={`/app/matches/${match.trialId}`}
      className="group block rounded-[24px] bg-white p-6 shadow-card transition-shadow hover:shadow-pop focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-tc-primary-soft"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Badge variant={PILL_VARIANT[match.status]}>{STATUS_LABEL[match.status]}</Badge>
        <span className="flex items-center gap-1.5 text-[0.95rem] text-tc-muted">
          {match.distanceMiles != null ? (
            <>
              <MapPin className="size-4" aria-hidden /> {match.distanceMiles} mi ·{" "}
            </>
          ) : null}
          {match.isDemo ? "Demo study (fictional)" : match.source === "clinic" ? "TrialCave clinic study" : "ClinicalTrials.gov"}
        </span>
      </div>
      <h3 className="mt-3 text-[1.2rem] font-extrabold leading-snug tracking-tight text-tc-ink">{match.title}</h3>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Progress value={scorePct(match.score)} className="max-w-[160px]" aria-label={`Match score ${scorePct(match.score)}%`} />
        <span className="text-[0.95rem] font-semibold text-tc-ink-2">
          {match.passCount} of {total} criteria met
          {match.unknownCount > 0 ? ` · ${match.unknownCount} unknown` : ""}
        </span>
      </div>
      {topReason ? <p className="mt-3 text-[1rem] text-tc-ink-2">{topReason}</p> : null}
      <span className="mt-4 inline-flex items-center gap-1.5 text-[1rem] font-bold text-tc-primary-ink group-hover:underline">
        See why <ArrowRight className="size-4" aria-hidden />
      </span>
    </Link>
  );
}
