import Link from "next/link";
import { notFound } from "next/navigation";

import { PatientNav } from "@/components/patient-nav";
import { PageBody, PageHero } from "@/components/page-hero";
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
      <PageHero
        tone="teal"
        width="narrow"
        back={{ href: "/app/inbox", label: "Inbox" }}
        title={
          <span className="inline-flex flex-wrap items-center gap-3">
            {clinic.name}
            {clinic.verified ? <Badge variant="secondary" className="text-[0.95rem]">Verified</Badge> : null}
          </span>
        }
        lede={
          <>
            invited you to learn about{" "}
            <Link href={`/app/matches/${inv.trial_id}`} className="font-bold text-tc-primary-ink underline-offset-4 hover:underline">{trial.title}</Link>
            {trial.irb_protocol_number ? ` · IRB ${trial.irb_protocol_number}` : ""}
          </>
        }
      />
      <PageBody width="narrow">
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6 sm:pt-7">
              {inv.message ? (
                <blockquote className="rounded-2xl border-l-4 border-tc-primary bg-tc-mist px-5 py-4 text-[1.05rem] italic text-tc-ink">
                  {inv.message}
                </blockquote>
              ) : null}
              {whyMatched.length > 0 ? (
                <div className="mt-5">
                  <h2 className="text-[1.15rem] font-bold">Why you matched</h2>
                  <ul className="mt-2">
                    {whyMatched.map((d) => (
                      <li key={d.criterionId} className="flex gap-3 border-t border-tc-border py-3 text-[1.05rem] text-tc-ink-2 first:border-t-0">
                        <CriterionIcon status="pass" kind={d.kind} />
                        <span>{d.kind === "exclusion" ? "Doesn't apply: " : ""}{d.plainText}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {trial.what_is_involved ? (
                <p className="mt-4 text-[1.05rem] text-tc-ink-2"><span className="font-bold text-tc-ink">What&apos;s involved: </span>{trial.what_is_involved}</p>
              ) : null}
              <p className="mt-5 rounded-2xl bg-tc-primary-soft px-5 py-4 text-[1rem] font-semibold text-tc-primary-ink">
                The clinic doesn&apos;t know who you are. Nothing is shared unless you approve.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 sm:pt-7">
              <InvitationClient invitationId={invitationId} status={status} clinicName={clinic.name} sharedFields={inv.shared_fields ?? []} />
            </CardContent>
          </Card>
        </div>
      </PageBody>
    </main>
  );
}
