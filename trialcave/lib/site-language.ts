import "server-only";

import { cookies } from "next/headers";

import { createAdminClient } from "@/lib/supabase/admin";
import { isLanguage, type Language } from "@/lib/i18n/languages";
import type { SessionUser } from "@/lib/types";

/** The visitor's language: a patient's saved preference, else the header cookie. */
export async function currentLanguage(user: SessionUser | null): Promise<Language> {
  if (user?.role === "patient") {
    const admin = createAdminClient();
    const { data } = await admin.from("patients").select("preferred_language").eq("user_id", user.userId).maybeSingle();
    if (data?.preferred_language && isLanguage(data.preferred_language)) return data.preferred_language;
  }
  const jar = await cookies();
  const c = jar.get("tc_lang")?.value;
  return c && isLanguage(c) ? c : "en";
}
