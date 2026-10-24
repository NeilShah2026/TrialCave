"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth";
import { isLanguage } from "@/lib/i18n/languages";

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * Site-wide language picker (header). Stores the choice in a cookie for
 * everyone, and on the patient's profile when a patient is signed in, so trial
 * summaries and questions follow it.
 */
export async function setSiteLanguage(lang: string): Promise<{ ok: boolean }> {
  if (!isLanguage(lang)) return { ok: false };
  const jar = await cookies();
  jar.set("tc_lang", lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: true });
  const user = await getSessionUser().catch(() => null);
  if (user?.role === "patient") {
    const admin = createAdminClient();
    await admin.from("patients").update({ preferred_language: lang }).eq("user_id", user.userId);
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
