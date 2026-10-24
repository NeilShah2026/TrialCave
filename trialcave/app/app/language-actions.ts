"use server";

import { revalidatePath } from "next/cache";

import { getMyPatient, getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLanguage } from "@/lib/i18n/languages";

export async function setLanguage(lang: string): Promise<{ ok: boolean }> {
  const user = await getSessionUser();
  const patient = await getMyPatient();
  if (!user || !isLanguage(lang)) return { ok: false };
  const admin = createAdminClient();
  await admin.from("patients").update({ preferred_language: lang }).eq("id", patient.id);
  revalidatePath("/app", "layout");
  return { ok: true };
}
