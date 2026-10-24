import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { ClinicNav } from "@/components/clinic-nav";
import { ContactReportView } from "@/components/contact-report";
import { getMyClinic, getSessionUser, assertClinicOwnsInvitation } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { buildContactReport } from "@/lib/outreach/report";

export const dynamic = "force-dynamic";
export const metadata = { title: "Approved contact" };

export default async function ContactPage({ params }: { params: Promise<{ invitationId: string }> }) {
  const { invitationId } = await params;
  const user = await getSessionUser();
  const clinic = await getMyClinic();
  try {
    await assertClinicOwnsInvitation(clinic.id, invitationId);
  } catch {
    notFound();
  }
  const admin = createAdminClient();

  const { data: inv } = await admin
    .from("invitations")
    .select("patient_id, trial_id, status, shared_fields")
    .eq("id", invitationId)
    .maybeSingle();
  // Only show approved invitations (B14.4.3).
  if (!inv || inv.status !== "approved") notFound();

  const report = await buildContactReport(inv.patient_id, inv.trial_id, inv.shared_fields ?? [], `C-${invitationId.slice(0, 6)}`);
  await logAudit({ actorUserId: user?.userId ?? null, actorRole: "clinic", action: "contact.viewed", targetType: "invitation", targetId: invitationId });

  return (
    <main className="flex-1">
      <ClinicNav email={user?.email ?? ""} clinicName={clinic.name} />
      <div className="mx-auto max-w-[800px] px-4 py-8">
        <Link href={`/clinic/studies/${inv.trial_id}?tab=contacts`} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft className="size-4" aria-hidden /> Study
        </Link>
        <h1 className="mt-3 text-2xl font-semibold">Approved contact</h1>
        <div className="mt-4">
          <ContactReportView report={report} />
        </div>
      </div>
    </main>
  );
}
