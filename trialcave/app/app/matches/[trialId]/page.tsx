import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Mail, Phone } from "lucide-react";

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
import { haversineMiles } from "@/lib/geo/distance";
import { MAX_QUESTIONS_PER_TRIAL } from "@/lib/env";
import type { Language } from "@/lib/i18n/languages";
import { MatchDetailClient, type ApplicationState, type DetailCriterion } from "./match-detail-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Match detail" };

interface TrialContact {
  name?: string | null;
  role?: string | null;
  phone?: string | null;
  email?: string | null;
}

export default async function MatchDetailPage({ params }: { params: Promise<{ trialId: string }> }) {
  const { trialId } = await params;
  const user = await getSessionUser();
  const patient = await getMyPatient();
  const admin = createAdminClient();

  const { data: trial } = await admin
    .from("trials")
    .select("title, source, is_demo, plain_summary, what_is_involved, nct_id, logistics, locations, contacts, sponsor, phases, clinics(name)")
    .eq("id", trialId)
    .maybeSingle();
  if (!trial) notFound();

  const [matches, profile, patientRes, appRes] = await Promise.all([
    loadMatches(patient.id),
    loadProfile(patient.id),
    admin.from("patients").select("town, travel_radius_miles, lat, lon").eq("id", patient.id).maybeSingle(),
    admin.from("applications").select("status, shared_fields").eq("patient_id", patient.id).eq("trial_id", trialId).maybeSingle(),
  ]);
  const match = matches.find((m) => m.trialId === trialId);
  const patientRow = patientRes.data;
  const lang = (profile?.preferredLanguage ?? "en") as Language;

  // Translate the summary into the patient's language (cached). Never let a
  // translation failure break the page.
  const summaryText = trial.plain_summary ?? "";
  let summaryTr = { text: summaryText, machine: false };
  if (summaryText && lang !== "en") {
    try {
      summaryTr = await translateText(summaryText, lang);
    } catch {
      summaryTr = { text: summaryText, machine: false };
    }
  }

  // Nearest site to the patient (MA sites first when distances tie).
  const locations = sortMassachusettsFirst((trial.locations ?? []) as TrialLocation[]);
  let nearestSite: TrialLocation | null = locations[0] ?? null;
  let nearestMiles: number | null = match?.distanceMiles ?? null;
  if (patientRow?.lat != null && patientRow?.lon != null) {
    let best = Infinity;
    for (const loc of locations) {
      if (loc.lat == null || loc.lon == null) continue;
      const d = haversineMiles(patientRow.lat, patientRow.lon, loc.lat, loc.lon);
      if (d < best) {
        best = d;
        nearestSite = loc;
      }
    }
    if (Number.isFinite(best)) nearestMiles = Math.round(best * 10) / 10;
  }
  const trialLogistics = (trial.logistics ?? {}) as { visit_count?: number; duration_weeks?: number; remote_option?: boolean; compensation_mentioned?: boolean };

  const details: DetailCriterion[] = (match?.details ?? []).map((d) => ({
    ...d,
    evidenceLabel: d.evidence?.documentLabel ?? (d.evidence?.source === "lab" ? "lab" : d.evidence?.source === "self_report" ? "your answer" : null),
  }));

  const inclusion = details.filter((d) => d.kind === "inclusion" && d.status !== "na");
  const exclusion = details.filter((d) => d.kind === "exclusion" && d.status !== "na");
  const logistics = details.filter((d) => d.status === "na");

  const clinicName = (trial.clinics as unknown as { name: string } | null)?.name ?? "The study team";
  const application: ApplicationState | null = appRes.data
    ? { status: appRes.data.status, sharedFields: appRes.data.shared_fields ?? [] }
    : null;
  const contacts = ((trial.contacts ?? []) as TrialContact[]).filter((c) => c.email || c.phone).slice(0, 3);
  const sourceLabel = trial.is_demo ? "Demo study (fictional)" : trial.source === "clinic" ? `TrialCave clinic study · ${clinicName}` : "ClinicalTrials.gov";

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
          {sourceLabel}
          {trial.phases?.length ? ` · ${trial.phases.join(", ").replace(/PHASE/g, "Phase ")}` : ""}
          {nearestMiles != null ? ` · ${nearestMiles} mi` : ""}
        </p>
        <div className="mt-3">
          <LanguageSwitcher current={lang} />
        </div>

        {match ? (
          <div className="mt-3 flex items-center gap-3">
            <Progress value={scorePct(match.score)} className="max-w-[200px]" aria-label={`Match score ${scorePct(match.score)}%`} />
            <span className="text-sm text-muted-foreground">
              {scorePct(match.score)}% · {match.passCount} met{match.unknownCount ? ` · ${match.unknownCount} unknown` : ""}
            </span>
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
              distanceMiles={nearestMiles}
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
              This trial isn&apos;t in your current matches. It may be outside your age, sex, or
              travel range. You can widen your travel distance in{" "}
              <Link href="/app/settings" className="text-primary hover:underline">Settings</Link>.
            </CardContent>
          </Card>
        ) : (
          <MatchDetailClient
            trialId={trialId}
            isClinicStudy={trial.source === "clinic"}
            clinicName={clinicName}
            application={application}
            inclusion={inclusion}
            exclusion={exclusion}
            logistics={logistics}
            maxQuestions={MAX_QUESTIONS_PER_TRIAL}
          />
        )}

        {trial.source === "ctgov" ? (
          <Card className="mt-6">
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold">Contact the study team</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                This study is listed on ClinicalTrials.gov. Reach out to the team directly, and bring
                your pre-screen summary.
              </p>
              {contacts.length > 0 ? (
                <ul className="mt-3 space-y-2 text-sm">
                  {contacts.map((c, i) => (
                    <li key={i}>
                      <p className="font-medium">{c.name ?? "Study contact"}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                        {c.phone ? (
                          <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1 hover:text-primary">
                            <Phone className="size-3" aria-hidden /> {c.phone}
                          </a>
                        ) : null}
                        {c.email ? (
                          <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 hover:text-primary">
                            <Mail className="size-3" aria-hidden /> {c.email}
                          </a>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
              {trial.nct_id ? (
                <a
                  className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  href={`https://clinicaltrials.gov/study/${trial.nct_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View {trial.nct_id} on ClinicalTrials.gov <ExternalLink className="size-3" aria-hidden />
                </a>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </main>
  );
}
