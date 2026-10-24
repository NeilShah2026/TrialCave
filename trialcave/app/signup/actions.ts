"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSupabase } from "@/lib/env";
import { getTown } from "@/lib/geo/towns";
import { ROLE_HOME, type Role } from "@/lib/types";

export type SignUpState = { error: string | null };

const schema = z
  .object({
    role: z.enum(["patient", "clinic", "researcher"]),
    name: z.string().trim().min(1, "Enter your name.").max(120),
    email: z.string().trim().toLowerCase().email("Enter a valid email."),
    password: z.string().min(10, "Use at least 10 characters.").max(200),
    // Clinic/researcher org name (optional for patient).
    org: z.string().trim().max(160).optional(),
    town: z.string().optional(),
    agreed: z.literal("on", { message: "Please agree to the terms to continue." }),
  })
  .refine((d) => d.role === "patient" || (d.org && d.org.length >= 2), {
    message: "Enter your organization's name.",
    path: ["org"],
  });

/**
 * Creates an account (B15 signUp). Patients go to onboarding (where the 18+
 * check happens on the server); clinics and researchers get an unverified row
 * and land on their home. If any setup step fails, the login is removed so the
 * person can simply try again.
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
    town: formData.get("town") ?? undefined,
    agreed: formData.get("agreed") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details." };
  }
  const { role, name, email, password, org } = parsed.data;
  const town = getTown(parsed.data.town ?? "") ?? getTown("Boston")!;

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
      error: createError?.message?.toLowerCase().includes("already")
        ? "An account with this email already exists. Try logging in."
        : "We couldn't create your account. Try again.",
    };
  }
  const userId = created.user.id;
  const rollback = async (message: string): Promise<SignUpState> => {
    await admin.auth.admin.deleteUser(userId);
    return { error: message };
  };

  const { error: profileError } = await admin.from("profiles").insert({
    id: userId,
    role: role as Role,
    full_name: name,
    email,
  });
  if (profileError) return rollback("We couldn't set up your profile. Try again.");

  if (role === "clinic") {
    const { error } = await admin.from("clinics").insert({
      owner_user_id: userId,
      name: org || name,
      town: town.name,
      lat: town.lat,
      lon: town.lon,
      verified: false,
    });
    if (error) return rollback("We couldn't set up your clinic. Try again.");
  } else if (role === "researcher") {
    const { error } = await admin.from("research_partners").insert({
      user_id: userId,
      org_name: org || name,
      verified: false,
    });
    if (error) return rollback("We couldn't set up your organization. Try again.");
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
    redirect(formData.get("path") === "donor" ? "/app/onboarding?path=donor" : "/app/onboarding");
  }
  redirect(ROLE_HOME[role as Role]);
}
