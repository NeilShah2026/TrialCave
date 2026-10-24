import Link from "next/link";

import { ClinicNav } from "@/components/clinic-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getMyClinic, getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { expireStaleInvitations } from "@/lib/outreach/invite";

export const dynamic = "force-dynamic";

export default async function ClinicHome() {
  const user = await getSessionUser();
  const clinic = await getMyClinic();
  const admin = createAdminClient();

  await expireStaleInvitations("clinic_id", clinic.id);

  const { data: studies } = await admin
    .from("trials")
    .select("id, title, study_status, condition_category")
    .eq("clinic_id", clinic.id)
    .order("created_at", { ascending: false });

  // Counts per study.
  const counts = new Map<string, { invited: number; approved: number; applications: number }>();
  for (const s of studies ?? []) {
    const [{ count: invited }, { count: approved }, { count: applications }] = await Promise.all([
      admin.from("invitations").select("id", { count: "exact", head: true }).eq("trial_id", s.id),
      admin.from("invitations").select("id", { count: "exact", head: true }).eq("trial_id", s.id).eq("status", "approved"),
      admin.from("applications").select("id", { count: "exact", head: true }).eq("trial_id", s.id),
    ]);
    counts.set(s.id, { invited: invited ?? 0, approved: approved ?? 0, applications: applications ?? 0 });
  }

  return (
    <main className="flex-1">
      <ClinicNav email={user?.email ?? ""} clinicName={clinic.name} />
      <div className="mx-auto max-w-[1100px] px-4 py-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Your studies</h1>
          <Button asChild><Link href="/clinic/studies/new">New study</Link></Button>
        </div>

        {!clinic.verified ? (
          <p className="mt-3 rounded-md bg-tc-secondary-soft px-3 py-2 text-sm">
            Your clinic is pending verification. You can create studies, but invitations are
            disabled until TrialCave verifies your clinic.
          </p>
        ) : null}

        {!studies || studies.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">
            No studies yet. Create one to start finding participants.
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {studies.map((s) => {
              const c = counts.get(s.id)!;
              return (
                <Link key={s.id} href={`/clinic/studies/${s.id}`} className="block">
                  <Card className="transition-colors hover:border-primary">
                    <CardContent className="flex items-center justify-between py-4">
                      <div>
                        <p className="font-medium">{s.title}</p>
                        <p className="text-xs text-muted-foreground">
                          Invited {c.invited} · Approved {c.approved} · Applications {c.applications}
                        </p>
                      </div>
                      <Badge variant={s.study_status === "active" ? "success" : "muted"}>{s.study_status}</Badge>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
