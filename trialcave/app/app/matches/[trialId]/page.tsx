import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PatientNav } from "@/components/patient-nav";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getMyPatient, getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadMatches } from "@/lib/patient";
import { STATUS_LABEL, STATUS_VARIANT, scorePct } from "@/lib/match-status";
import { MatchDetailClient, type DetailCriterion } from "./match-detail-client";

export const dynamic = "force-dynamic";

export default async function MatchDetailPage({ params }: { params: Promise<{ trialId: string }> }) {
  const { trialId } = await params;
  const user = await getSessionUser();
  const patient = await getMyPatient();
  const admin = createAdminClient();

  const matches = await loadMatches(patient.id);
  const match = matches.find((m) => m.trialId === trialId);

  const { data: trial } = await admin
    .from("trials")
    .select("title, source, is_demo, plain_summary, what_is_involved, nct_id")
    .eq("id", trialId)
    .maybeSingle();
  if (!trial) notFound();

  const details: DetailCriterion[] = (match?.details ?? []).map((d) => ({
    ...d,
    evidenceLabel: d.evidence?.documentLabel ?? (d.evidence?.source === "lab" ? "lab" : d.evidence?.source === "self_report" ? "your answer" : null),
  }));

  const inclusion = details.filter((d) => d.kind === "inclusion" && d.status !== "na");
  const exclusion = details.filter((d) => d.kind === "exclusion" && d.status !== "na");
  const logistics = details.filter((d) => d.status === "na");

  return (
    <main className="flex-1">
      <PatientNav email={user?.email ?? ""} />
      <div className="mx-auto max-w-[800px] px-4 py-8">
        <Link href="/app/matches" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft className="size-4" aria-hidden /> Matches
        </Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold">{trial.title}</h1>
          {match ? <Badge variant={STATUS_VARIANT[match.status]}>{STATUS_LABEL[match.status]}</Badge> : null}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {trial.is_demo ? "Demo study (fictional)" : "ClinicalTrials.gov"}
          {match?.distanceMiles != null ? ` · ${match.distanceMiles} mi` : ""}
        </p>

        {match ? (
          <div className="mt-3 flex items-center gap-3">
            <Progress value={scorePct(match.score)} className="max-w-[200px]" />
            <span className="text-sm text-muted-foreground">{scorePct(match.score)}%</span>
          </div>
        ) : null}

        {trial.plain_summary ? (
          <Card className="mt-4">
            <CardContent className="pt-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">In plain words</h2>
              <p className="mt-2 text-sm">{trial.plain_summary}</p>
              {trial.what_is_involved ? <p className="mt-2 text-sm text-muted-foreground">{trial.what_is_involved}</p> : null}
            </CardContent>
          </Card>
        ) : null}

        {!match ? (
          <Card className="mt-4">
            <CardContent className="pt-6 text-sm text-muted-foreground">
              This trial isn&apos;t in your current matches (it may be outside your age, sex, or
              travel range).
            </CardContent>
          </Card>
        ) : (
          <MatchDetailClient
            trialId={trialId}
            isClinicStudy={trial.source === "clinic"}
            inclusion={inclusion}
            exclusion={exclusion}
            logistics={logistics}
          />
        )}

        {trial.source === "ctgov" && trial.nct_id ? (
          <Card className="mt-6">
            <CardContent className="pt-6 text-sm text-muted-foreground">
              This is a ClinicalTrials.gov study. Contact the study team directly —{" "}
              <a className="text-primary hover:underline" href={`https://clinicaltrials.gov/study/${trial.nct_id}`} target="_blank" rel="noopener noreferrer">
                view on ClinicalTrials.gov
              </a>.
            </CardContent>
          </Card>
        ) : null}
      </div>
    </main>
  );
}
