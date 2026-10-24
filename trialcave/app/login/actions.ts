"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEMO_MODE, hasSupabase } from "@/lib/env";
import { ROLE_HOME, type Role } from "@/lib/types";

export type AuthState = { error: string | null };

async function resolveRoleHome(userId: string): Promise<string> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  const role = (data?.role as Role | undefined) ?? "patient";
  return ROLE_HOME[role];
}

/**
 * Standard email + password sign-in (B6.2).
 */
export async function signIn(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  if (!hasSupabase()) {
    return { error: "Supabase isn't configured in this environment yet." };
  }
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.user) {
    return { error: "We couldn't sign you in. Check your email and password." };
  }

  redirect(await resolveRoleHome(data.user.id));
}

/**
 * Demo sign-in (B6.2): signs in with DEMO_PASSWORD on the server so the
 * password never reaches the browser, then redirects by role.
 */
export async function demoSignIn(email: string): Promise<void> {
  if (!DEMO_MODE) throw new Error("Demo sign-in is disabled.");
  if (!hasSupabase()) {
    throw new Error("Supabase isn't configured in this environment yet.");
  }
  const password = process.env.DEMO_PASSWORD ?? "";
  if (!password) throw new Error("DEMO_PASSWORD is not set.");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.user) {
    throw new Error(`Demo account ${email} isn't available. Seed the demo first.`);
  }

  redirect(await resolveRoleHome(data.user.id));
}
