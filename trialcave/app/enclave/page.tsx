import Link from "next/link";

import { PageBody, PageHero } from "@/components/page-hero";
import { ResearcherNav } from "@/components/researcher-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getMyResearchPartner, getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCents } from "@/lib/patient";
import { RequestProjectForm } from "./request-project";

export const dynamic = "force-dynamic";
export const metadata = { title: "Enclave projects" };

const STATUS_TEXT: Record<string, string> = { approved: "Approved", pending: "Awaiting approval", rejected: "Not approved" };

export default async function EnclaveHome() {
  const user = await getSessionUser();
  const partner = await getMyResearchPartner();
  const admin = createAdminClient();

  const { data: projects } = await admin
    .from("research_projects")
    .select("id, title, description, status, research_type, data_types, access_fee_per_run_cents")
    .eq("partner_id", partner.id)
    .order("created_at", { ascending: false });

  return (
    <main className="flex-1">
      <ResearcherNav email={user?.email ?? ""} orgName={partner.orgName} />
      <PageHero
        tone="night"
        kicker={partner.orgName}
        title="Your projects"
        lede="Run approved analyses inside the Enclave. Only aggregate results leave."
      />
      <PageBody width="wide">
        {!partner.verified ? (
          <p className="mb-6 rounded-2xl bg-tc-warning-soft px-5 py-4 font-semibold text-tc-warning-ink">
            Your organization is pending verification. You can request projects now.
          </p>
        ) : null}

        {!projects || projects.length === 0 ? (
          <div className="space-y-6">
            <Card className="border-2 border-dashed border-tc-border p-10 text-center text-[1.1rem] text-tc-ink-2 shadow-none">
              No projects yet. Request one to get started.
            </Card>
            <RequestProjectForm startOpen />
          </div>
        ) : (
          <>
            <div className="mb-6">
              <RequestProjectForm />
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              {projects.map((p) => (
                <Card key={p.id} className="flex flex-col">
                  <CardContent className="flex flex-1 flex-col p-6 sm:p-7">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="text-[1.15rem] font-bold text-tc-ink">{p.title}</h2>
                      <Badge variant={p.status === "approved" ? "success" : p.status === "pending" ? "warning" : "muted"}>{STATUS_TEXT[p.status] ?? p.status}</Badge>
                    </div>
                    <p className="mt-2 text-[1.05rem] text-tc-ink-2">{p.description}</p>
                    <p className="mt-4 rounded-2xl bg-tc-mist px-4 py-3 text-[0.95rem] text-tc-ink-2">
                      <span className="font-bold capitalize text-tc-ink">{p.research_type}</span> · {(p.data_types ?? []).join(", ")} · {formatCents(p.access_fee_per_run_cents)} per run
                    </p>
                    <div className="mt-auto pt-5">
                      {p.status === "approved" ? (
                        <Button asChild variant="night">
                          <Link href={`/enclave/${p.id}`}>Open workspace</Link>
                        </Button>
                      ) : (
                        <p className="text-[1rem] font-semibold text-tc-muted">
                          {p.status === "pending" ? "Awaiting TrialCave approval." : "This project wasn't approved."}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </PageBody>
    </main>
  );
}
