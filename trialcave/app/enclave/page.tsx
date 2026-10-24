import Link from "next/link";

import { ResearcherNav } from "@/components/researcher-nav";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getMyResearchPartner, getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCents } from "@/lib/patient";

export const dynamic = "force-dynamic";

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
        <h1 className="text-2xl font-semibold">Your projects</h1>
        <p className="mt-1 text-muted-foreground">
          Run approved analyses inside the Enclave. Only aggregate results leave.
        </p>

        {!projects || projects.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">
            No projects yet.
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {projects.map((p) => (
              <Card key={p.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-semibold">{p.title}</h2>
                    <Badge variant={p.status === "approved" ? "success" : p.status === "pending" ? "warning" : "muted"}>{p.status}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {p.research_type} · {(p.data_types ?? []).join(", ")} · {formatCents(p.access_fee_per_run_cents)}/run
                  </p>
                  {p.status === "approved" ? (
                    <Link href={`/enclave/${p.id}`} className="mt-3 inline-block text-sm text-primary hover:underline">
                      Open workspace
                    </Link>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">Awaiting TrialCave approval.</p>
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
