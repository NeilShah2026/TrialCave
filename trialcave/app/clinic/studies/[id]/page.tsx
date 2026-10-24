import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";

import { ClinicNav } from "@/components/clinic-nav";
import { PageBody, PageHero } from "@/components/page-hero";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

  const stats: [string, number][] = [
    ["Invitations sent", invitations.length],
    ["Approved contacts", approved.length],
    ["Applications", activeApps.length],
  ];

  return (
    <main className="flex-1">
      <ClinicNav email={user?.email ?? ""} clinicName={clinic.name} />
      <PageHero
        tone="indigo"
        back={{ href: "/clinic", label: "Studies" }}
        kicker={`${categoryLabel(trial.condition_category)}${trial.irb_protocol_number ? ` · IRB ${trial.irb_protocol_number}` : ""}`}
        title={trial.title}
        actions={
          <>
            <Badge variant={active ? "success" : "muted"} className="px-4 py-2 text-[0.95rem]">{STUDY_STATUS_LABEL[trial.study_status] ?? trial.study_status}</Badge>
            <StudyStatusButton trialId={id} status={trial.study_status} />
          </>
        }
      >
        <dl className="grid gap-4 sm:grid-cols-3">
          {stats.map(([label, n]) => (
            <div key={label} className="flex flex-col-reverse rounded-[24px] bg-white p-5 shadow-card">
              <dt className="mt-2 text-[1rem] font-bold text-tc-ink-2">{label}</dt>
              <dd className="text-[2.4rem] font-extrabold leading-none tracking-tight text-tc-secondary">{n}</dd>
            </div>
          ))}
        </dl>
      </PageHero>

      <PageBody width="wide">
        <Tabs defaultValue={tab && TABS.has(tab) ? tab : "find"}>
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="find">Find participants</TabsTrigger>
            <TabsTrigger value="equity">Equitable reach</TabsTrigger>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="invitations">Invitations</TabsTrigger>
            <TabsTrigger value="contacts">Approved contacts ({approved.length})</TabsTrigger>
            <TabsTrigger value="applications">Applications ({activeApps.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="find" className="mt-6">
            <FindParticipants
              trialId={id}
              verified={clinic.verified}
              active={active}
              inviteMessage={trial.invite_message ?? ""}
              irbNumber={trial.irb_protocol_number}
              count={count}
            />
          </TabsContent>

          <TabsContent value="equity" className="mt-6">
            <EquitySummaryView summary={equity} />
          </TabsContent>

          <TabsContent value="overview" className="mt-6">
            <Card>
              <CardContent className="space-y-5 p-6 sm:p-8">
                <div className="space-y-2">
                  {trial.plain_summary ? (
                    <p className="text-[1.1rem] leading-relaxed text-tc-ink">{trial.plain_summary}</p>
                  ) : (
                    <p className="text-tc-ink-2">No summary yet.</p>
                  )}
                  {trial.what_is_involved ? <p className="text-[1.05rem] text-tc-ink-2">{trial.what_is_involved}</p> : null}
                </div>
                <p className="inline-flex rounded-2xl bg-tc-mist px-4 py-2 text-[0.95rem] font-semibold text-tc-ink-2">
                  Ages {trial.min_age_years ?? "any"}–{trial.max_age_years ?? "any"} · {trial.sex === "ALL" || !trial.sex ? "All sexes" : trial.sex.toLowerCase()}
                </p>
                <div>
                  <h2 className="text-[1.45rem] font-extrabold tracking-tight">Checklist</h2>
                  {(criteria ?? []).length === 0 ? (
                    <p className="mt-2 text-tc-ink-2">No criteria saved.</p>
                  ) : (
                    <ul className="mt-3 space-y-3">
                      {(criteria ?? []).map((c, i) => (
                        <li key={i} className="flex gap-3 rounded-2xl bg-tc-mist p-4 text-[1.05rem]">
                          <Badge variant={c.kind === "inclusion" ? "success" : "danger"} className="h-fit shrink-0">
                            {c.kind === "inclusion" ? "Needed" : "Rules out"}
                          </Badge>
                          <span className="text-tc-ink">
                            {c.plain_text}
                            {c.machine_checkable ? (
                              <span className="ml-2 text-[0.95rem] text-tc-muted">(checked automatically)</span>
                            ) : c.patient_question ? (
                              <span className="ml-2 text-[0.95rem] text-tc-muted">(asked as a question)</span>
                            ) : null}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {trial.invite_message ? (
                  <div>
                    <h2 className="text-[1.45rem] font-extrabold tracking-tight">Invitation text</h2>
                    <blockquote className="mt-3 rounded-2xl border-l-4 border-tc-secondary bg-tc-secondary-soft px-5 py-4 text-[1.05rem] italic text-tc-ink">
                      &ldquo;{trial.invite_message}&rdquo;
                    </blockquote>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invitations" className="mt-6">
            <Card>
              <CardContent className="p-6 sm:p-8">
                <h2 className="sr-only">Invitation counts</h2>
                <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="flex flex-col-reverse rounded-2xl bg-tc-mist p-5">
                    <dt className="mt-2 font-bold text-tc-ink-2">Sent</dt>
                    <dd className="text-[2.4rem] font-extrabold leading-none tracking-tight text-tc-secondary">{invitations.length}</dd>
                  </div>
                  {INV_STATUSES.map((s) => (
                    <div key={s} className="flex flex-col-reverse rounded-2xl bg-tc-mist p-5">
                      <dt className="mt-2 font-bold text-tc-ink-2">{INVITATION_STATUS_LABEL[s]}</dt>
                      <dd className="text-[2.4rem] font-extrabold leading-none tracking-tight text-tc-secondary">{invCounts[s]}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-4 text-[0.95rem] text-tc-muted">Counts only. Declines are never identified.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contacts" className="mt-6">
            <Card>
              <CardContent className="p-6 sm:p-8">
                {approved.length === 0 ? (
                  <p className="text-[1.05rem] text-tc-ink-2">No approved contacts yet. When someone approves your invitation, they&apos;ll appear here.</p>
                ) : (
                  <ul className="divide-y divide-tc-border">
                    {approved.map((a) => (
                      <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                        <span className="text-[1.05rem]">
                          <span className="font-bold text-tc-ink">Participant #C-{a.id.slice(0, 6)}</span>
                          <span className="ml-3 text-[0.95rem] text-tc-muted">
                            {a.responded_at ? `Approved ${format(new Date(a.responded_at), "MMM d")}` : ""} · shared {a.shared_fields?.length ?? 0} fields
                          </span>
                        </span>
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/clinic/contacts/${a.id}`}>View report</Link>
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="applications" className="mt-6">
            <Card>
              <CardContent className="p-6 sm:p-8">
                {activeApps.length === 0 ? (
                  <p className="text-[1.05rem] text-tc-ink-2">No applications yet. Patients who match can apply from their TrialCave account.</p>
                ) : (
                  <ul className="divide-y divide-tc-border">
                    {activeApps.map((a) => (
                      <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                        <span className="flex flex-wrap items-center gap-3 text-[1.05rem]">
                          <span className="font-bold text-tc-ink">Participant #A-{a.id.slice(0, 6)}</span>
                          <Badge variant="secondary">{APPLICATION_STATUS_LABEL[a.status] ?? a.status}</Badge>
                          <span className="text-[0.95rem] text-tc-muted">{format(new Date(a.created_at), "MMM d")}</span>
                        </span>
                        <Button asChild variant="secondary" size="sm">
                          <Link href={`/clinic/applications/${a.id}`}>Review</Link>
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                {withdrawnApps > 0 ? (
                  <p className="mt-4 text-[0.95rem] text-tc-muted">{withdrawnApps} application{withdrawnApps === 1 ? " was" : "s were"} withdrawn by the participant.</p>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </PageBody>
    </main>
  );
}
