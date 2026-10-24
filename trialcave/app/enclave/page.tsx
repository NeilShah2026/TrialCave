import Link from "next/link";

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
      <div className="mx-auto max-w-[1100px] px-4 py-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Your projects</h1>
            <p className="mt-1 text-muted-foreground">
              Run approved analyses inside the Enclave. Only aggregate results leave.
            </p>
          </div>
          {projects && projects.length > 0 ? <RequestProjectForm /> : null}
        </div>

        {!partner.verified ? (
          <p className="mt-3 rounded-md bg-tc-secondary-soft px-3 py-2 text-sm">
            Your organization is pending verification. You can request projects now.
          </p>
        ) : null}

        {!projects || projects.length === 0 ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-muted-foreground">
              No projects yet. Request one to get started.
            </div>
            <RequestProjectForm startOpen />
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {projects.map((p) => (
              <Card key={p.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-semibold">{p.title}</h2>
                    <Badge variant={p.status === "approved" ? "success" : p.status === "pending" ? "warning" : "muted"}>{STATUS_TEXT[p.status] ?? p.status}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    <span className="capitalize">{p.research_type}</span> · {(p.data_types ?? []).join(", ")} · {formatCents(p.access_fee_per_run_cents)} per run
                  </p>
                  {p.status === "approved" ? (
                    <Button asChild size="sm" className="mt-3">
                      <Link href={`/enclave/${p.id}`}>Open workspace</Link>
                    </Button>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">
                      {p.status === "pending" ? "Awaiting TrialCave approval." : "This project wasn't approved."}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
