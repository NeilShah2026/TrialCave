"use server";

import { revalidatePath } from "next/cache";

import { getSessionUser, getMyPatient } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordConsent } from "@/lib/consent";

export interface ConsentCell {
  dataType: string;
  researchType: string;
  allowed: boolean;
}

/** Save the research consent grid, recording an event per changed cell. */
export async function updateResearchConsents(cells: ConsentCell[]): Promise<{ ok: boolean }> {
  const user = await getSessionUser();
  const patient = await getMyPatient();
  if (!user) return { ok: false };
  const admin = createAdminClient();

  // Load current state to detect changes.
  const { data: current } = await admin
    .from("research_consents")
    .select("data_type, research_type, allowed")
    .eq("patient_id", patient.id);
  const currentMap = new Map((current ?? []).map((c) => [`${c.data_type}:${c.research_type}`, c.allowed]));

  for (const cell of cells) {
    const key = `${cell.dataType}:${cell.researchType}`;
    const prev = currentMap.get(key);
    await admin.from("research_consents").upsert(
      { patient_id: patient.id, data_type: cell.dataType, research_type: cell.researchType, allowed: cell.allowed, updated_at: new Date().toISOString() },
      { onConflict: "patient_id,data_type,research_type" },
    );
    if (prev !== cell.allowed) {
      await recordConsent(patient.id, user.userId, "research", cell.allowed, { data_type: cell.dataType, research_type: cell.researchType });
    }
  }

  revalidatePath("/app/donor");
  return { ok: true };
}
