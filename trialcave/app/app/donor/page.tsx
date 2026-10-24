import Link from "next/link";
import { format } from "date-fns";
import { HeartHandshake, ShieldCheck, Wallet } from "lucide-react";

import { PatientNav } from "@/components/patient-nav";
import { Card, CardContent } from "@/components/ui/card";
import { getMyPatient, getSessionUser } from "@/lib/auth";
import { loadProfile, loadDonorSummary, formatCents } from "@/lib/patient";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEMO_MODE } from "@/lib/env";
import { ConsentGrid } from "./consent-grid";
import { BecomeDonorForm, StopDonatingButton } from "./donor-client";
import type { ConsentCell } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Data Donor" };

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
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              { icon: ShieldCheck, title: "Your data", text: "De-identified and kept in the Enclave. No one downloads it." },
              { icon: HeartHandshake, title: "Your choice", text: "Pick each kind of data and research. Change it anytime." },
              { icon: Wallet, title: "Your paycheck", text: "Half of each analysis fee goes to the Donors included." },
            ].map((c) => (
              <Card key={c.title}>
                <CardContent className="pt-6">
                  <c.icon className="size-5 text-primary" aria-hidden />
                  <h2 className="mt-2 font-semibold">{c.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{c.text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <BecomeDonorForm />
          <p className="mt-4 text-sm text-muted-foreground">
            How your donation is protected:{" "}
            <Link href="/how-it-works#enclave" className="text-primary hover:underline">How the Enclave works</Link>
          </p>
        </div>
      </main>
    );
  }

  const donor = await loadDonorSummary(patient.id);

  const admin = createAdminClient();
  const [{ data: consents }, { data: contributions }] = await Promise.all([
    admin.from("research_consents").select("data_type, research_type, allowed").eq("patient_id", patient.id),
    admin
      .from("donor_contributions")
      .select("project_id, created_at, research_projects(title, research_type)")
      .eq("patient_id", patient.id)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);
  const consentCells: ConsentCell[] = (consents ?? []).map((c) => ({
    dataType: c.data_type,
    researchType: c.research_type,
    allowed: c.allowed,
  }));

  // Impact: unique projects this Donor's data contributed to (title + type only).
  const projects = new Map<string, { title: string; researchType: string; last: string }>();
  for (const c of contributions ?? []) {
    const proj = c.research_projects as unknown as { title: string; research_type: string } | null;
    if (!proj || projects.has(c.project_id)) continue;
    projects.set(c.project_id, { title: proj.title, researchType: proj.research_type, last: c.created_at });
  }

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
            <p className="mt-2 text-sm">
              Your donation supported {projects.size || donor.studyCount} stud{(projects.size || donor.studyCount) === 1 ? "y" : "ies"}.
            </p>
          </CardContent>
        </Card>

        {projects.size > 0 ? (
          <Card className="mt-4">
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold">Studies your donation powered</h2>
              <ul className="mt-3 divide-y divide-border">
                {[...projects.values()].map((p) => (
                  <li key={p.title} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span>{p.title}</span>
                    <span className="text-muted-foreground">
                      <span className="capitalize">{p.researchType}</span> · {format(new Date(p.last), "MMM d, yyyy")}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        <Card className="mt-4">
          <CardContent className="pt-6">
            <h2 className="text-lg font-semibold">Paycheck history</h2>
            {donor.entries.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                No paychecks yet. You&apos;ll see one here when your donation powers an analysis.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-border">
                {donor.entries.map((e, i) => (
                  <li key={i} className="flex items-center justify-between py-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">{e.description}</span>
                    <span className="ml-3 shrink-0 text-muted-foreground">{format(new Date(e.createdAt), "MMM d")}</span>
                    <span className="ml-3 shrink-0 font-medium">{formatCents(e.amountCents)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="mt-4">
          <ConsentGrid initial={consentCells} />
        </div>

        <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            How your donation is protected:{" "}
            <Link href="/how-it-works#enclave" className="text-primary hover:underline">How the Enclave works</Link>
          </p>
          <StopDonatingButton />
        </div>
      </div>
    </main>
  );
}
