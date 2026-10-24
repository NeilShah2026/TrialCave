import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { ClinicNav } from "@/components/clinic-nav";
import { ContactReportView } from "@/components/contact-report";
import { getMyClinic, getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { buildContactReport } from "@/lib/outreach/report";
import { ApplicationActions } from "./application-actions";

export const dynamic = "force-dynamic";

export default async function ApplicationPage({ params }: { params: Promise<{ applicationId: string }> }) {
  const { applicationId } = await params;
  const user = await getSessionUser();
  const clinic = await getMyClinic();
  const admin = createAdminClient();

  const { data: app } = await admin
    .from("applications")
    .select("patient_id, trial_id, status, shared_fields, trials!inner(clinic_id)")
    .eq("id", applicationId)
    .maybeSingle();
  const ownerClinic = (app?.trials as unknown as { clinic_id: string } | undefined)?.clinic_id;
  if (!app || ownerClinic !== clinic.id) notFound();

  const report = await buildContactReport(app.patient_id, app.trial_id, app.shared_fields ?? []);
  await logAudit({ actorUserId: user?.userId ?? null, actorRole: "clinic", action: "application.viewed", targetType: "application", targetId: applicationId });

  return (
    <main className="flex-1">
      <ClinicNav email={user?.email ?? ""} clinicName={clinic.name} />
      <div className="mx-auto max-w-[800px] px-4 py-8">
        <Link href={`/clinic/studies/${app.trial_id}`} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft className="size-4" aria-hidden /> Study
        </Link>
        <h1 className="mt-3 text-2xl font-semibold">Application · {app.status}</h1>
        <div className="mt-4">
          <ContactReportView report={report} />
        </div>
        <div className="mt-4">
          <ApplicationActions applicationId={applicationId} />
        </div>
      </div>
    </main>
  );
}
