import Link from "next/link";
import { differenceInDays } from "date-fns";
import { ArrowRight } from "lucide-react";

import { PatientNav } from "@/components/patient-nav";
import { PageBody, PageHero } from "@/components/page-hero";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getMyPatient, getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { expireStaleInvitations } from "@/lib/outreach/invite";

export const dynamic = "force-dynamic";
export const metadata = { title: "Inbox" };

const STATUS_LABEL: Record<string, string> = {
  pending: "New",
  approved: "Sharing",
  declined: "Declined",
  expired: "Expired",
  withdrawn: "Stopped sharing",
};

function expiresText(expiresAt: string): string {
  const days = differenceInDays(new Date(expiresAt), new Date());
  if (days <= 0) return "Expires today";
  return `Expires in ${days} day${days === 1 ? "" : "s"}`;
}

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
      <PageHero
        title="Inbox"
        lede="Invitations from research clinics."
        width="narrow"
      />
      <PageBody width="narrow">
        {rows.length === 0 ? (
          <Card>
            <CardContent className="pt-8 text-center text-[1.05rem] text-tc-ink-2 sm:pt-8">
              No invitations yet. Clinics can only reach you if you meet a study&apos;s criteria.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {rows.map((r) => (
              <Link
                key={r.id}
                href={`/app/inbox/${r.id}`}
                className="group flex flex-wrap items-center justify-between gap-4 rounded-[24px] bg-white p-6 shadow-card transition-shadow hover:shadow-pop focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-tc-primary-soft"
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-[1.15rem] font-bold text-tc-ink">
                    {r.clinic.name} {r.clinic.verified ? <Badge variant="secondary">Verified</Badge> : null}
                  </p>
                  <p className="mt-1 text-[1.05rem] text-tc-ink-2">{r.trialTitle}</p>
                  {r.status === "pending" ? (
                    <p className="mt-1 text-[0.95rem] font-semibold text-tc-warning-ink">{expiresText(r.expiresAt)}</p>
                  ) : null}
                </div>
                <span className="flex items-center gap-3">
                  <Badge variant={STATUS_VARIANT[r.status] ?? "muted"}>{STATUS_LABEL[r.status] ?? r.status}</Badge>
                  <ArrowRight className="size-5 text-tc-primary-ink transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
              </Link>
            ))}
          </div>
        )}
      </PageBody>
    </main>
  );
}
