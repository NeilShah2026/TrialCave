"use server";

import { revalidatePath } from "next/cache";
import { format } from "date-fns";

import { getMyPatient, getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { runMatchesForPatient } from "@/lib/matching/run";
import { generateWearableDays } from "@/lib/demo/wearables";
import { CONNECTOR_SOURCES, type ConnectorSource } from "@/lib/patient-options";
import { DEMO_MODE } from "@/lib/env";
import { vocabLabel } from "@/lib/matching/vocabulary";

const WEARABLE_SOURCES = new Set<string>(["apple_health", "google_health_connect", "fitbit", "oura", "whoop"]);

/**
 * Connect a demo device or portal (B14.3 mock connectors). Adds 90 days of
 * sample data the patient can't edit (provenance by design), credits a $10
 * donation paycheck for consenting Donors, and re-matches (trigger connector).
 */
export async function connectSource(source: string): Promise<{ ok: boolean; changeCount: number; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, changeCount: 0, error: "Please sign in again." };
  const patient = await getMyPatient();
  const meta = CONNECTOR_SOURCES.find((s) => s.value === source);
  if (!meta) return { ok: false, changeCount: 0, error: "That source isn't available." };
  if (!DEMO_MODE) return { ok: false, changeCount: 0, error: "Device connections are coming soon." };
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("connected_sources")
    .select("source")
    .eq("patient_id", patient.id)
    .eq("source", source)
    .maybeSingle();
  if (existing) return { ok: true, changeCount: 0 };

  const { error } = await admin.from("connected_sources").insert({ patient_id: patient.id, source, is_demo: true });
  if (error) return { ok: false, changeCount: 0, error: "Couldn't connect. Try again." };

  if (meta.kind === "wearable" || meta.kind === "cgm") {
    const rows = generateWearableDays(`${patient.id}:${source}`, { cgm: meta.kind === "cgm" });
    // Merge into existing days so a watch and a CGM can coexist.
    const { data: current } = await admin.from("wearable_daily").select("*").eq("patient_id", patient.id);
    const byDay = new Map((current ?? []).map((r) => [r.day as string, r]));
    const upserts = rows.map((r) => {
      const prev = byDay.get(r.day) ?? {};
      const merged: Record<string, unknown> = { patient_id: patient.id, day: r.day };
      for (const k of ["steps", "resting_hr", "hrv_ms", "sleep_hours", "avg_glucose_mgdl", "time_in_range_pct"] as const) {
        merged[k] = r[k] ?? (prev as Record<string, unknown>)[k] ?? null;
      }
      return merged;
    });
    await admin.from("wearable_daily").upsert(upserts, { onConflict: "patient_id,day" });
  } else {
    // Patient portal: sample facts only where the field is empty (B14.3).
    const { data: cur } = await admin.from("patient_current_facts").select("field").eq("patient_id", patient.id);
    const have = new Set((cur ?? []).map((c) => c.field as string));
    const today = format(new Date(), "yyyy-MM-dd");
    const portalFacts = [
      { field: "bmi", value_num: 29.4, unit: "kg/m²" },
      { field: "systolic_bp", value_num: 128, unit: "mmHg" },
      { field: "diastolic_bp", value_num: 82, unit: "mmHg" },
    ]
      .filter((f) => !have.has(f.field))
      .map((f) => ({ ...f, patient_id: patient.id, label: vocabLabel(f.field), observed_at: today, source: "portal", status: "confirmed" }));
    if (portalFacts.length) await admin.from("patient_facts").insert(portalFacts);
  }

  // Donation paycheck when the Donor allows this data type for any research.
  const { data: p } = await admin.from("patients").select("is_donor, research_withdrawn").eq("id", patient.id).maybeSingle();
  if (p?.is_donor && !p.research_withdrawn) {
    const dataType = meta.kind === "portal" ? "history" : "wearables";
    const { count } = await admin
      .from("research_consents")
      .select("patient_id", { count: "exact", head: true })
      .eq("patient_id", patient.id)
      .eq("data_type", dataType)
      .eq("allowed", true);
    if ((count ?? 0) > 0) {
      await admin.from("donor_earnings").insert({
        patient_id: patient.id,
        kind: "donation",
        amount_cents: 1000,
        description: `${meta.label} connected, 30 days`,
        status: "accrued",
      });
    }
  }

  await logAudit({ actorUserId: user.userId, actorRole: "patient", action: "source.connected", targetType: "source", targetId: source });
  const diff = await runMatchesForPatient(patient.id, { type: "connector", id: source, label: `${meta.label} connected` });
  revalidatePath("/app", "layout");
  return { ok: true, changeCount: diff.changeCount };
}

/** Disconnect a demo source. Device data is removed when no device remains. */
export async function disconnectSource(source: string): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Please sign in again." };
  const patient = await getMyPatient();
  if (!CONNECTOR_SOURCES.some((s) => s.value === (source as ConnectorSource))) return { ok: false, error: "Unknown source." };
  const admin = createAdminClient();

  await admin.from("connected_sources").delete().eq("patient_id", patient.id).eq("source", source);
  const { data: remaining } = await admin.from("connected_sources").select("source").eq("patient_id", patient.id);
  const left = (remaining ?? []).map((r) => r.source as string);
  if (source === "dexcom") {
    await admin.from("wearable_daily").update({ avg_glucose_mgdl: null, time_in_range_pct: null }).eq("patient_id", patient.id);
  } else if (WEARABLE_SOURCES.has(source) && !left.some((s) => WEARABLE_SOURCES.has(s))) {
    await admin
      .from("wearable_daily")
      .update({ steps: null, resting_hr: null, hrv_ms: null, sleep_hours: null })
      .eq("patient_id", patient.id);
  } else if (source === "patient_portal") {
    await admin.from("patient_facts").update({ status: "rejected" }).eq("patient_id", patient.id).eq("source", "portal");
  }
  if (!left.length) await admin.from("wearable_daily").delete().eq("patient_id", patient.id);

  await runMatchesForPatient(patient.id, { type: "connector", id: source, label: "A device you disconnected" });
  revalidatePath("/app", "layout");
  return { ok: true };
}
