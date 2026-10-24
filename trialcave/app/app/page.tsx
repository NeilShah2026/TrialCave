import Link from "next/link";

import { PatientNav } from "@/components/patient-nav";
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
      <div className="mx-auto max-w-[1100px] px-4 py-8">
        <h1 className="text-2xl font-semibold">Hi {firstName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {matches.length} recruiting trials checked against your profile.
        </p>

        <div className="mt-4 space-y-4">
          {changes.length > 0 ? <ChangesBanner changes={changes} /> : null}

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Top matches</h2>
                  <Button asChild variant="ghost" size="sm"><Link href="/app/matches">All matches</Link></Button>
                </div>
                <div className="mt-3 space-y-3">
                  {top.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      <p>No strong or possible matches yet.</p>
                      {needsInfoCount > 0 ? (
                        <p className="mt-1">
                          {needsInfoCount} trial{needsInfoCount === 1 ? "" : "s"} need a bit more information. Answer the
                          questions here or add a record.
                        </p>
                      ) : null}
                      <Button asChild size="sm" className="mt-3"><Link href="/app/records">Add a record</Link></Button>
                    </div>
                  ) : (
                    top.map((m) => <MatchCard key={m.trialId} match={m} />)
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardContent className="pt-6">
                  <h2 className="text-lg font-semibold">Answer these to check more trials</h2>
                  <div className="mt-3">
                    <MissingInfoList items={missing} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="flex items-center justify-between gap-3 pt-6">
                  <div>
                    <h2 className="text-lg font-semibold">Inbox</h2>
                    <p className="text-sm text-muted-foreground">
                      {pendingInvites > 0
                        ? `${pendingInvites} new invitation${pendingInvites === 1 ? "" : "s"} from research clinics`
                        : "No new invitations"}
                    </p>
                  </div>
                  <Button asChild variant={pendingInvites > 0 ? "default" : "outline"}><Link href="/app/inbox">Open inbox</Link></Button>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="flex items-center justify-between gap-3 pt-6">
                  <div>
                    <h2 className="text-lg font-semibold">Records</h2>
                    <p className="text-sm text-muted-foreground">
                      {toReview > 0
                        ? `${toReview} record${toReview === 1 ? "" : "s"} to review`
                        : "Add photos or files of your paperwork"}
                    </p>
                  </div>
                  <Button asChild variant={toReview > 0 ? "default" : "outline"}>
                    <Link href="/app/records">{toReview > 0 ? "Review" : "Records"}</Link>
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="flex items-center justify-between gap-3 pt-6">
                  <div>
                    <h2 className="text-lg font-semibold">Data Donor</h2>
                    {donor ? (
                      <p className="text-sm text-muted-foreground">
                        {formatCents(donor.totalCents)} · supported {donor.studyCount} stud{donor.studyCount === 1 ? "y" : "ies"}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Donate data, collect a paycheck. Always optional.</p>
                    )}
                  </div>
                  <Button asChild variant="outline"><Link href="/app/donor">{donor ? "Donor dashboard" : "Learn more"}</Link></Button>
                </CardContent>
              </Card>
            </div>
          </div>

          <p className="text-sm">
            <Link href="/app/changes" className="text-primary hover:underline">See everything that changed in your matches</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
