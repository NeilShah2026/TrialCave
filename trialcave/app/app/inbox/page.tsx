import Link from "next/link";
import { differenceInDays } from "date-fns";

import { PatientNav } from "@/components/patient-nav";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getMyPatient, getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { expireStaleInvitations } from "@/lib/outreach/invite";

export const dynamic = "force-dynamic";

const STATUS_VARIANT: Record<string, "warning" | "success" | "muted" | "danger"> = {
  pending: "warning",
  approved: "success",
  declined: "muted",
  expired: "muted",
  withdrawn: "muted",
};

export default async function InboxPage() {
  const user = await getSessionUser();
  const patient = await getMyPatient();
  await expireStaleInvitations("patient_id", patient.id);
  const admin = createAdminClient();

  const { data: invites } = await admin
    .from("invitations")
    .select("id, status, expires_at, created_at, trials!inner(title), clinics!inner(name, verified)")
    .eq("patient_id", patient.id)
    .order("created_at", { ascending: false });

  const rows = (invites ?? []).map((i) => ({
    id: i.id,
    status: i.status,
    expiresAt: i.expires_at,
    trialTitle: (i.trials as unknown as { title: string }).title,
    clinic: i.clinics as unknown as { name: string; verified: boolean },
  }));
  // Pending first.
  rows.sort((a, b) => (a.status === "pending" ? -1 : 1) - (b.status === "pending" ? -1 : 1));

  return (
    <main className="flex-1">
      <PatientNav email={user?.email ?? ""} />
      <div className="mx-auto max-w-[800px] px-4 py-8">
        <h1 className="text-2xl font-semibold">Inbox</h1>
        {rows.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">
            No invitations yet. Clinics can only reach you if you meet a study&apos;s criteria.
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {rows.map((r) => (
              <Link key={r.id} href={`/app/inbox/${r.id}`} className="block">
                <Card className="transition-colors hover:border-primary">
                  <CardContent className="flex items-center justify-between py-4">
                    <div>
                      <p className="font-medium">
                        {r.clinic.name} {r.clinic.verified ? <Badge variant="secondary">Verified</Badge> : null}
                      </p>
                      <p className="text-sm text-muted-foreground">{r.trialTitle}</p>
                      {r.status === "pending" ? (
                        <p className="text-xs text-muted-foreground">
                          Expires in {Math.max(0, differenceInDays(new Date(r.expiresAt), new Date()))} days
                        </p>
                      ) : null}
                    </div>
                    <Badge variant={STATUS_VARIANT[r.status]}>{r.status}</Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
