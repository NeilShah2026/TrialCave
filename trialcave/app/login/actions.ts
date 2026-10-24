"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEMO_MODE, hasSupabase } from "@/lib/env";
import { DEMO_ACCOUNTS } from "@/lib/demo/accounts";
import { ROLE_HOME, type Role } from "@/lib/types";

export type AuthState = { error: string | null };

const ROLE_PREFIX: Record<Role, string> = {
  patient: "/app",
  clinic: "/clinic",
  researcher: "/enclave",
  admin: "/admin",
};

async function resolveRole(userId: string): Promise<Role> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  return (data?.role as Role | undefined) ?? "patient";
}

/**
 * Where to send a user after sign-in. Honors `?next=` only when it is a local
 * path inside the user's own area, so it can't be used as an open redirect.
 */
function destination(role: Role, next: string | null | undefined): string {
  const home = ROLE_HOME[role];
  if (!next || !next.startsWith("/") || next.startsWith("//")) return home;
  const prefix = ROLE_PREFIX[role];
  return next === prefix || next.startsWith(`${prefix}/`) ? next : home;
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
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");
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

  redirect(destination(await resolveRole(data.user.id), next));
}

/**
 * Demo sign-in (B6.2): signs in with DEMO_PASSWORD on the server so the
 * password never reaches the browser, then redirects by role. Only the listed
 * demo accounts are accepted. Errors are returned (not thrown) so the button
 * can show them inline.
 */
export async function demoSignIn(email: string, next?: string): Promise<AuthState> {
  if (!DEMO_MODE) return { error: "Demo sign-in is turned off in this environment." };
  if (!hasSupabase()) {
    return { error: "Supabase isn't configured in this environment yet." };
  }
  // DECISION: only allow-listed demo accounts can use the shared demo password.
  if (!DEMO_ACCOUNTS.some((a) => a.email === email)) {
    return { error: "That isn't a demo account." };
  }
  const password = process.env.DEMO_PASSWORD ?? "";
  if (!password) return { error: "DEMO_PASSWORD is not set in .env.local." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.user) {
    return {
      error: `The demo account ${email} isn't available yet. Run "npm run db:seed" to create the demo logins.`,
    };
  }

  redirect(destination(await resolveRole(data.user.id), next));
}
