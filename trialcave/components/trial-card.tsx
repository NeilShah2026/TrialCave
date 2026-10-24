import Link from "next/link";
import { MapPin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { categoryLabel } from "@/lib/categories";
import type { TrialListItem } from "@/lib/trials";

function truncate(text: string, n: number): string {
  return text.length > n ? `${text.slice(0, n).trimEnd()}…` : text;
}

export function TrialCard({ trial }: { trial: TrialListItem }) {
  const summary = trial.plainSummary ?? trial.briefSummary ?? "";
  const maLocation =
    trial.locations.find((l) => l.state === "Massachusetts") ?? trial.locations[0];

  return (
    <Link href={`/trials/${trial.id}`} className="block">
      <Card className="transition-colors hover:border-primary">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{categoryLabel(trial.conditionCategory)}</Badge>
            {trial.phases.map((p) => (
              <Badge key={p} variant="outline">
                {p.replace("PHASE", "Phase ")}
              </Badge>
            ))}
            <Badge variant="muted">
              {trial.isDemo ? "Demo study (fictional)" : "ClinicalTrials.gov"}
            </Badge>
          </div>
          <h3 className="mt-3 font-semibold leading-snug">{trial.title}</h3>
          {summary ? (
            <p className="mt-1 text-sm text-muted-foreground">{truncate(summary, 180)}</p>
          ) : null}
          {maLocation?.facility ? (
            <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="size-3.5" aria-hidden />
              {maLocation.facility}
              {maLocation.city ? `, ${maLocation.city}` : ""}
              {trial.nearestMiles != null ? ` · ${trial.nearestMiles} mi` : ""}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </Link>
  );
}
