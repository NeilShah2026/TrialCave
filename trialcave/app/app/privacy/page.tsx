import Link from "next/link";

import { PatientNav } from "@/components/patient-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  const user = await getSessionUser();

  return (
    <main className="flex-1">
      <PatientNav email={user?.email ?? ""} />
      <div className="mx-auto max-w-[800px] px-4 py-8">
        <h1 className="text-2xl font-semibold">Your data, your control</h1>
        <p className="mt-1 text-muted-foreground">
          Download, correct, delete, or withdraw your data at any time.
        </p>

        <div className="mt-6 space-y-4">
          <Card>
            <CardContent className="flex items-center justify-between pt-6">
              <div>
                <h2 className="text-lg font-semibold">Download my data</h2>
                <p className="text-sm text-muted-foreground">A full JSON copy of everything TrialCave holds about you.</p>
              </div>
              <Button asChild variant="outline">
                <a href="/api/privacy/export">Download</a>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center justify-between pt-6">
              <div>
                <h2 className="text-lg font-semibold">Correct my data</h2>
                <p className="text-sm text-muted-foreground">Edit any fact from your profile.</p>
              </div>
              <Button asChild variant="outline"><Link href="/app/profile">Open profile</Link></Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold">Delete or withdraw</h2>
              <p className="text-sm text-muted-foreground">
                You can withdraw from research (your data won&apos;t be used in any new analysis) or
                delete your health data. Payment records and consent records are kept as required,
                and we&apos;ll tell you exactly what stays. Full deletion flows arrive in a later build phase.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
