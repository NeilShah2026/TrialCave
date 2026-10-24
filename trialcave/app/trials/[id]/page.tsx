import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, ExternalLink, MapPin } from "lucide-react";

import { PublicHeader } from "@/components/public-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CriteriaList } from "@/components/criteria-list";
import { categoryLabel } from "@/lib/categories";
import { getTrialDetail } from "@/lib/trials";

export const dynamic = "force-dynamic";

export default async function TrialDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getTrialDetail(id);
  if (!detail) notFound();

  const { trial, criteria } = detail;
  const summary = trial.plainSummary ?? trial.briefSummary ?? "";
  const parseFailed = trial.parseStatus === "failed" || criteria.length === 0;

  return (
    <main className="flex-1">
      <PublicHeader />
      <div className="mx-auto max-w-[800px] px-4 py-8">
        <Link
          href="/trials"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden /> Back to trials
        </Link>

        <div className="mt-4 flex flex-wrap items-center gap-2">
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

        <h1 className="mt-3 text-2xl font-semibold">{trial.title}</h1>
        {trial.nctId ? (
          <p className="mt-1 text-sm text-muted-foreground">{trial.nctId}</p>
        ) : null}

        {summary ? (
          <Card className="mt-6">
            <CardContent className="pt-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                In plain words
              </h2>
              <p className="mt-2 text-sm">{summary}</p>
              {trial.whatIsInvolved ? (
                <p className="mt-3 text-sm text-muted-foreground">{trial.whatIsInvolved}</p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        <Card className="mt-4">
          <CardContent className="pt-6">
            {parseFailed ? (
              <div>
                <p className="text-sm text-muted-foreground">
                  Eligibility checklist unavailable. Read the full criteria below.
                </p>
                {trial.eligibilityText ? (
                  <pre className="mt-3 whitespace-pre-wrap rounded-md bg-muted p-4 text-sm">
                    {trial.eligibilityText}
                  </pre>
                ) : null}
              </div>
            ) : (
              <CriteriaList criteria={criteria} />
            )}
          </CardContent>
        </Card>

        {trial.locations.length > 0 ? (
          <Card className="mt-4">
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold">Where</h2>
              <ul className="mt-3 space-y-2">
                {trial.locations.slice(0, 6).map((l, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span>
                      {l.facility}
                      {l.city ? `, ${l.city}` : ""}
                      {l.state ? `, ${l.state}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <div>
            {trial.sponsor ? <span>Sponsor: {trial.sponsor}</span> : null}
            {trial.nctId && trial.ctgovLastUpdated ? (
              <span>
                {trial.sponsor ? " · " : ""}Source: ClinicalTrials.gov · last updated{" "}
                {format(new Date(trial.ctgovLastUpdated), "MMM d, yyyy")}
              </span>
            ) : null}
          </div>
          {trial.nctId ? (
            <Button asChild variant="outline" size="sm">
              <a
                href={`https://clinicaltrials.gov/study/${trial.nctId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1"
              >
                View on ClinicalTrials.gov <ExternalLink className="size-3.5" aria-hidden />
              </a>
            </Button>
          ) : null}
        </div>

        <Card className="mt-6">
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Sign in to see if you qualify, criterion by criterion.
            </p>
            <Button asChild className="mt-3">
              <Link href="/login">Sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
