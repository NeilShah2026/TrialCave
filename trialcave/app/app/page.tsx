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

export default async function PatientDashboard() {
  const user = await getSessionUser();
  const patient = await getMyPatient();
  const admin = createAdminClient();

  const [matches, changes, profile] = await Promise.all([
    loadMatches(patient.id),
    loadUnseenChanges(patient.id),
    loadProfile(patient.id),
  ]);
  const missing = await loadMissingInfo(matches);
  const donor = profile?.isDonor ? await loadDonorSummary(patient.id) : null;

  const { count: toReview } = await admin
    .from("source_documents")
    .select("id", { count: "exact", head: true })
    .eq("patient_id", patient.id)
    .eq("status", "needs_review");

  const firstName = patient.displayName.split(" ")[0];
  const top = topMatches(matches, 3);

  return (
    <main className="flex-1">
      <PatientNav email={user?.email ?? ""} />
      <div className="mx-auto max-w-[1100px] px-4 py-8">
        <h1 className="text-2xl font-semibold">Hi {firstName}</h1>

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
                    <p className="text-sm text-muted-foreground">
                      No matches yet. Add a record to get matched.
                    </p>
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
                <CardContent className="flex items-center justify-between pt-6">
                  <div>
                    <h2 className="text-lg font-semibold">Records</h2>
                    <p className="text-sm text-muted-foreground">
                      {toReview && toReview > 0 ? `${toReview} record to review` : "Add photos or files of your paperwork"}
                    </p>
                  </div>
                  <Button asChild variant="outline"><Link href="/app/records">Records</Link></Button>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="flex items-center justify-between pt-6">
                  <div>
                    <h2 className="text-lg font-semibold">Data Donor</h2>
                    {donor ? (
                      <p className="text-sm text-muted-foreground">
                        {formatCents(donor.totalCents)} · {donor.studyCount} studies
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Donate data, collect a paycheck.</p>
                    )}
                  </div>
                  <Button asChild variant="outline"><Link href="/app/donor">{donor ? "Dashboard" : "Learn more"}</Link></Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
