import { format } from "date-fns";

import { AppHeader } from "@/components/app-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getSessionUser, requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { VerifyClinicButton, ProjectDecisionButtons, TrialAdminButtons, ResetDemoButton } from "./admin-clients";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  await requireRole("admin");
  const user = await getSessionUser();
  const admin = createAdminClient();

  const { data: clinics } = await admin.from("clinics").select("id, name, town, verified").order("name");
  const { data: projects } = await admin
    .from("research_projects")
    .select("id, title, status, research_type, research_partners!inner(org_name)")
    .order("created_at", { ascending: false });
  const { data: auditRows } = await admin
    .from("audit_log")
    .select("action, actor_role, target_type, target_id, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(40);

  const trialCounts: Record<string, number> = {};
  for (const s of ["pending", "parsed", "failed"]) {
    const { count } = await admin.from("trials").select("id", { count: "exact", head: true }).eq("source", "ctgov").eq("parse_status", s);
    trialCounts[s] = count ?? 0;
  }
  const { data: lastSync } = await admin.from("trials").select("updated_at").eq("source", "ctgov").order("updated_at", { ascending: false }).limit(1).maybeSingle();

  return (
    <main className="flex-1">
      <AppHeader email={user?.email ?? ""} />
      <div className="mx-auto max-w-[1100px] px-4 py-8">
        <h1 className="text-2xl font-semibold">TrialCave Admin</h1>

        <Tabs defaultValue="clinics" className="mt-6">
          <TabsList>
            <TabsTrigger value="clinics">Clinics</TabsTrigger>
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="trials">Trials</TabsTrigger>
            <TabsTrigger value="audit">Audit log</TabsTrigger>
            <TabsTrigger value="demo">Demo</TabsTrigger>
          </TabsList>

          <TabsContent value="clinics">
            <Card>
              <CardContent className="pt-6">
                <ul className="divide-y divide-border">
                  {(clinics ?? []).map((c) => (
                    <li key={c.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.town}</p>
                      </div>
                      <span className="flex items-center gap-3">
                        <Badge variant={c.verified ? "success" : "muted"}>{c.verified ? "Verified" : "Unverified"}</Badge>
                        <VerifyClinicButton clinicId={c.id} verified={c.verified} />
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="projects">
            <Card>
              <CardContent className="pt-6">
                <ul className="divide-y divide-border">
                  {(projects ?? []).map((p) => (
                    <li key={p.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="font-medium">{p.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {(p.research_partners as unknown as { org_name: string }).org_name} · {p.research_type}
                        </p>
                      </div>
                      <span className="flex items-center gap-3">
                        <Badge variant={p.status === "approved" ? "success" : p.status === "pending" ? "warning" : "muted"}>{p.status}</Badge>
                        {p.status === "pending" ? <ProjectDecisionButtons projectId={p.id} /> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trials">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm">
                  ClinicalTrials.gov trials: {trialCounts.parsed} parsed · {trialCounts.pending} pending · {trialCounts.failed} failed
                </p>
                {lastSync ? <p className="text-xs text-muted-foreground">Last sync {format(new Date(lastSync.updated_at), "MMM d, yyyy HH:mm")}</p> : null}
                <div className="mt-4"><TrialAdminButtons /></div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit">
            <Card>
              <CardContent className="pt-6">
                <ul className="space-y-1 text-sm">
                  {(auditRows ?? []).map((a, i) => (
                    <li key={i} className="flex items-center justify-between">
                      <span>
                        <span className="font-mono text-xs">{a.action}</span>
                        {a.target_type ? <span className="text-muted-foreground"> · {a.target_type}</span> : null}
                      </span>
                      <span className="text-xs text-muted-foreground">{format(new Date(a.created_at), "MMM d HH:mm")}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-muted-foreground">Ids and counts only — never patient facts.</p>
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
                <div className="mt-4"><ResetDemoButton /></div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
