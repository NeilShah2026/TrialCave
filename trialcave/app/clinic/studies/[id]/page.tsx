import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";

import { ClinicNav } from "@/components/clinic-nav";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getMyClinic, getSessionUser, assertClinicOwnsTrial } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOutreachCount } from "@/lib/outreach/eligible";
import { getEquitySummary } from "@/lib/outreach/equity";
import { EquitySummaryView } from "@/components/equity-summary";
import { APPLICATION_STATUS_LABEL, INVITATION_STATUS_LABEL, STUDY_STATUS_LABEL } from "@/lib/clinic-labels";
import { categoryLabel } from "@/lib/categories";
import { FindParticipants } from "./find-participants";
import { StudyStatusButton } from "./study-status-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Study" };

const TABS = new Set(["find", "equity", "overview", "invitations", "contacts", "applications"]);
const INV_STATUSES = ["pending", "approved", "declined", "expired", "withdrawn"] as const;

export default async function StudyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const user = await getSessionUser();
  const clinic = await getMyClinic();
  try {
    await assertClinicOwnsTrial(clinic.id, id);
  } catch {
    notFound();
  }
  const admin = createAdminClient();

  const { data: trial } = await admin
    .from("trials")
    .select("title, plain_summary, what_is_involved, irb_protocol_number, invite_message, study_status, condition_category, min_age_years, max_age_years, sex")
    .eq("id", id)
    .maybeSingle();
  if (!trial) notFound();

  const [{ data: criteria }, count, equity, invRows, { data: applications }] = await Promise.all([
    admin.from("trial_criteria").select("kind, plain_text, field, machine_checkable, patient_question").eq("trial_id", id).order("sort_order"),
    getOutreachCount(id),
    getEquitySummary(id),
    admin.from("invitations").select("id, status, shared_fields, responded_at").eq("trial_id", id),
    admin.from("applications").select("id, shared_fields, status, created_at").eq("trial_id", id).order("created_at", { ascending: false }),
  ]);

  const invitations = invRows.data ?? [];
  const invCounts = Object.fromEntries(INV_STATUSES.map((s) => [s, invitations.filter((i) => i.status === s).length])) as Record<string, number>;
  const approved = invitations.filter((i) => i.status === "approved");
  const activeApps = (applications ?? []).filter((a) => a.status !== "withdrawn");
  const withdrawnApps = (applications ?? []).length - activeApps.length;
  const active = trial.study_status === "active";

  return (
    <main className="flex-1">
      <ClinicNav email={user?.email ?? ""} clinicName={clinic.name} />
      <div className="mx-auto max-w-[900px] px-4 py-8">
        <Link href="/clinic" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft className="size-4" aria-hidden /> Studies
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{trial.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {categoryLabel(trial.condition_category)}
              {trial.irb_protocol_number ? ` · IRB ${trial.irb_protocol_number}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={active ? "success" : "muted"}>{STUDY_STATUS_LABEL[trial.study_status] ?? trial.study_status}</Badge>
            <StudyStatusButton trialId={id} status={trial.study_status} />
          </div>
        </div>

        <Tabs defaultValue={tab && TABS.has(tab) ? tab : "find"} className="mt-6">
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="find">Find participants</TabsTrigger>
            <TabsTrigger value="equity">Equitable reach</TabsTrigger>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="invitations">Invitations</TabsTrigger>
            <TabsTrigger value="contacts">Approved contacts ({approved.length})</TabsTrigger>
            <TabsTrigger value="applications">Applications ({activeApps.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="find">
            <FindParticipants
              trialId={id}
              verified={clinic.verified}
              active={active}
              inviteMessage={trial.invite_message ?? ""}
              irbNumber={trial.irb_protocol_number}
              count={count}
            />
          </TabsContent>

          <TabsContent value="equity">
            <EquitySummaryView summary={equity} />
          </TabsContent>

          <TabsContent value="overview">
            <Card>
              <CardContent className="pt-6">
                {trial.plain_summary ? <p className="text-sm">{trial.plain_summary}</p> : <p className="text-sm text-muted-foreground">No summary yet.</p>}
                {trial.what_is_involved ? <p className="mt-2 text-sm text-muted-foreground">{trial.what_is_involved}</p> : null}
                <p className="mt-2 text-xs text-muted-foreground">
                  Ages {trial.min_age_years ?? "any"}–{trial.max_age_years ?? "any"} · {trial.sex === "ALL" || !trial.sex ? "All sexes" : trial.sex.toLowerCase()}
                </p>
                <h2 className="mt-4 text-sm font-semibold">Checklist</h2>
                {(criteria ?? []).length === 0 ? (
                  <p className="mt-1 text-sm text-muted-foreground">No criteria saved.</p>
                ) : (
                  <ul className="mt-2 space-y-2 text-sm">
                    {(criteria ?? []).map((c, i) => (
                      <li key={i} className="flex gap-2">
                        <Badge variant={c.kind === "inclusion" ? "success" : "danger"} className="h-fit shrink-0">
                          {c.kind === "inclusion" ? "Needed" : "Rules out"}
                        </Badge>
                        <span>
                          {c.plain_text}
                          {c.machine_checkable ? <span className="ml-2 text-xs text-muted-foreground">(checked automatically)</span> : c.patient_question ? <span className="ml-2 text-xs text-muted-foreground">(asked as a question)</span> : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {trial.invite_message ? (
                  <>
                    <h2 className="mt-4 text-sm font-semibold">Invitation text</h2>
                    <p className="mt-1 text-sm italic text-muted-foreground">&ldquo;{trial.invite_message}&rdquo;</p>
                  </>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invitations">
            <Card>
              <CardContent className="pt-6">
                <h2 className="sr-only">Invitation counts</h2>
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  <div className="flex justify-between rounded-md border border-border px-3 py-2">
                    <dt>Sent</dt>
                    <dd className="font-medium">{invitations.length}</dd>
                  </div>
                  {INV_STATUSES.map((s) => (
                    <div key={s} className="flex justify-between rounded-md border border-border px-3 py-2">
                      <dt>{INVITATION_STATUS_LABEL[s]}</dt>
                      <dd className="font-medium">{invCounts[s]}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 text-xs text-muted-foreground">Counts only. Declines are never identified.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contacts">
            <Card>
              <CardContent className="pt-6">
                {approved.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No approved contacts yet. When someone approves your invitation, they&apos;ll appear here.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {approved.map((a) => (
                      <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                        <span>
                          Participant #C-{a.id.slice(0, 6)}
                          <span className="ml-2 text-xs text-muted-foreground">
                            {a.responded_at ? `Approved ${format(new Date(a.responded_at), "MMM d")}` : ""} · shared {a.shared_fields?.length ?? 0} fields
                          </span>
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
                {activeApps.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No applications yet. Patients who match can apply from their TrialCave account.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {activeApps.map((a) => (
                      <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                        <span>
                          Participant #A-{a.id.slice(0, 6)}
                          <Badge variant="secondary" className="ml-2">{APPLICATION_STATUS_LABEL[a.status] ?? a.status}</Badge>
                          <span className="ml-2 text-xs text-muted-foreground">{format(new Date(a.created_at), "MMM d")}</span>
                        </span>
                        <Link href={`/clinic/applications/${a.id}`} className="text-primary hover:underline">Review</Link>
                      </li>
                    ))}
                  </ul>
                )}
                {withdrawnApps > 0 ? (
                  <p className="mt-3 text-xs text-muted-foreground">{withdrawnApps} application{withdrawnApps === 1 ? " was" : "s were"} withdrawn by the participant.</p>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
