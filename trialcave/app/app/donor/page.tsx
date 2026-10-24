import Link from "next/link";
import { format } from "date-fns";
import { HeartHandshake, ShieldCheck, Wallet } from "lucide-react";

import { PatientNav } from "@/components/patient-nav";
import { PageBody, PageHero } from "@/components/page-hero";
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
        <PageHero
          kicker="Data Donor"
          title="Become a Data Donor"
          lede="Like donating blood plasma: you contribute de-identified data to research, it stays inside the Enclave, and you collect a paycheck when your donation powers a study. Matching and applying stay free whether or not you donate."
          width="narrow"
        />
        <PageBody width="narrow">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { icon: ShieldCheck, title: "Your data", text: "De-identified and kept in the Enclave. No one downloads it." },
              { icon: HeartHandshake, title: "Your choice", text: "Pick each kind of data and research. Change it anytime." },
              { icon: Wallet, title: "Your paycheck", text: "Half of each analysis fee goes to the Donors included." },
            ].map((c) => (
              <Card key={c.title}>
                <CardContent className="pt-6">
                  <span className="flex size-11 items-center justify-center rounded-2xl bg-tc-primary-soft text-tc-primary-ink">
                    <c.icon className="size-5" aria-hidden />
                  </span>
                  <h2 className="mt-3 text-[1.15rem] font-bold">{c.title}</h2>
                  <p className="mt-1 text-[1rem] text-tc-ink-2">{c.text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <BecomeDonorForm />
          <p className="mt-6 text-[1rem] text-tc-ink-2">
            How your donation is protected:{" "}
            <Link href="/how-it-works#enclave" className="font-bold text-tc-primary-ink hover:underline">How the Enclave works</Link>
          </p>
        </PageBody>
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
      <PageHero kicker="Data Donor" title="Your Data Donor paycheck" width="narrow">
        <div className="rounded-[24px] border border-tc-night-line bg-tc-night-2 p-6">
          <p className="text-[clamp(2.2rem,5vw,3rem)] font-extrabold leading-none text-tc-mint">{formatCents(donor.totalCents)}</p>
          <p className="mt-3 text-[1.05rem] text-tc-night-text">
            {formatCents(donor.donationCents)} from donations · {formatCents(donor.researchCents)} from research your data powered
          </p>
          {DEMO_MODE ? <p className="mt-1 text-[0.95rem] text-tc-night-text">Demo amounts.</p> : null}
          <p className="mt-3 text-[1.05rem] font-semibold text-white">
            Your donation supported {projects.size || donor.studyCount} stud{(projects.size || donor.studyCount) === 1 ? "y" : "ies"}.
          </p>
        </div>
      </PageHero>
      <PageBody width="narrow">
        <div className="space-y-6">
          {projects.size > 0 ? (
            <Card>
              <CardContent className="pt-6 sm:pt-7">
                <h2 className="text-[1.45rem] font-extrabold tracking-tight">Studies your donation powered</h2>
                <ul className="mt-3">
                  {[...projects.values()].map((p) => (
                    <li key={p.title} className="flex flex-wrap items-center justify-between gap-2 border-t border-tc-border py-3 text-[1.05rem] first:border-t-0">
                      <span className="font-semibold text-tc-ink">{p.title}</span>
                      <span className="text-[0.95rem] text-tc-muted">
                        <span className="capitalize">{p.researchType}</span> · {format(new Date(p.last), "MMM d, yyyy")}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardContent className="pt-6 sm:pt-7">
              <h2 className="text-[1.45rem] font-extrabold tracking-tight">Paycheck history</h2>
              {donor.entries.length === 0 ? (
                <p className="mt-3 rounded-2xl bg-tc-mist px-5 py-4 text-[1rem] text-tc-ink-2">
                  No paychecks yet. You&apos;ll see one here when your donation powers an analysis.
                </p>
              ) : (
                <ul className="mt-3">
                  {donor.entries.map((e, i) => (
                    <li key={i} className="flex items-center justify-between border-t border-tc-border py-3 text-[1.05rem] first:border-t-0">
                      <span className="min-w-0 flex-1 truncate text-tc-ink">{e.description}</span>
                      <span className="ml-3 shrink-0 text-[0.95rem] text-tc-muted">{format(new Date(e.createdAt), "MMM d")}</span>
                      <span className="ml-4 shrink-0 font-extrabold text-tc-ink">{formatCents(e.amountCents)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <ConsentGrid initial={consentCells} />

          <div className="flex flex-wrap items-start justify-between gap-4">
            <p className="text-[1rem] text-tc-ink-2">
              How your donation is protected:{" "}
              <Link href="/how-it-works#enclave" className="font-bold text-tc-primary-ink hover:underline">How the Enclave works</Link>
            </p>
            <StopDonatingButton />
          </div>
        </div>
      </PageBody>
    </main>
  );
}
