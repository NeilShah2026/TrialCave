import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";

import { ResearcherNav } from "@/components/researcher-nav";
import { Card, CardContent } from "@/components/ui/card";
import { getMyResearchPartner, getSessionUser, assertApprovedProjectOwner } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { eligibleDonorPool, ANALYSIS_META } from "@/lib/enclave/run";
import type { AnalysisKey } from "@/lib/enclave/analyses";
import { WorkspaceClient } from "./workspace-client";

export const dynamic = "force-dynamic";

export default async function WorkspacePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const user = await getSessionUser();
  const partner = await getMyResearchPartner();
  await assertApprovedProjectOwner(partner.id, projectId);
  const admin = createAdminClient();

  const { data: project } = await admin
    .from("research_projects")
    .select("title, data_types, research_type, allowed_analyses")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) notFound();

  const pool = await eligibleDonorPool(admin, project.data_types, project.research_type);

  const analyses = (project.allowed_analyses as AnalysisKey[])
    .filter((k) => ANALYSIS_META[k])
    .map((k) => ({ key: k, label: ANALYSIS_META[k].label }));

  const { data: runs } = await admin
    .from("enclave_runs")
    .select("id, analysis_key, donor_count, suppressed_cells, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <main className="flex-1">
      <ResearcherNav email={user?.email ?? ""} orgName={partner.orgName} />
      <div className="mx-auto max-w-[800px] px-4 py-8">
        <Link href="/enclave" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft className="size-4" aria-hidden /> Projects
        </Link>
        <h1 className="mt-3 text-2xl font-semibold">{project.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Eligible Donor pool: {pool.count}</p>

        <div className="mt-6">
          <WorkspaceClient projectId={projectId} analyses={analyses} />
        </div>

        {runs && runs.length > 0 ? (
          <Card className="mt-6">
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold">Run history</h2>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {runs.map((r) => (
                  <li key={r.id}>
                    {format(new Date(r.created_at), "MMM d, HH:mm")} · {ANALYSIS_META[r.analysis_key as AnalysisKey]?.label ?? r.analysis_key} · {r.donor_count} donors · {r.suppressed_cells} hidden
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </main>
  );
}
