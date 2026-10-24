import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { ClinicNav } from "@/components/clinic-nav";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getMyClinic, getSessionUser, assertClinicOwnsTrial } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOutreachCount } from "@/lib/outreach/eligible";
import { FindParticipants } from "./find-participants";

export const dynamic = "force-dynamic";

export default async function StudyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  const clinic = await getMyClinic();
  await assertClinicOwnsTrial(clinic.id, id);
  const admin = createAdminClient();

  const { data: trial } = await admin
    .from("trials")
    .select("title, plain_summary, irb_protocol_number, invite_message, study_status")
    .eq("id", id)
    .maybeSingle();
  if (!trial) notFound();

  const { data: criteria } = await admin
    .from("trial_criteria")
    .select("kind, plain_text, field, machine_checkable")
    .eq("trial_id", id)
    .order("sort_order");

  const count = await getOutreachCount(id);

  // Invitation status counts.
  const statuses = ["pending", "approved", "declined", "expired", "withdrawn"] as const;
  const invCounts: Record<string, number> = {};
  for (const s of statuses) {
    const { count: c } = await admin.from("invitations").select("id", { count: "exact", head: true }).eq("trial_id", id).eq("status", s);
    invCounts[s] = c ?? 0;
  }

  // Approved contacts + applications.
  const { data: approved } = await admin
    .from("invitations")
    .select("id, shared_fields, match_score, responded_at")
    .eq("trial_id", id)
    .eq("status", "approved");
  const { data: applications } = await admin
    .from("applications")
    .select("id, shared_fields, status, created_at")
    .eq("trial_id", id);

  return (
    <main className="flex-1">
      <ClinicNav email={user?.email ?? ""} clinicName={clinic.name} />
      <div className="mx-auto max-w-[800px] px-4 py-8">
        <Link href="/clinic" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft className="size-4" aria-hidden /> Studies
        </Link>
        <h1 className="mt-3 text-2xl font-semibold">{trial.title}</h1>

        <Tabs defaultValue="find" className="mt-6">
          <TabsList>
            <TabsTrigger value="find">Find participants</TabsTrigger>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="invitations">Invitations</TabsTrigger>
            <TabsTrigger value="contacts">Approved contacts</TabsTrigger>
            <TabsTrigger value="applications">Applications</TabsTrigger>
          </TabsList>

          <TabsContent value="find">
            <FindParticipants
              trialId={id}
              verified={clinic.verified}
              inviteMessage={trial.invite_message ?? ""}
              irbNumber={trial.irb_protocol_number}
              count={count}
            />
          </TabsContent>

          <TabsContent value="overview">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm">{trial.plain_summary}</p>
                {trial.irb_protocol_number ? <p className="mt-2 text-xs text-muted-foreground">IRB {trial.irb_protocol_number}</p> : null}
                <h3 className="mt-4 text-sm font-semibold">Checklist</h3>
                <ul className="mt-2 space-y-1 text-sm">
                  {(criteria ?? []).map((c, i) => (
                    <li key={i}>
                      <Badge variant={c.kind === "inclusion" ? "success" : "danger"} className="mr-2">{c.kind}</Badge>
                      {c.plain_text}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invitations">
            <Card>
              <CardContent className="pt-6">
                <ul className="space-y-1 text-sm">
                  {statuses.map((s) => (
                    <li key={s} className="flex justify-between">
                      <span className="capitalize">{s}</span>
                      <span className="font-medium">{invCounts[s]}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-muted-foreground">Counts only — declines are never identified.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contacts">
            <Card>
              <CardContent className="pt-6">
                {!approved || approved.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No approved contacts yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {approved.map((a) => (
                      <li key={a.id} className="flex items-center justify-between text-sm">
                        <span>
                          {a.shared_fields?.includes("first_name") ? "Shared name" : `Participant #${a.id.slice(0, 6)}`}
                        </span>
                        <Link href={`/clinic/contacts/${a.id}`} className="text-primary hover:underline">View report</Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="applications">
            <Card>
              <CardContent className="pt-6">
                {!applications || applications.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No applications yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {applications.map((a) => (
                      <li key={a.id} className="flex items-center justify-between text-sm">
                        <span>Participant #{a.id.slice(0, 6)} · {a.status}</span>
                        <Link href={`/clinic/applications/${a.id}`} className="text-primary hover:underline">Review</Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
