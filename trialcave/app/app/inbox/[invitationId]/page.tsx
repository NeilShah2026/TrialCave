import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PatientNav } from "@/components/patient-nav";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CriterionIcon } from "@/components/criterion-icon";
import { getMyPatient, getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { InvitationClient } from "./invitation-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invitation" };

export default async function InvitationDetailPage({ params }: { params: Promise<{ invitationId: string }> }) {
  const { invitationId } = await params;
  const user = await getSessionUser();
  const patient = await getMyPatient();
  const admin = createAdminClient();

  const { data: inv } = await admin
    .from("invitations")
    .select("id, status, message, trial_id, shared_fields, expires_at, trials!inner(title, irb_protocol_number, what_is_involved), clinics!inner(name, verified)")
    .eq("id", invitationId)
    .eq("patient_id", patient.id)
    .maybeSingle();
  if (!inv) notFound();

  const trial = inv.trials as unknown as { title: string; irb_protocol_number: string | null; what_is_involved: string | null };
  const clinic = inv.clinics as unknown as { name: string; verified: boolean };
  const status = inv.status === "pending" && new Date(inv.expires_at) < new Date() ? "expired" : inv.status;

  // "Why you matched": the passing criteria from this study's match.
  const { data: match } = await admin
    .from("match_results")
    .select("details")
    .eq("patient_id", patient.id)
    .eq("trial_id", inv.trial_id)
    .maybeSingle();
  const whyMatched = ((match?.details ?? []) as { criterionId: string; status: string; kind: "inclusion" | "exclusion"; plainText: string }[])
    .filter((d) => d.status === "pass")
    .slice(0, 4);

  return (
    <main className="flex-1">
      <PatientNav email={user?.email ?? ""} />
      <div className="mx-auto max-w-[800px] px-4 py-8">
        <Link href="/app/inbox" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft className="size-4" aria-hidden /> Inbox
        </Link>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold">{clinic.name}</h1>
          {clinic.verified ? <Badge variant="secondary">Verified</Badge> : null}
        </div>
        <p className="text-muted-foreground">
          invited you to learn about{" "}
          <Link href={`/app/matches/${inv.trial_id}`} className="text-primary hover:underline">{trial.title}</Link>
          {trial.irb_protocol_number ? ` · IRB ${trial.irb_protocol_number}` : ""}
        </p>

        <Card className="mt-4">
          <CardContent className="pt-6">
            {inv.message ? <blockquote className="border-l-4 border-tc-primary-soft pl-3 text-sm italic">{inv.message}</blockquote> : null}
            {whyMatched.length > 0 ? (
              <div className="mt-4">
                <h2 className="text-sm font-semibold">Why you matched</h2>
                <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                  {whyMatched.map((d) => (
                    <li key={d.criterionId} className="flex gap-2">
                      <CriterionIcon status="pass" kind={d.kind} className="[&_svg]:size-4" />
                      <span>{d.kind === "exclusion" ? "Doesn't apply: " : ""}{d.plainText}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {trial.what_is_involved ? (
              <p className="mt-3 text-sm"><span className="font-semibold">What&apos;s involved: </span>{trial.what_is_involved}</p>
            ) : null}
            <p className="mt-3 text-xs text-muted-foreground">
              The clinic doesn&apos;t know who you are. Nothing is shared unless you approve.
            </p>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardContent className="pt-6">
            <InvitationClient invitationId={invitationId} status={status} clinicName={clinic.name} sharedFields={inv.shared_fields ?? []} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
