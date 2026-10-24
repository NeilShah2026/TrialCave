import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PatientNav } from "@/components/patient-nav";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getMyPatient, getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadMatches } from "@/lib/patient";
import { InvitationClient } from "./invitation-client";

export const dynamic = "force-dynamic";

export default async function InvitationDetailPage({ params }: { params: Promise<{ invitationId: string }> }) {
  const { invitationId } = await params;
  const user = await getSessionUser();
  const patient = await getMyPatient();
  const admin = createAdminClient();

  const { data: inv } = await admin
    .from("invitations")
    .select("id, status, message, trial_id, trials!inner(title), clinics!inner(name, verified)")
    .eq("id", invitationId)
    .eq("patient_id", patient.id)
    .maybeSingle();
  if (!inv) notFound();

  const trial = inv.trials as unknown as { title: string };
  const clinic = inv.clinics as unknown as { name: string; verified: boolean };

  // "Why you matched": the passing criteria from the match.
  const matches = await loadMatches(patient.id);
  const match = matches.find((m) => m.trialId === inv.trial_id);
  const whyMatched = (match?.details ?? []).filter((d) => d.status === "pass").slice(0, 3);

  return (
    <main className="flex-1">
      <PatientNav email={user?.email ?? ""} />
      <div className="mx-auto max-w-[800px] px-4 py-8">
        <Link href="/app/inbox" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft className="size-4" aria-hidden /> Inbox
        </Link>

        <div className="mt-3 flex items-center gap-2">
          <h1 className="text-2xl font-semibold">{clinic.name}</h1>
          {clinic.verified ? <Badge variant="secondary">Verified</Badge> : null}
        </div>
        <p className="text-muted-foreground">invited you to learn about {trial.title}</p>

        <Card className="mt-4">
          <CardContent className="pt-6">
            <p className="text-sm italic">&ldquo;{inv.message}&rdquo;</p>
            {whyMatched.length > 0 ? (
              <div className="mt-3">
                <p className="text-sm font-semibold">Why you matched</p>
                <ul className="mt-1 text-sm text-muted-foreground">
                  {whyMatched.map((d) => <li key={d.criterionId}>✅ {d.plainText}</li>)}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardContent className="pt-6">
            <InvitationClient invitationId={invitationId} status={inv.status} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
