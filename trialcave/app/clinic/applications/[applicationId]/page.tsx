import { notFound } from "next/navigation";
import { format } from "date-fns";

import { ClinicNav } from "@/components/clinic-nav";
import { ContactReportView } from "@/components/contact-report";
import { PageBody, PageHero } from "@/components/page-hero";
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
      <PageHero
        tone="mist"
        width="narrow"
        back={{ href: `/clinic/studies/${app.trial_id}?tab=applications`, label: trial?.title ?? "Study" }}
        title="Application"
        actions={<Badge variant={withdrawn ? "muted" : "secondary"} className="px-4 py-2 text-[0.95rem]">{APPLICATION_STATUS_LABEL[app.status] ?? app.status}</Badge>}
        lede={`Received ${format(new Date(app.created_at), "MMM d, yyyy")}`}
      />
      <PageBody width="narrow" className="pt-0">
        {withdrawn || !report ? (
          <Card>
            <CardContent className="p-6 text-[1.05rem] text-tc-ink-2 sm:p-8">
              The participant withdrew this application. Their shared details are no longer available.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <ContactReportView report={report} />
            <Card>
              <CardContent className="p-6 sm:p-7">
                <h2 className="mb-4 text-[1.15rem] font-bold">Update status</h2>
                <ApplicationActions applicationId={applicationId} current={app.status} />
              </CardContent>
            </Card>
          </div>
        )}
      </PageBody>
    </main>
  );
}
