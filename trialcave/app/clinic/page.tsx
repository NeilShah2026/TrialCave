import Link from "next/link";

import { ClinicNav } from "@/components/clinic-nav";
import { PageBody, PageHero } from "@/components/page-hero";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getMyClinic, getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { expireStaleInvitations } from "@/lib/outreach/invite";
import { STUDY_STATUS_LABEL } from "@/lib/clinic-labels";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your studies" };

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
      <PageHero
        tone="indigo"
        kicker={clinic.name}
        title="Your studies"
        actions={<Button asChild variant="secondary" size="lg"><Link href="/clinic/studies/new">New study</Link></Button>}
      />
      <PageBody width="wide">
        {!clinic.verified ? (
          <p className="mb-6 rounded-2xl bg-tc-warning-soft px-5 py-4 font-semibold text-tc-warning-ink">
            Your clinic is pending verification. You can create studies, but invitations are
            disabled until TrialCave verifies your clinic.
          </p>
        ) : null}

        {!studies || studies.length === 0 ? (
          <Card className="p-10 text-center text-[1.1rem] text-tc-ink-2">
            No studies yet. Create one to start finding participants.
          </Card>
        ) : (
          <div className="grid gap-4">
            {studies.map((s) => {
              const c = counts.get(s.id)!;
              return (
                <Link
                  key={s.id}
                  href={`/clinic/studies/${s.id}`}
                  className="block rounded-[24px] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-tc-secondary-soft"
                >
                  <Card className="transition-colors hover:border-tc-secondary">
                    <CardContent className="flex flex-wrap items-center justify-between gap-5 p-6 sm:p-7">
                      <div className="min-w-0">
                        <p className="text-[1.15rem] font-bold text-tc-ink">{s.title}</p>
                        <dl className="mt-3 flex flex-wrap gap-3">
                          {[
                            ["Invited", c.invited],
                            ["Approved", c.approved],
                            ["Applications", c.applications],
                          ].map(([label, n]) => (
                            <div key={label} className="flex flex-col-reverse rounded-2xl bg-tc-mist px-4 py-2">
                              <dt className="text-[0.9rem] font-bold text-tc-muted">{label}</dt>
                              <dd className="text-[1.4rem] font-extrabold leading-tight text-tc-secondary">{n}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                      <Badge variant={s.study_status === "active" ? "success" : "muted"}>{STUDY_STATUS_LABEL[s.study_status] ?? s.study_status}</Badge>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </PageBody>
    </main>
  );
}
