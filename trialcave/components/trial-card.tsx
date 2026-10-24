import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { categoryLabel } from "@/lib/categories";
import type { TrialListItem } from "@/lib/trials";

function truncate(text: string, n: number): string {
  return text.length > n ? `${text.slice(0, n).trimEnd()}…` : text;
}

export function TrialCard({ trial }: { trial: TrialListItem }) {
  const summary = trial.plainSummary ?? trial.briefSummary ?? "";
  const maLocation = trial.locations.find((l) => l.state === "Massachusetts") ?? trial.locations[0];

  return (
    <Link
      href={`/trials/${trial.id}`}
      className="group flex h-full flex-col rounded-[24px] border-2 border-transparent bg-white p-6 shadow-card transition-colors hover:border-tc-primary sm:p-7"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="teal">{categoryLabel(trial.conditionCategory)}</Badge>
        {trial.phases.filter((p) => p !== "NA").map((p) => (
          <Badge key={p} variant="outline">
            {p.replace("PHASE", "Phase ")}
          </Badge>
        ))}
        {trial.isDemo ? <Badge variant="warning">Demo study (fictional)</Badge> : null}
      </div>
      <h3 className="mt-3 text-[1.2rem] font-extrabold leading-snug">{trial.title}</h3>
      {summary ? <p className="mt-2 text-[1rem] text-tc-ink-2">{truncate(summary, 180)}</p> : null}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-4">
        {maLocation?.facility ? (
          <p className="flex items-center gap-1.5 text-[0.95rem] text-tc-muted">
            <MapPin className="size-4 shrink-0" aria-hidden />
            <span>
              {maLocation.facility}
              {maLocation.city ? `, ${maLocation.city}` : ""}
              {trial.nearestMiles != null ? ` · ${trial.nearestMiles} mi` : ""}
            </span>
          </p>
        ) : (
          <span />
        )}
        <span className="inline-flex items-center gap-1 text-[0.95rem] font-bold text-tc-primary-ink group-hover:underline">
          See details <ArrowRight className="size-4" aria-hidden />
        </span>
      </div>
    </Link>
  );
}
