import Link from "next/link";
import { notFound } from "next/navigation";
import { differenceInYears, parseISO } from "date-fns";
import { ArrowLeft } from "lucide-react";

import { PatientNav } from "@/components/patient-nav";
import { getMyPatient, getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadMatches } from "@/lib/patient";
import { getVocabField } from "@/lib/matching/vocabulary";
import { STATUS_LABEL } from "@/lib/match-status";
import { SummaryClient, type SummaryItem } from "./summary-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pre-screen summary" };

function valueOf(num: number | null, bool: boolean | null, text: string | null, unit: string | null): string {
  if (bool !== null) return bool ? "Yes" : "No";
  if (num !== null) return `${Number(num)}${unit ? (unit === "%" ? "%" : ` ${unit}`) : ""}`;
  return text ?? "";
}

/**
 * Printable pre-screen summary (B14.3): the patient chooses what to include,
 * then prints or saves it as a PDF to bring to their doctor or a study team.
 */
export default async function SummaryPage({ params }: { params: Promise<{ trialId: string }> }) {
  const { trialId } = await params;
  const user = await getSessionUser();
  const patient = await getMyPatient();
  const admin = createAdminClient();

  const { data: trial } = await admin
    .from("trials")
    .select("title, nct_id, is_demo, source")
    .eq("id", trialId)
    .maybeSingle();
  if (!trial) notFound();

  const [matches, pRes, factsRes] = await Promise.all([
    loadMatches(patient.id),
    admin.from("patients").select("display_name, date_of_birth, sex, town").eq("id", patient.id).maybeSingle(),
    admin
      .from("patient_current_facts")
      .select("field, label, value_num, value_bool, value_text, unit, observed_at")
      .eq("patient_id", patient.id),
  ]);
  const match = matches.find((m) => m.trialId === trialId);
  const p = pRes.data;
  const names = (p?.display_name ?? "").split(" ");

  const groups: Record<string, SummaryItem[]> = { condition: [], lab: [], medication: [] };
  for (const f of factsRes.data ?? []) {
    const vocab = f.field ? getVocabField(f.field) : undefined;
    if (!vocab || vocab.sensitive) continue;
    if (vocab.category === "condition" && f.value_bool === true) {
      groups.condition.push({ label: f.label, value: "Yes", date: f.observed_at });
    } else if (vocab.category === "lab" || vocab.category === "vital") {
      groups.lab.push({ label: f.label, value: valueOf(f.value_num, f.value_bool, f.value_text, f.unit), date: f.observed_at });
    } else if (vocab.category === "medication" && f.value_bool === true) {
      groups.medication.push({ label: f.label, value: "Taking", date: f.observed_at });
    }
  }

  const age = p?.date_of_birth ? differenceInYears(new Date(), parseISO(p.date_of_birth)) : null;

  return (
    <main className="flex-1">
      <PatientNav email={user?.email ?? ""} />
      <div className="mx-auto max-w-[800px] px-4 py-8 print:max-w-none print:p-0">
        <Link href={`/app/matches/${trialId}`} className="inline-flex items-center gap-1 text-sm text-primary hover:underline print:hidden">
          <ArrowLeft className="size-4" aria-hidden /> Back to the study
        </Link>
        <SummaryClient
          trialTitle={trial.title}
          trialRef={trial.nct_id ?? (trial.is_demo ? "Demo study (fictional)" : "TrialCave clinic study")}
          statusLabel={match ? STATUS_LABEL[match.status] : "Not in your current matches"}
          personal={{
            firstName: names[0] ?? "",
            lastName: names.slice(1).join(" "),
            age: age != null ? String(age) : "",
            sex: p?.sex === "female" ? "Female" : p?.sex === "male" ? "Male" : "",
            town: p?.town ?? "",
          }}
          conditions={groups.condition}
          labs={groups.lab}
          medications={groups.medication}
          criteria={(match?.details ?? [])
            .filter((d) => d.status !== "na")
            .map((d) => ({ id: d.criterionId, kind: d.kind, status: d.status, text: d.plainText, sensitive: Boolean(d.field && getVocabField(d.field)?.sensitive) }))}
        />
      </div>
    </main>
  );
}
