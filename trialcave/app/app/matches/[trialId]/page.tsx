import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PatientNav } from "@/components/patient-nav";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getMyPatient, getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadMatches, loadProfile } from "@/lib/patient";
import { STATUS_LABEL, STATUS_VARIANT, scorePct } from "@/lib/match-status";
import { translateText } from "@/lib/ai/translate";
import { LanguageSwitcher } from "@/components/language-switcher";
import { TranslatedText } from "@/components/translated-text";
import { GettingThere } from "@/components/getting-there";
import { sortMassachusettsFirst, type TrialLocation } from "@/lib/ctgov/normalize";
import type { Language } from "@/lib/i18n/languages";
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
    .select("title, source, is_demo, plain_summary, what_is_involved, nct_id, logistics, locations")
    .eq("id", trialId)
    .maybeSingle();
  if (!trial) notFound();

  const profile = await loadProfile(patient.id);
  const lang = (profile?.preferredLanguage ?? "en") as Language;

  const { data: patientRow } = await admin
    .from("patients")
    .select("town, travel_radius_miles")
    .eq("id", patient.id)
    .maybeSingle();

  // Translate the summary into the patient's language (cached).
  const summaryText = trial.plain_summary ?? "";
  const summaryTr = summaryText ? await translateText(summaryText, lang) : { text: "", machine: false };

  // Nearest MA site for getting-there.
  const locations = sortMassachusettsFirst((trial.locations ?? []) as TrialLocation[]);
  const nearestSite = locations[0] ?? null;
  const trialLogistics = (trial.logistics ?? {}) as { visit_count?: number; duration_weeks?: number; remote_option?: boolean; compensation_mentioned?: boolean };

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
        <div className="mt-3">
          <LanguageSwitcher current={lang} />
        </div>

        {match ? (
          <div className="mt-3 flex items-center gap-3">
            <Progress value={scorePct(match.score)} className="max-w-[200px]" />
            <span className="text-sm text-muted-foreground">{scorePct(match.score)}%</span>
          </div>
        ) : null}

        {summaryText ? (
          <Card className="mt-4">
            <CardContent className="pt-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">In plain words</h2>
              <p className="mt-2 text-sm">
                <TranslatedText original={summaryText} translated={summaryTr.text} machine={summaryTr.machine} />
              </p>
              {trial.what_is_involved ? <p className="mt-2 text-sm text-muted-foreground">{trial.what_is_involved}</p> : null}
            </CardContent>
          </Card>
        ) : null}

        {nearestSite?.facility ? (
          <div className="mt-4">
            <GettingThere
              patientTown={patientRow?.town ?? ""}
              travelRadiusMiles={patientRow?.travel_radius_miles ?? 25}
              facility={nearestSite.facility}
              city={nearestSite.city}
              distanceMiles={match?.distanceMiles ?? null}
              visitCount={trialLogistics.visit_count ?? null}
              durationWeeks={trialLogistics.duration_weeks ?? null}
              remoteOption={trialLogistics.remote_option ?? null}
              compensationMentioned={trialLogistics.compensation_mentioned ?? null}
            />
          </div>
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
