import Link from "next/link";
import { Download, PencilLine } from "lucide-react";

import { PatientNav } from "@/components/patient-nav";
import { PageBody, PageHero } from "@/components/page-hero";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getMyPatient, getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { DeleteDataCard, ResearchCard } from "./privacy-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Privacy controls" };

export default async function PrivacyPage() {
  const user = await getSessionUser();
  const patient = await getMyPatient();
  const admin = createAdminClient();
  const { data: p } = await admin.from("patients").select("research_withdrawn, is_donor").eq("id", patient.id).maybeSingle();

  return (
    <main className="flex-1">
      <PatientNav email={user?.email ?? ""} />
      <PageHero
        kicker="Privacy controls"
        title="Your data, your control"
        width="narrow"
        lede={
          <>
            Download, correct, delete, or withdraw your data at any time. Read the full{" "}
            <Link href="/legal/privacy" className="font-bold text-tc-mint underline-offset-4 hover:underline">Privacy Notice</Link>.
          </>
        }
      />
      <PageBody width="narrow">
        <div className="space-y-6">
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6 sm:pt-7">
              <div className="flex items-start gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-tc-primary-soft text-tc-primary-ink">
                  <Download className="size-5" aria-hidden />
                </span>
                <div>
                  <h2 className="text-[1.15rem] font-bold">Download my data</h2>
                  <p className="text-[1rem] text-tc-ink-2">A full JSON copy of everything TrialCave holds about you.</p>
                </div>
              </div>
              <Button asChild variant="outline">
                {/* Plain link: the route returns a file download. */}
                <a href="/api/privacy/export" download>Download</a>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6 sm:pt-7">
              <div className="flex items-start gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-tc-primary-soft text-tc-primary-ink">
                  <PencilLine className="size-5" aria-hidden />
                </span>
                <div>
                  <h2 className="text-[1.15rem] font-bold">Correct my data</h2>
                  <p className="text-[1rem] text-tc-ink-2">Edit or remove any item in your health profile. Changes are recorded.</p>
                </div>
              </div>
              <Button asChild variant="outline"><Link href="/app/profile">Open profile</Link></Button>
            </CardContent>
          </Card>

          <ResearchCard withdrawn={p?.research_withdrawn ?? false} isDonor={p?.is_donor ?? false} />

          <DeleteDataCard />
        </div>
      </PageBody>
    </main>
  );
}
