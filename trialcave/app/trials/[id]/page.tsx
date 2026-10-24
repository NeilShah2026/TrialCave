import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ExternalLink, MapPin } from "lucide-react";

import { PageBody, PageHero } from "@/components/page-hero";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CriteriaList } from "@/components/criteria-list";
import { categoryLabel } from "@/lib/categories";
import { getTrialDetail } from "@/lib/trials";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Trial details" };

const DARK_BADGE =
  "inline-flex items-center rounded-full bg-tc-night-2 px-3.5 py-1.5 text-[0.95rem] font-bold text-tc-mint";

export default async function TrialDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [detail, user] = await Promise.all([getTrialDetail(id), getSessionUser().catch(() => null)]);
  if (!detail) notFound();

  const { trial, criteria } = detail;
  const summary = trial.plainSummary ?? trial.briefSummary ?? "";
  const parseFailed = trial.parseStatus === "failed" || criteria.length === 0;

  const heroCta =
    user?.role === "patient" ? (
      <Button asChild variant="mint" size="lg">
        <Link href={`/app/matches/${id}`}>Check my eligibility</Link>
      </Button>
    ) : !user ? (
      <Button asChild variant="mint" size="lg">
        <Link href={`/login?next=/app/matches/${id}`}>Sign in</Link>
      </Button>
    ) : null;

  return (
    <main className="flex-1">
      <SiteHeader />
      <PageHero
        tone="night"
        back={{ href: "/trials", label: "All studies" }}
        kicker={categoryLabel(trial.conditionCategory)}
        title={trial.title}
        lede={trial.nctId ? <span className="text-[1rem]">{trial.nctId}</span> : undefined}
        actions={heroCta}
      >
        <ul className="flex flex-wrap items-center gap-2" aria-label="Study details">
          {trial.phases.map((p) => (
            <li key={p} className={DARK_BADGE}>
              {p.replace("PHASE", "Phase ")}
            </li>
          ))}
          <li className={DARK_BADGE}>
            {trial.isDemo ? "Demo study (fictional)" : "ClinicalTrials.gov"}
          </li>
        </ul>
      </PageHero>

      <PageBody width="wide" className="bg-tc-mist">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-6">
            {summary ? (
              <Card className="p-6 sm:p-8">
                <h2 className="text-[clamp(1.6rem,2.6vw,2.2rem)] font-extrabold tracking-[-0.02em]">
                  In plain words
                </h2>
                <p className="mt-3 text-[1.1rem] leading-relaxed text-tc-ink">{summary}</p>
                {trial.whatIsInvolved ? (
                  <p className="mt-4 text-[1.05rem] leading-relaxed text-tc-ink-2">{trial.whatIsInvolved}</p>
                ) : null}
              </Card>
            ) : null}

            <Card className="p-6 sm:p-8">
              {parseFailed ? (
                <div>
                  <p className="rounded-2xl bg-tc-warning-soft px-5 py-4 font-semibold text-tc-warning-ink">
                    Eligibility checklist unavailable. Read the full criteria below.
                  </p>
                  {trial.eligibilityText ? (
                    <pre className="mt-4 whitespace-pre-wrap rounded-2xl bg-tc-mist p-5 font-sans text-[1rem] leading-relaxed text-tc-ink-2">
                      {trial.eligibilityText}
                    </pre>
                  ) : null}
                </div>
              ) : (
                <CriteriaList criteria={criteria} />
              )}
            </Card>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.95rem] text-tc-muted">
              {trial.sponsor ? <span>Sponsor: {trial.sponsor}</span> : null}
              {trial.nctId && trial.ctgovLastUpdated ? (
                <span>
                  {trial.sponsor ? "· " : ""}Source: ClinicalTrials.gov · last updated{" "}
                  {format(new Date(trial.ctgovLastUpdated), "MMM d, yyyy")}
                </span>
              ) : null}
            </div>
          </div>

          <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            <Card className="p-6">
              {user?.role === "patient" ? (
                <>
                  <h2 className="text-[1.15rem] font-bold">Do I qualify?</h2>
                  <p className="mt-2 text-[1.05rem] text-tc-ink-2">
                    See how your own records compare with this trial, criterion by criterion.
                  </p>
                  <Button asChild size="lg" className="mt-4 w-full">
                    <Link href={`/app/matches/${id}`}>Check my eligibility</Link>
                  </Button>
                </>
              ) : user ? (
                <p className="text-[1.05rem] text-tc-ink-2">
                  Eligibility checks are available to patient accounts.
                </p>
              ) : (
                <>
                  <h2 className="text-[1.15rem] font-bold">Do I qualify?</h2>
                  <p className="mt-2 text-[1.05rem] text-tc-ink-2">
                    Sign in to see if you qualify, criterion by criterion. It&apos;s free.
                  </p>
                  <div className="mt-4 flex flex-col gap-3">
                    <Button asChild size="lg" className="w-full">
                      <Link href={`/login?next=/app/matches/${id}`}>Sign in</Link>
                    </Button>
                    <Button asChild size="lg" variant="outline" className="w-full">
                      <Link href="/signup">Create an account</Link>
                    </Button>
                  </div>
                </>
              )}
            </Card>

            {trial.locations.length > 0 ? (
              <Card className="p-6">
                <h2 className="text-[1.15rem] font-bold">Where</h2>
                <ul className="mt-4 space-y-3">
                  {trial.locations.slice(0, 6).map((l, i) => (
                    <li key={i} className="flex items-start gap-3 text-[1.05rem] text-tc-ink">
                      <MapPin className="mt-0.5 size-5 shrink-0 text-tc-primary" aria-hidden />
                      <span>
                        {l.facility}
                        {l.city ? `, ${l.city}` : ""}
                        {l.state ? `, ${l.state}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}

            {trial.nctId ? (
              <Button asChild variant="outline" className="w-full">
                <a
                  href={`https://clinicaltrials.gov/study/${trial.nctId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View on ClinicalTrials.gov <ExternalLink aria-hidden />
                </a>
              </Button>
            ) : null}
          </aside>
        </div>
      </PageBody>
    </main>
  );
}
