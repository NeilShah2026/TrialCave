"use server";

import { revalidatePath } from "next/cache";

import { getSessionUser, getMyPatient } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordConsent } from "@/lib/consent";
import { DATA_TYPE_VALUES, RESEARCH_TYPE_VALUES } from "@/lib/patient-options";

export interface ConsentCell {
  dataType: string;
  researchType: string;
  allowed: boolean;
}

/** Save the research consent grid, recording an event per changed cell. */
export async function updateResearchConsents(cells: ConsentCell[]): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Please sign in again." };
  const patient = await getMyPatient();
  const admin = createAdminClient();

  const { data: p } = await admin.from("patients").select("is_donor").eq("id", patient.id).maybeSingle();
  if (!p?.is_donor) return { ok: false, error: "Turn on Data Donor first." };

  const valid = (Array.isArray(cells) ? cells : []).filter(
    (c) => DATA_TYPE_VALUES.includes(c.dataType) && RESEARCH_TYPE_VALUES.includes(c.researchType) && typeof c.allowed === "boolean",
  );

  // Load current state to detect changes.
  const { data: current } = await admin
    .from("research_consents")
    .select("data_type, research_type, allowed")
    .eq("patient_id", patient.id);
  const currentMap = new Map((current ?? []).map((c) => [`${c.data_type}:${c.research_type}`, c.allowed]));

  const now = new Date().toISOString();
  const { error } = await admin.from("research_consents").upsert(
    valid.map((cell) => ({
      patient_id: patient.id,
      data_type: cell.dataType,
      research_type: cell.researchType,
      allowed: cell.allowed,
      updated_at: now,
    })),
    { onConflict: "patient_id,data_type,research_type" },
  );
  if (error) return { ok: false, error: "Couldn't save your choices. Try again." };

  for (const cell of valid) {
    const prev = currentMap.get(`${cell.dataType}:${cell.researchType}`) ?? false;
    if (prev !== cell.allowed) {
      await recordConsent(patient.id, user.userId, "research", cell.allowed, { data_type: cell.dataType, research_type: cell.researchType });
    }
  }

  revalidatePath("/app/donor");
  return { ok: true };
}
