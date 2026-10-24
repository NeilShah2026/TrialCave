import Link from "next/link";
import { format } from "date-fns";

import { AppHeader } from "@/components/app-header";
import { PageBody, PageHero } from "@/components/page-hero";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEMO_MODE, hasAnthropic } from "@/lib/env";
import { DEMO_ACCOUNTS } from "@/lib/demo/accounts";
import { cn } from "@/lib/utils";
import { VerifyClinicButton, IrbToggle, ProjectDecisionButtons, TrialAdminButtons, ResetDemoButton } from "./admin-clients";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin" };

const TABS = new Set(["clinics", "projects", "trials", "audit", "demo"]);
const PAGE_SIZE = 50;

const TH = "border-b-2 border-tc-border px-4 py-3 text-left text-[0.9rem] font-bold text-tc-muted";
const TD = "border-b border-tc-border px-4 py-3 text-[1rem]";

export default async function AdminHome({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; action?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireRole("admin");
  const admin = createAdminClient();
  const page = Math.max(1, Number(sp.page) || 1);
  const actionFilter = sp.action && /^[a-z_.]+$/.test(sp.action) ? sp.action : "";

  let auditQuery = admin
    .from("audit_log")
    .select("action, actor_role, actor_user_id, target_type, target_id, metadata, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (actionFilter) auditQuery = auditQuery.eq("action", actionFilter);

  const [{ data: clinics }, { data: projects }, auditRes, parsed, pendingCount, failed, clinicTrials, lastSyncRes] = await Promise.all([
    admin.from("clinics").select("id, name, town, verified, irb_on_file").order("name"),
    admin
      .from("research_projects")
      .select("id, title, status, research_type, data_types, research_partners!inner(org_name)")
      .order("created_at", { ascending: false }),
    auditQuery,
    admin.from("trials").select("id", { count: "exact", head: true }).eq("source", "ctgov").eq("parse_status", "parsed"),
    admin.from("trials").select("id", { count: "exact", head: true }).eq("source", "ctgov").eq("parse_status", "pending"),
    admin.from("trials").select("id", { count: "exact", head: true }).eq("source", "ctgov").eq("parse_status", "failed"),
    admin.from("trials").select("id", { count: "exact", head: true }).eq("source", "clinic"),
    admin.from("trials").select("updated_at").eq("source", "ctgov").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const auditRows = auditRes.data ?? [];
  const auditTotal = auditRes.count ?? 0;
  const lastPage = Math.max(1, Math.ceil(auditTotal / PAGE_SIZE));
  const tab = sp.tab && TABS.has(sp.tab) ? sp.tab : actionFilter || sp.page ? "audit" : "clinics";

  const ACTIONS = [
    "clinic.verified", "project.approved", "project.rejected", "trials.synced", "demo.reset", "invitation.sent",
    "contact.viewed", "application.viewed", "enclave.run", "enclave.export", "enclave.raw_download_blocked",
    "data.exported", "data.deleted", "research.withdrawn", "consent.recorded", "document.uploaded",
  ];
  const auditHref = (p: number, a = actionFilter) => `/admin?tab=audit${a ? `&action=${a}` : ""}${p > 1 ? `&page=${p}` : ""}`;
  const chip = (on: boolean) =>
    cn(
      "inline-flex min-h-10 items-center rounded-full px-3 text-[0.9rem] font-bold transition-colors",
      on ? "bg-tc-primary text-white" : "bg-tc-mist text-tc-ink-2 hover:bg-tc-primary-soft hover:text-tc-primary-ink",
    );

  return (
    <main className="flex-1">
      <AppHeader email={user.email} homeHref="/admin" />
      <PageHero tone="mist" kicker="Admin" title="TrialCave Admin" />
      <PageBody width="wide" className="pt-0">
        <Tabs defaultValue={tab}>
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="clinics">Clinics</TabsTrigger>
            <TabsTrigger value="projects">Research projects</TabsTrigger>
            <TabsTrigger value="trials">Trials</TabsTrigger>
            <TabsTrigger value="audit">Audit log</TabsTrigger>
            <TabsTrigger value="demo">Demo</TabsTrigger>
          </TabsList>

          <TabsContent value="clinics" className="mt-6">
            {(clinics ?? []).length === 0 ? (
              <Card className="p-6 text-[1.05rem] text-tc-ink-2 sm:p-8">No clinics have signed up yet.</Card>
            ) : (
              <Card className="overflow-x-auto">
                <table className="w-full min-w-[720px]">
                  <caption className="sr-only">Clinics</caption>
                  <thead>
                    <tr>
                      <th scope="col" className={TH}>Clinic</th>
                      <th scope="col" className={TH}>Status</th>
                      <th scope="col" className={TH}>
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(clinics ?? []).map((c) => (
                      <tr key={c.id} className="[&:last-child>td]:border-0">
                        <td className={TD}>
                          <p className="font-bold text-tc-ink">{c.name}</p>
                          <p className="text-[0.95rem] text-tc-muted">{c.town}</p>
                        </td>
                        <td className={TD}>
                          <Badge variant={c.verified ? "success" : "muted"}>{c.verified ? "Verified" : "Unverified"}</Badge>
                        </td>
                        <td className={TD}>
                          <span className="flex flex-wrap items-center justify-end gap-2">
                            <IrbToggle clinicId={c.id} onFile={c.irb_on_file} />
                            <VerifyClinicButton clinicId={c.id} verified={c.verified} />
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="projects" className="mt-6">
            {(projects ?? []).length === 0 ? (
              <Card className="p-6 text-[1.05rem] text-tc-ink-2 sm:p-8">No research projects yet.</Card>
            ) : (
              <Card className="overflow-x-auto">
                <table className="w-full min-w-[720px]">
                  <caption className="sr-only">Research projects</caption>
                  <thead>
                    <tr>
                      <th scope="col" className={TH}>Project</th>
                      <th scope="col" className={TH}>Status</th>
                      <th scope="col" className={TH}>
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(projects ?? []).map((p) => (
                      <tr key={p.id} className="[&:last-child>td]:border-0">
                        <td className={TD}>
                          <p className="font-bold text-tc-ink">{p.title}</p>
                          <p className="text-[0.95rem] text-tc-muted">
                            {(p.research_partners as unknown as { org_name: string }).org_name} · {p.research_type} · {(p.data_types ?? []).join(", ")}
                          </p>
                        </td>
                        <td className={TD}>
                          <Badge variant={p.status === "approved" ? "success" : p.status === "pending" ? "warning" : "muted"} className="capitalize">{p.status}</Badge>
                        </td>
                        <td className={TD}>
                          <span className="flex justify-end">
                            <ProjectDecisionButtons projectId={p.id} status={p.status} />
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="trials" className="mt-6">
            <Card>
              <CardContent className="space-y-5 p-6 sm:p-8">
                <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    ["Parsed", parsed.count ?? 0],
                    ["Pending", pendingCount.count ?? 0],
                    ["Failed", failed.count ?? 0],
                    ["Clinic studies", clinicTrials.count ?? 0],
                  ].map(([l, v]) => (
                    <div key={l} className="flex flex-col-reverse rounded-2xl bg-tc-mist p-5">
                      <dt className="mt-2 font-bold text-tc-ink-2">{l}</dt>
                      <dd className="text-[2.4rem] font-extrabold leading-none tracking-tight text-tc-primary-ink">{Number(v).toLocaleString()}</dd>
                    </div>
                  ))}
                </dl>
                {lastSyncRes.data ? (
                  <p className="text-[0.95rem] text-tc-muted">Last ClinicalTrials.gov sync {format(new Date(lastSyncRes.data.updated_at), "MMM d, yyyy h:mm a")}</p>
                ) : null}
                <TrialAdminButtons aiAvailable={hasAnthropic()} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit" className="mt-6 space-y-5">
            <nav aria-label="Filter audit log" className="flex flex-wrap gap-2">
              <Link href={auditHref(1, "")} aria-current={!actionFilter ? "page" : undefined} className={chip(!actionFilter)}>All</Link>
              {ACTIONS.map((a) => (
                <Link key={a} href={auditHref(1, a)} aria-current={actionFilter === a ? "page" : undefined} className={cn(chip(actionFilter === a), "font-mono")}>
                  {a}
                </Link>
              ))}
            </nav>
            {auditRows.length === 0 ? (
              <Card className="p-6 text-[1.05rem] text-tc-ink-2 sm:p-8">No entries.</Card>
            ) : (
              <Card className="overflow-x-auto">
                <table className="w-full min-w-[760px]">
                  <caption className="sr-only">Audit log</caption>
                  <thead>
                    <tr>
                      <th scope="col" className={TH}>When</th>
                      <th scope="col" className={TH}>Action</th>
                      <th scope="col" className={TH}>Actor</th>
                      <th scope="col" className={TH}>Target</th>
                      <th scope="col" className={TH}>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditRows.map((a, i) => (
                      <tr key={i} className="align-top [&:last-child>td]:border-0">
                        <td className={cn(TD, "whitespace-nowrap text-[0.95rem]")}>{format(new Date(a.created_at), "MMM d, HH:mm:ss")}</td>
                        <td className={cn(TD, "font-mono text-[0.95rem] font-semibold")}>{a.action}</td>
                        <td className={cn(TD, "text-[0.95rem]")}>{a.actor_role ?? "system"}{a.actor_user_id ? ` · ${String(a.actor_user_id).slice(0, 8)}` : ""}</td>
                        <td className={cn(TD, "text-[0.95rem]")}>{a.target_type ?? ""}{a.target_id ? ` · ${String(a.target_id).slice(0, 8)}` : ""}</td>
                        <td className={cn(TD, "max-w-[280px] truncate font-mono text-[0.9rem] text-tc-ink-2")} title={JSON.stringify(a.metadata ?? {})}>
                          {a.metadata && Object.keys(a.metadata).length ? JSON.stringify(a.metadata) : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 text-[0.95rem] text-tc-muted">
              <span>Ids and counts only. Never patient facts. {auditTotal.toLocaleString()} entries.</span>
              <span className="flex items-center gap-3">
                {page > 1 ? <Button asChild size="sm" variant="outline"><Link href={auditHref(page - 1)}>Newer</Link></Button> : null}
                <span className="font-semibold text-tc-ink-2">Page {page} of {lastPage}</span>
                {page < lastPage ? <Button asChild size="sm" variant="outline"><Link href={auditHref(page + 1)}>Older</Link></Button> : null}
              </span>
            </div>
          </TabsContent>

          <TabsContent value="demo" className="mt-6 space-y-6">
            <Card>
              <CardContent className="space-y-4 p-6 sm:p-8">
                <h2 className="text-[1.45rem] font-extrabold tracking-tight">Reset demo</h2>
                <p className="text-[1.05rem] text-tc-ink-2">
                  Wipes and reseeds all demo data (patients, clinics, studies, research) and
                  recomputes matches. ClinicalTrials.gov trials are kept.
                </p>
                <ResetDemoButton enabled={DEMO_MODE} />
              </CardContent>
            </Card>

            <div>
              <h2 className="text-[1.45rem] font-extrabold tracking-tight">Demo accounts</h2>
              <p className="mt-1 text-[1.05rem] text-tc-ink-2">All use the DEMO_PASSWORD from .env.local. Sign in from the login page.</p>
              <Card className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[560px]">
                  <caption className="sr-only">Demo accounts</caption>
                  <thead>
                    <tr>
                      <th scope="col" className={TH}>Name</th>
                      <th scope="col" className={TH}>Role</th>
                      <th scope="col" className={TH}>Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DEMO_ACCOUNTS.map((a) => (
                      <tr key={a.email} className="[&:last-child>td]:border-0">
                        <td className={cn(TD, "font-semibold")}>{a.name}</td>
                        <td className={cn(TD, "capitalize")}>{a.role}{a.donor ? " · Donor" : ""}</td>
                        <td className={cn(TD, "font-mono text-[0.95rem]")}>{a.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </PageBody>
    </main>
  );
}
