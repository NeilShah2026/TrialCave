"use server";

import { redirect } from "next/navigation";
import { differenceInYears, parseISO } from "date-fns";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordConsent } from "@/lib/consent";
import { runMatchesForPatient } from "@/lib/matching/run";
import { getTown } from "@/lib/geo/towns";

const schema = z.object({
  displayName: z.string().min(1),
  dateOfBirth: z.string().min(1),
  sex: z.enum(["female", "male"]),
  town: z.string().min(1),
  travelRadiusMiles: z.coerce.number().int().positive(),
  preferredLanguage: z.enum(["en", "es", "pt", "ht"]),
  isDonor: z.boolean(),
  allowInvitations: z.boolean(),
  conditionCategories: z.array(z.string()),
  researchConsents: z.array(z.object({ dataType: z.string(), researchType: z.string() })),
});

export type OnboardingInput = z.infer<typeof schema>;

export async function completeOnboarding(input: OnboardingInput): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user || user.role !== "patient") return { ok: false, error: "Not signed in as a patient." };

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please complete all required fields." };
  const data = parsed.data;

  // 18+ check on the server (B0 rule 12).
  const age = differenceInYears(new Date(), parseISO(data.dateOfBirth));
  if (!Number.isFinite(age) || age < 18) {
    return { ok: false, error: "TrialCave is for adults 18 and older." };
  }

  const town = getTown(data.town);
  if (!town) return { ok: false, error: "Please pick a town from the list." };

  const admin = createAdminClient();

  // Guard against duplicate onboarding.
  const { data: existing } = await admin.from("patients").select("id").eq("user_id", user.userId).maybeSingle();
  if (existing) redirect("/app");

  const { data: patient, error } = await admin
    .from("patients")
    .insert({
      user_id: user.userId,
      display_name: data.displayName,
      date_of_birth: data.dateOfBirth,
      sex: data.sex,
      town: data.town,
      lat: town.lat,
      lon: town.lon,
      travel_radius_miles: data.travelRadiusMiles,
      preferred_language: data.preferredLanguage,
      is_donor: data.isDonor,
      is_synthetic: false,
    })
    .select("id")
    .single();
  if (error || !patient) return { ok: false, error: "Could not create your profile. Try again." };
  const patientId = patient.id;

  // Consents.
  await recordConsent(patientId, user.userId, "terms", true);
  await recordConsent(patientId, user.userId, "privacy_notice", true);
  if (data.isDonor) {
    await recordConsent(patientId, user.userId, "donor_agreement", true);
    for (const c of data.researchConsents) {
      await admin.from("research_consents").insert({
        patient_id: patientId,
        data_type: c.dataType,
        research_type: c.researchType,
        allowed: true,
      });
      await recordConsent(patientId, user.userId, "research", true, { data_type: c.dataType, research_type: c.researchType });
    }
  }
  if (data.allowInvitations) {
    await recordConsent(patientId, user.userId, "contact", true);
  }
  await admin.from("contact_preferences").insert({
    patient_id: patientId,
    allow_invitations: data.allowInvitations,
    condition_categories: data.conditionCategories,
  });

  // Initial match (silent).
  await runMatchesForPatient(patientId, { type: "silent" });

  return { ok: true };
}
