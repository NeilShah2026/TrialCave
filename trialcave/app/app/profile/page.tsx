import { PatientNav } from "@/components/patient-nav";
import { PageBody, PageHero } from "@/components/page-hero";
import { getMyPatient, getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVocabField } from "@/lib/matching/vocabulary";
import { ProfileTabs, type OverviewFact, type DeviceSummary } from "./profile-tabs";

export const dynamic = "force-dynamic";
export const metadata = { title: "Health profile" };

const TABS = new Set(["overview", "labs", "history", "devices"]);

function factValue(valueNum: number | null, valueBool: boolean | null, valueText: string | null, unit: string | null): string {
  if (valueBool !== null) return valueBool ? "Yes" : "No";
  if (valueNum !== null) return `${Number(valueNum)}${unit ? (unit === "%" ? "%" : ` ${unit}`) : ""}`;
  return valueText ?? "";
}

function mean(xs: (number | null)[]): number | null {
  const v = xs.filter((x): x is number => x != null);
  return v.length >= 7 ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
}

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const user = await getSessionUser();
  const patient = await getMyPatient();
  const admin = createAdminClient();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const [{ data: current }, { data: displayOnlyRows }, { data: sources }, { data: wearables }] = await Promise.all([
    admin
      .from("patient_current_facts")
      .select("id, field, label, value_num, value_bool, value_text, unit, observed_at, source, document_id")
      .eq("patient_id", patient.id)
      .order("field"),
    admin
      .from("patient_facts")
      .select("id, label, value_text, observed_at, source")
      .eq("patient_id", patient.id)
      .eq("status", "confirmed")
      .is("field", null)
      .order("created_at", { ascending: false })
      .limit(20),
    admin.from("connected_sources").select("source, connected_at").eq("patient_id", patient.id),
    admin
      .from("wearable_daily")
      .select("steps, resting_hr, sleep_hours, time_in_range_pct")
      .eq("patient_id", patient.id)
      .gte("day", cutoff.toISOString().slice(0, 10)),
  ]);

  const overview: OverviewFact[] = (current ?? []).map((f) => {
    const vocab = f.field ? getVocabField(f.field) : undefined;
    return {
      id: f.id,
      field: f.field,
      label: f.label,
      value: factValue(f.value_num, f.value_bool, f.value_text, f.unit),
      valueNum: f.value_num != null ? Number(f.value_num) : null,
      valueBool: f.value_bool,
      type: vocab?.type ?? "text",
      category: vocab?.category ?? "condition",
      observedAt: f.observed_at,
      source: f.source,
      fromDocument: Boolean(f.document_id),
    };
  });

  const displayOnly: OverviewFact[] = (displayOnlyRows ?? []).map((f) => ({
    id: f.id,
    field: null,
    label: f.label,
    value: f.value_text ?? "",
    valueNum: null,
    valueBool: null,
    type: "text",
    category: "condition",
    observedAt: f.observed_at,
    source: f.source,
    fromDocument: false,
  }));

  const devices: DeviceSummary = {
    connected: (sources ?? []).map((s) => s.source as string),
    avgSteps: mean((wearables ?? []).map((w) => w.steps)),
    avgRestingHr: mean((wearables ?? []).map((w) => w.resting_hr)),
    avgSleep: mean((wearables ?? []).map((w) => (w.sleep_hours != null ? Number(w.sleep_hours) : null))),
    avgTimeInRange: mean((wearables ?? []).map((w) => w.time_in_range_pct)),
  };

  const activeTab = tab && TABS.has(tab) ? tab : "overview";

  return (
    <main className="flex-1">
      <PatientNav email={user?.email ?? ""} />
      <PageHero
        title="Health profile"
        lede="Everything TrialCave holds about you. You control all of it."
        width="narrow"
      />
      <PageBody width="narrow">
        <ProfileTabs key={activeTab} overview={overview} displayOnly={displayOnly} devices={devices} defaultTab={activeTab} />
      </PageBody>
    </main>
  );
}
