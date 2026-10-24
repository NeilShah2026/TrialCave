import { PatientNav } from "@/components/patient-nav";
import { getMyPatient, getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProfileTabs, type OverviewFact } from "./profile-tabs";

export const dynamic = "force-dynamic";

function factValue(valueNum: number | null, valueBool: boolean | null, valueText: string | null, unit: string | null): string {
  if (valueBool !== null) return valueBool ? "Yes" : "No";
  if (valueNum !== null) return `${valueNum}${unit ? (unit === "%" ? "%" : ` ${unit}`) : ""}`;
  return valueText ?? "";
}

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const user = await getSessionUser();
  const patient = await getMyPatient();
  const admin = createAdminClient();

  const { data: current } = await admin
    .from("patient_current_facts")
    .select("field, label, value_num, value_bool, value_text, unit, observed_at, source")
    .eq("patient_id", patient.id)
    .order("field");

  const { data: displayOnlyRows } = await admin
    .from("patient_facts")
    .select("label, observed_at, source")
    .eq("patient_id", patient.id)
    .eq("status", "confirmed")
    .is("field", null)
    .order("created_at", { ascending: false })
    .limit(20);

  const overview: OverviewFact[] = (current ?? []).map((f) => ({
    field: f.field,
    label: f.label,
    value: factValue(f.value_num, f.value_bool, f.value_text, f.unit),
    observedAt: f.observed_at,
    source: f.source,
  }));

  const displayOnly: OverviewFact[] = (displayOnlyRows ?? []).map((f) => ({
    field: null,
    label: f.label,
    value: "",
    observedAt: f.observed_at,
    source: f.source,
  }));

  return (
    <main className="flex-1">
      <PatientNav email={user?.email ?? ""} />
      <div className="mx-auto max-w-[800px] px-4 py-8">
        <h1 className="text-2xl font-semibold">Health profile</h1>
        <p className="mt-1 text-muted-foreground">Everything TrialCave holds about you. You control all of it.</p>
        <div className="mt-6">
          <ProfileTabs overview={overview} displayOnly={displayOnly} defaultTab={tab ?? "overview"} />
        </div>
      </div>
    </main>
  );
}
