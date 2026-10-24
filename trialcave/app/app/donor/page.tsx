import Link from "next/link";
import { format } from "date-fns";

import { PatientNav } from "@/components/patient-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getMyPatient, getSessionUser } from "@/lib/auth";
import { loadProfile, loadDonorSummary, formatCents } from "@/lib/patient";
import { DEMO_MODE } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function DonorPage() {
  const user = await getSessionUser();
  const patient = await getMyPatient();
  const profile = await loadProfile(patient.id);

  if (!profile?.isDonor) {
    return (
      <main className="flex-1">
        <PatientNav email={user?.email ?? ""} />
        <div className="mx-auto max-w-[800px] px-4 py-8">
          <h1 className="text-2xl font-semibold">Become a Data Donor</h1>
          <p className="mt-2 text-muted-foreground">
            Like donating blood plasma: you contribute de-identified data to research, it stays
            inside the Enclave, and you collect a paycheck when your donation powers a study.
            Matching and applying stay free whether or not you donate.
          </p>
          <Button asChild className="mt-4"><Link href="/app/profile">Manage in settings</Link></Button>
        </div>
      </main>
    );
  }

  const donor = await loadDonorSummary(patient.id);

  return (
    <main className="flex-1">
      <PatientNav email={user?.email ?? ""} />
      <div className="mx-auto max-w-[800px] px-4 py-8">
        <h1 className="text-2xl font-semibold">Your Data Donor paycheck</h1>

        <Card className="mt-4 border-tc-accent bg-tc-accent/30">
          <CardContent className="pt-6">
            <p className="text-3xl font-semibold">{formatCents(donor.totalCents)}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatCents(donor.donationCents)} from donations · {formatCents(donor.researchCents)} from research your data powered
            </p>
            {DEMO_MODE ? <p className="mt-1 text-xs text-muted-foreground">Demo amounts.</p> : null}
            <p className="mt-2 text-sm">Your donation supported {donor.studyCount} studies.</p>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardContent className="pt-6">
            <h2 className="text-lg font-semibold">Paycheck history</h2>
            <ul className="mt-3 divide-y divide-border">
              {donor.entries.map((e, i) => (
                <li key={i} className="flex items-center justify-between py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{e.description}</span>
                  <span className="ml-3 shrink-0 text-muted-foreground">{format(new Date(e.createdAt), "MMM d")}</span>
                  <span className="ml-3 shrink-0 font-medium">{formatCents(e.amountCents)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <p className="mt-4 text-sm text-muted-foreground">
          How your donation is protected:{" "}
          <Link href="/how-it-works" className="text-primary hover:underline">How it works</Link>
        </p>
      </div>
    </main>
  );
}
