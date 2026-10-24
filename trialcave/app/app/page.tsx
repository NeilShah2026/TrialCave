import Link from "next/link";
import { ArrowRight, FileText, Heart, Inbox } from "lucide-react";

import { PatientNav } from "@/components/patient-nav";
import { PageBody, PageHero } from "@/components/page-hero";
import { ChangesBanner } from "@/components/changes-banner";
import { MatchCard } from "@/components/match-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getMyPatient, getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  loadMatches,
  topMatches,
  loadMissingInfo,
  loadUnseenChanges,
  loadDonorSummary,
  loadProfile,
  formatCents,
} from "@/lib/patient";
import { MissingInfoList } from "./missing-info-list";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

export default async function PatientDashboard() {
  const user = await getSessionUser();
  const patient = await getMyPatient();
  const admin = createAdminClient();

  const [matches, changes, profile, reviewRes, inboxRes] = await Promise.all([
    loadMatches(patient.id),
    loadUnseenChanges(patient.id),
    loadProfile(patient.id),
    admin
      .from("source_documents")
      .select("id", { count: "exact", head: true })
      .eq("patient_id", patient.id)
      .eq("status", "needs_review"),
    admin
      .from("invitations")
      .select("id", { count: "exact", head: true })
      .eq("patient_id", patient.id)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString()),
  ]);
  const missing = await loadMissingInfo(matches);
  const donor = profile?.isDonor ? await loadDonorSummary(patient.id) : null;

  const toReview = reviewRes.count ?? 0;
  const pendingInvites = inboxRes.count ?? 0;
  const firstName = patient.displayName.split(" ")[0];
  const top = topMatches(matches, 3);
  const needsInfoCount = matches.filter((m) => m.status === "needs_info").length;

  return (
    <main className="flex-1">
      <PatientNav email={user?.email ?? ""} />
      <PageHero
        title={`Hi ${firstName}`}
        lede={`${matches.length} recruiting trials checked against your profile.`}
        actions={
          <Button asChild variant="mint" size="lg">
            <Link href="/app/matches">All matches</Link>
          </Button>
        }
      />
      <PageBody width="wide">
        <div className="space-y-6">
          {changes.length > 0 ? <ChangesBanner changes={changes} /> : null}

          <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
            <section aria-labelledby="top-matches-heading">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="top-matches-heading" className="text-[1.45rem] font-extrabold tracking-tight">Top matches</h2>
                <Button asChild variant="link" className="px-0">
                  <Link href="/app/matches">All matches <ArrowRight aria-hidden /></Link>
                </Button>
              </div>
              <div className="mt-4 space-y-4">
                {top.length === 0 ? (
                  <Card>
                    <CardContent className="pt-6 text-[1.05rem] text-tc-ink-2 sm:pt-7">
                      <p className="font-semibold text-tc-ink">No strong or possible matches yet.</p>
                      {needsInfoCount > 0 ? (
                        <p className="mt-2">
                          {needsInfoCount} trial{needsInfoCount === 1 ? "" : "s"} need a bit more information. Answer the
                          questions here or add a record.
                        </p>
                      ) : null}
                      <Button asChild className="mt-4"><Link href="/app/records">Add a record</Link></Button>
                    </CardContent>
                  </Card>
                ) : (
                  top.map((m) => <MatchCard key={m.trialId} match={m} />)
                )}
              </div>
            </section>

            <div className="space-y-6">
              <Card>
                <CardContent className="pt-6 sm:pt-7">
                  <h2 className="text-[1.45rem] font-extrabold tracking-tight">Answer these to check more trials</h2>
                  <div className="mt-4">
                    <MissingInfoList items={missing} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6 sm:pt-7">
                  <div className="flex items-start gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-tc-primary-soft text-tc-primary-ink">
                      <Inbox className="size-5" aria-hidden />
                    </span>
                    <div>
                      <h2 className="text-[1.15rem] font-bold">Inbox</h2>
                      <p className="text-[1rem] text-tc-ink-2">
                        {pendingInvites > 0
                          ? `${pendingInvites} new invitation${pendingInvites === 1 ? "" : "s"} from research clinics`
                          : "No new invitations"}
                      </p>
                    </div>
                  </div>
                  <Button asChild variant={pendingInvites > 0 ? "default" : "outline"}><Link href="/app/inbox">Open inbox</Link></Button>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6 sm:pt-7">
                  <div className="flex items-start gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-tc-secondary-soft text-tc-secondary">
                      <FileText className="size-5" aria-hidden />
                    </span>
                    <div>
                      <h2 className="text-[1.15rem] font-bold">Records</h2>
                      <p className="text-[1rem] text-tc-ink-2">
                        {toReview > 0
                          ? `${toReview} record${toReview === 1 ? "" : "s"} to review`
                          : "Add photos or files of your paperwork"}
                      </p>
                    </div>
                  </div>
                  <Button asChild variant={toReview > 0 ? "default" : "outline"}>
                    <Link href="/app/records">{toReview > 0 ? "Review" : "Records"}</Link>
                  </Button>
                </CardContent>
              </Card>

              <div className="on-dark rounded-[26px] bg-tc-night p-7 text-white">
                <div className="flex items-start gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-tc-night-2 text-tc-mint">
                    <Heart className="size-5" aria-hidden />
                  </span>
                  <div>
                    <h2 className="text-[1.15rem] font-bold">Data Donor</h2>
                    {donor ? (
                      <p className="text-[1rem] text-tc-night-text">
                        {formatCents(donor.totalCents)} · supported {donor.studyCount} stud{donor.studyCount === 1 ? "y" : "ies"}
                      </p>
                    ) : (
                      <p className="text-[1rem] text-tc-night-text">Donate data, collect a paycheck. Always optional.</p>
                    )}
                  </div>
                </div>
                <Button asChild variant="mint" className="mt-5"><Link href="/app/donor">{donor ? "Donor dashboard" : "Learn more"}</Link></Button>
              </div>
            </div>
          </div>

          <p className="text-[1rem]">
            <Link href="/app/changes" className="font-bold text-tc-primary-ink hover:underline">See everything that changed in your matches</Link>
          </p>
        </div>
      </PageBody>
    </main>
  );
}
