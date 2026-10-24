import { notFound } from "next/navigation";
import { format } from "date-fns";

import { PageBody, PageHero } from "@/components/page-hero";
import { ResearcherNav } from "@/components/researcher-nav";
import { Card } from "@/components/ui/card";
import { getMyResearchPartner, getSessionUser, assertApprovedProjectOwner } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { eligibleDonorPool, ANALYSIS_META } from "@/lib/enclave/run";
import { K_MIN, type AnalysisKey } from "@/lib/enclave/analyses";
import { WorkspaceClient } from "./workspace-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Enclave workspace" };

export default async function WorkspacePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const user = await getSessionUser();
  const partner = await getMyResearchPartner();
  try {
    await assertApprovedProjectOwner(partner.id, projectId);
  } catch {
    notFound();
  }
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
      <PageHero tone="night" back={{ href: "/enclave", label: "Projects" }} kicker="Enclave workspace" title={project.title}>
        <dl className="flex flex-wrap gap-3">
          {[
            { label: "Eligible Donor pool", value: String(pool.count) },
            { label: "Approved analyses", value: String(analyses.length) },
            { label: "Smallest group shown", value: `${K_MIN}+` },
            { label: "Rows that can leave", value: "0" },
          ].map((s) => (
            <div key={s.label} className="flex min-w-[10.5rem] flex-col-reverse rounded-[20px] border border-tc-night-line bg-tc-night-2/80 px-5 py-4 backdrop-blur">
              <dt className="mt-2 text-[0.95rem] font-bold text-tc-night-text">{s.label}</dt>
              <dd className="text-[2.1rem] font-extrabold leading-none tracking-tight text-tc-mint">{s.value}</dd>
            </div>
          ))}
        </dl>
        {(project.data_types as string[] | null)?.length ? (
          <p className="mt-4 flex flex-wrap items-center gap-2 text-[0.95rem] text-tc-night-text">
            Data in this project:
            {(project.data_types as string[]).map((d) => (
              <span key={d} className="rounded-full bg-tc-night-2 px-3 py-1 text-[0.85rem] font-bold capitalize text-tc-mint">
                {d}
              </span>
            ))}
          </p>
        ) : null}
      </PageHero>
      <PageBody width="wide" className="space-y-6">
        <WorkspaceClient
          projectId={projectId}
          projectTitle={project.title}
          analyses={analyses}
          kMin={K_MIN}
          poolCount={pool.count}
          dataTypes={(project.data_types as string[] | null) ?? []}
        />

        <div>
          <h2 className="mb-4 text-[1.45rem] font-extrabold tracking-tight">Run history</h2>
          {runs && runs.length > 0 ? (
            <Card className="overflow-x-auto">
              <table className="w-full">
                <caption className="sr-only">Recent runs</caption>
                <thead>
                  <tr>
                    <th scope="col" className="border-b-2 border-tc-border px-4 py-3 text-left text-[0.9rem] font-bold text-tc-muted">When</th>
                    <th scope="col" className="border-b-2 border-tc-border px-4 py-3 text-left text-[0.9rem] font-bold text-tc-muted">Analysis</th>
                    <th scope="col" className="border-b-2 border-tc-border px-4 py-3 text-left text-[0.9rem] font-bold text-tc-muted">Donors included</th>
                    <th scope="col" className="border-b-2 border-tc-border px-4 py-3 text-left text-[0.9rem] font-bold text-tc-muted">Hidden groups</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr key={r.id} className="[&:last-child>td]:border-0">
                      <td className="border-b border-tc-border px-4 py-3 text-[1rem]">{format(new Date(r.created_at), "MMM d, h:mm a")}</td>
                      <td className="border-b border-tc-border px-4 py-3 text-[1rem] font-semibold">{ANALYSIS_META[r.analysis_key as AnalysisKey]?.label ?? r.analysis_key}</td>
                      <td className="border-b border-tc-border px-4 py-3 text-[1rem]">{r.donor_count}</td>
                      <td className="border-b border-tc-border px-4 py-3 text-[1rem]">{r.suppressed_cells}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          ) : (
            <Card className="p-6 text-[1.05rem] text-tc-ink-2 sm:p-8">No runs yet.</Card>
          )}
        </div>
      </PageBody>
    </main>
  );
}
