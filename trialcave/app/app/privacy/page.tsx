import Link from "next/link";

import { PatientNav } from "@/components/patient-nav";
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
      <div className="mx-auto max-w-[800px] px-4 py-8">
        <h1 className="text-2xl font-semibold">Your data, your control</h1>
        <p className="mt-1 text-muted-foreground">
          Download, correct, delete, or withdraw your data at any time. Read the full{" "}
          <Link href="/legal/privacy" className="text-primary hover:underline">Privacy Notice</Link>.
        </p>

        <div className="mt-6 space-y-4">
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
              <div>
                <h2 className="text-lg font-semibold">Download my data</h2>
                <p className="text-sm text-muted-foreground">A full JSON copy of everything TrialCave holds about you.</p>
              </div>
              <Button asChild variant="outline">
                {/* Plain link: the route returns a file download. */}
                <a href="/api/privacy/export" download>Download</a>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
              <div>
                <h2 className="text-lg font-semibold">Correct my data</h2>
                <p className="text-sm text-muted-foreground">Edit or remove any item in your health profile. Changes are recorded.</p>
              </div>
              <Button asChild variant="outline"><Link href="/app/profile">Open profile</Link></Button>
            </CardContent>
          </Card>

          <ResearchCard withdrawn={p?.research_withdrawn ?? false} isDonor={p?.is_donor ?? false} />

          <DeleteDataCard />
        </div>
      </div>
    </main>
  );
}
