import Link from "next/link";
import { format } from "date-fns";

import { AppHeader } from "@/components/app-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEMO_MODE, hasAnthropic } from "@/lib/env";
import { DEMO_ACCOUNTS } from "@/lib/demo/accounts";
import { VerifyClinicButton, IrbToggle, ProjectDecisionButtons, TrialAdminButtons, ResetDemoButton } from "./admin-clients";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin" };

const TABS = new Set(["clinics", "projects", "trials", "audit", "demo"]);
const PAGE_SIZE = 50;

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

  return (
    <main className="flex-1">
      <AppHeader email={user.email} homeHref="/admin" />
      <div className="mx-auto max-w-[1100px] px-4 py-8">
        <h1 className="text-2xl font-semibold">TrialCave Admin</h1>

        <Tabs defaultValue={tab} className="mt-6">
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="clinics">Clinics</TabsTrigger>
            <TabsTrigger value="projects">Research projects</TabsTrigger>
            <TabsTrigger value="trials">Trials</TabsTrigger>
            <TabsTrigger value="audit">Audit log</TabsTrigger>
            <TabsTrigger value="demo">Demo</TabsTrigger>
          </TabsList>

          <TabsContent value="clinics">
            <Card>
              <CardContent className="pt-6">
                {(clinics ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No clinics have signed up yet.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {(clinics ?? []).map((c) => (
                      <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                        <div>
                          <p className="font-medium">{c.name}</p>
                          <p className="text-xs text-muted-foreground">{c.town}</p>
                        </div>
                        <span className="flex flex-wrap items-center gap-2">
                          <Badge variant={c.verified ? "success" : "muted"}>{c.verified ? "Verified" : "Unverified"}</Badge>
                          <IrbToggle clinicId={c.id} onFile={c.irb_on_file} />
                          <VerifyClinicButton clinicId={c.id} verified={c.verified} />
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="projects">
            <Card>
              <CardContent className="pt-6">
                {(projects ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No research projects yet.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {(projects ?? []).map((p) => (
                      <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                        <div>
                          <p className="font-medium">{p.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {(p.research_partners as unknown as { org_name: string }).org_name} · {p.research_type} · {(p.data_types ?? []).join(", ")}
                          </p>
                        </div>
                        <span className="flex flex-wrap items-center gap-2">
                          <Badge variant={p.status === "approved" ? "success" : p.status === "pending" ? "warning" : "muted"} className="capitalize">{p.status}</Badge>
                          <ProjectDecisionButtons projectId={p.id} status={p.status} />
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trials">
            <Card>
              <CardContent className="pt-6">
                <dl className="grid gap-2 text-sm sm:grid-cols-4">
                  {[
                    ["Parsed", parsed.count ?? 0],
                    ["Pending", pendingCount.count ?? 0],
                    ["Failed", failed.count ?? 0],
                    ["Clinic studies", clinicTrials.count ?? 0],
                  ].map(([l, v]) => (
                    <div key={l} className="rounded-md border border-border px-3 py-2">
                      <dt className="text-xs text-muted-foreground">{l}</dt>
                      <dd className="text-lg font-semibold">{Number(v).toLocaleString()}</dd>
                    </div>
                  ))}
                </dl>
                {lastSyncRes.data ? (
                  <p className="mt-2 text-xs text-muted-foreground">Last ClinicalTrials.gov sync {format(new Date(lastSyncRes.data.updated_at), "MMM d, yyyy h:mm a")}</p>
                ) : null}
                <div className="mt-4"><TrialAdminButtons aiAvailable={hasAnthropic()} /></div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit">
            <Card>
              <CardContent className="pt-6">
                <nav aria-label="Filter audit log" className="flex flex-wrap gap-1">
                  <Link href={auditHref(1, "")} className={`rounded-md px-2 py-1 text-xs ${!actionFilter ? "bg-tc-primary-soft text-tc-primary" : "hover:bg-muted"}`}>All</Link>
                  {ACTIONS.map((a) => (
                    <Link key={a} href={auditHref(1, a)} className={`rounded-md px-2 py-1 font-mono text-xs ${actionFilter === a ? "bg-tc-primary-soft text-tc-primary" : "hover:bg-muted"}`}>
                      {a}
                    </Link>
                  ))}
                </nav>
                {auditRows.length === 0 ? (
                  <p className="mt-4 text-sm text-muted-foreground">No entries.</p>
                ) : (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[640px] text-left text-xs">
                      <caption className="sr-only">Audit log</caption>
                      <thead>
                        <tr className="border-b border-border text-muted-foreground">
                          <th scope="col" className="py-2 pr-2">When</th>
                          <th scope="col" className="py-2 pr-2">Action</th>
                          <th scope="col" className="py-2 pr-2">Actor</th>
                          <th scope="col" className="py-2 pr-2">Target</th>
                          <th scope="col" className="py-2">Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditRows.map((a, i) => (
                          <tr key={i} className="border-b border-border align-top last:border-0">
                            <td className="whitespace-nowrap py-1.5 pr-2">{format(new Date(a.created_at), "MMM d, HH:mm:ss")}</td>
                            <td className="py-1.5 pr-2 font-mono">{a.action}</td>
                            <td className="py-1.5 pr-2">{a.actor_role ?? "system"}{a.actor_user_id ? ` · ${String(a.actor_user_id).slice(0, 8)}` : ""}</td>
                            <td className="py-1.5 pr-2">{a.target_type ?? ""}{a.target_id ? ` · ${String(a.target_id).slice(0, 8)}` : ""}</td>
                            <td className="max-w-[280px] truncate py-1.5 font-mono text-muted-foreground" title={JSON.stringify(a.metadata ?? {})}>
                              {a.metadata && Object.keys(a.metadata).length ? JSON.stringify(a.metadata) : ""}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Ids and counts only. Never patient facts. {auditTotal.toLocaleString()} entries.</span>
                  <span className="flex items-center gap-2">
                    {page > 1 ? <Button asChild size="sm" variant="outline"><Link href={auditHref(page - 1)}>Newer</Link></Button> : null}
                    <span>Page {page} of {lastPage}</span>
                    {page < lastPage ? <Button asChild size="sm" variant="outline"><Link href={auditHref(page + 1)}>Older</Link></Button> : null}
                  </span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="demo">
            <Card>
              <CardContent className="pt-6">
                <h2 className="text-lg font-semibold">Reset demo</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Wipes and reseeds all demo data (patients, clinics, studies, research) and
                  recomputes matches. ClinicalTrials.gov trials are kept.
                </p>
                <div className="mt-4"><ResetDemoButton enabled={DEMO_MODE} /></div>

                <h2 className="mt-8 text-lg font-semibold">Demo accounts</h2>
                <p className="mt-1 text-sm text-muted-foreground">All use the DEMO_PASSWORD from .env.local. Sign in from the login page.</p>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <caption className="sr-only">Demo accounts</caption>
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th scope="col" className="py-2 pr-2">Name</th>
                        <th scope="col" className="py-2 pr-2">Role</th>
                        <th scope="col" className="py-2">Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      {DEMO_ACCOUNTS.map((a) => (
                        <tr key={a.email} className="border-b border-border last:border-0">
                          <td className="py-2 pr-2">{a.name}</td>
                          <td className="py-2 pr-2 capitalize">{a.role}{a.donor ? " · Donor" : ""}</td>
                          <td className="py-2 font-mono text-xs">{a.email}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
