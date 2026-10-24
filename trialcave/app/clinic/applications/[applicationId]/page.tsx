import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";

import { ClinicNav } from "@/components/clinic-nav";
import { ContactReportView } from "@/components/contact-report";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getMyClinic, getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { buildContactReport } from "@/lib/outreach/report";
import { APPLICATION_STATUS_LABEL } from "@/lib/clinic-labels";
import { ApplicationActions } from "./application-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Application" };

export default async function ApplicationPage({ params }: { params: Promise<{ applicationId: string }> }) {
  const { applicationId } = await params;
  const user = await getSessionUser();
  const clinic = await getMyClinic();
  const admin = createAdminClient();

  const { data: app } = await admin
    .from("applications")
    .select("id, patient_id, trial_id, status, shared_fields, created_at, trials!inner(clinic_id, title)")
    .eq("id", applicationId)
    .maybeSingle();
  const trial = app?.trials as unknown as { clinic_id: string; title: string } | undefined;
  if (!app || trial?.clinic_id !== clinic.id) notFound();

  const withdrawn = app.status === "withdrawn";
  const report = withdrawn ? null : await buildContactReport(app.patient_id, app.trial_id, app.shared_fields ?? [], `A-${app.id.slice(0, 6)}`);
  if (!withdrawn) {
    await logAudit({ actorUserId: user?.userId ?? null, actorRole: "clinic", action: "application.viewed", targetType: "application", targetId: applicationId });
  }

  return (
    <main className="flex-1">
      <ClinicNav email={user?.email ?? ""} clinicName={clinic.name} />
      <div className="mx-auto max-w-[800px] px-4 py-8">
        <Link href={`/clinic/studies/${app.trial_id}?tab=applications`} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft className="size-4" aria-hidden /> {trial?.title ?? "Study"}
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">Application</h1>
          <Badge variant={withdrawn ? "muted" : "secondary"}>{APPLICATION_STATUS_LABEL[app.status] ?? app.status}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">Received {format(new Date(app.created_at), "MMM d, yyyy")}</p>

        {withdrawn || !report ? (
          <Card className="mt-4">
            <CardContent className="pt-6 text-sm text-muted-foreground">
              The participant withdrew this application. Their shared details are no longer available.
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="mt-4">
              <ContactReportView report={report} />
            </div>
            <div className="mt-4">
              <ApplicationActions applicationId={applicationId} current={app.status} />
            </div>
          </>
        )}
      </div>
    </main>
  );
}
