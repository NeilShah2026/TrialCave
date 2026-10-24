"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabase } from "@/lib/env";
import { ROLE_HOME, type Role } from "@/lib/types";

export type SignUpState = { error: string | null };

const schema = z.object({
  role: z.enum(["patient", "clinic", "researcher"]),
  name: z.string().min(1, "Enter your name."),
  email: z.string().email("Enter a valid email."),
  password: z.string().min(10, "Use at least 10 characters."),
  // Clinic/researcher org name (optional for patient).
  org: z.string().optional(),
});

/**
 * Creates an account (B15 signUp). Patients go to onboarding; clinics and
 * researchers get an unverified row and land on their home. MFA, verification
 * and the full onboarding live in later phases.
 */
export async function signUp(
  _prev: SignUpState,
  formData: FormData,
): Promise<SignUpState> {
  if (!hasSupabase()) {
    return { error: "Supabase isn't configured in this environment yet." };
  }

  const parsed = schema.safeParse({
    role: formData.get("role"),
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    org: formData.get("org") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details." };
  }
  const { role, name, email, password, org } = parsed.data;

  const admin = createAdminClient();

  // Create the auth user (email confirmation off for the demo, B1).
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (createError || !created.user) {
    return {
      error: createError?.message?.includes("already")
        ? "An account with this email already exists."
        : "We couldn't create your account. Try again.",
    };
  }
  const userId = created.user.id;

  const { error: profileError } = await admin.from("profiles").insert({
    id: userId,
    role: role as Role,
    full_name: name,
    email,
  });
  if (profileError) {
    return { error: "We couldn't set up your profile. Try again." };
  }

  if (role === "clinic") {
    // Unverified clinic row; coordinates default to Boston until set.
    await admin.from("clinics").insert({
      owner_user_id: userId,
      name: org || name,
      town: "Boston",
      lat: 42.3601,
      lon: -71.0589,
      verified: false,
    });
  } else if (role === "researcher") {
    await admin.from("research_partners").insert({
      user_id: userId,
      org_name: org || name,
      verified: false,
    });
  }

  // Sign the new user in.
  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) {
    redirect("/login");
  }

  if (role === "patient") {
    redirect("/app/onboarding");
  }
  redirect(ROLE_HOME[role as Role]);
}
