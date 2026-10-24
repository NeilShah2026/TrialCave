"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getMyPatient, getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordConsent } from "@/lib/consent";
import { logAudit } from "@/lib/audit";
import { runMatchesForPatient } from "@/lib/matching/run";
import { getTown } from "@/lib/geo/towns";
import { CONDITION_CATEGORIES, DATA_TYPE_VALUES, RESEARCH_TYPE_VALUES, TRAVEL_RADII } from "@/lib/patient-options";

const CATEGORY_VALUES = CONDITION_CATEGORIES.map((c) => c.value);

const settingsSchema = z.object({
  preferredLanguage: z.enum(["en", "es", "pt", "ht"]),
  town: z.string().min(1),
  travelRadiusMiles: z.number().int().refine((n) => (TRAVEL_RADII as readonly number[]).includes(n)),
  allowInvitations: z.boolean(),
  conditionCategories: z.array(z.string()).transform((xs) => xs.filter((x) => CATEGORY_VALUES.includes(x))),
});

export type SettingsInput = z.input<typeof settingsSchema>;

/** Save language, location/travel, and contact preferences (B14.3 Settings). */
export async function updateSettings(input: SettingsInput): Promise<{ ok: boolean; error?: string; rematched?: boolean }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Please sign in again." };
  const patient = await getMyPatient();
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Some settings weren't valid. Check and try again." };
  const data = parsed.data;
  const town = getTown(data.town);
  if (!town) return { ok: false, error: "Pick a town from the list." };

  const admin = createAdminClient();
  const [{ data: before }, { data: prefsBefore }] = await Promise.all([
    admin.from("patients").select("town, travel_radius_miles").eq("id", patient.id).maybeSingle(),
    admin.from("contact_preferences").select("allow_invitations").eq("patient_id", patient.id).maybeSingle(),
  ]);

  const { error } = await admin
    .from("patients")
    .update({
      preferred_language: data.preferredLanguage,
      town: town.name,
      lat: town.lat,
      lon: town.lon,
      travel_radius_miles: data.travelRadiusMiles,
    })
    .eq("id", patient.id);
  if (error) return { ok: false, error: "Couldn't save your settings. Try again." };

  const { error: prefErr } = await admin.from("contact_preferences").upsert(
    {
      patient_id: patient.id,
      allow_invitations: data.allowInvitations,
      condition_categories: data.allowInvitations ? data.conditionCategories : [],
      updated_at: new Date().toISOString(),
    },
    { onConflict: "patient_id" },
  );
  if (prefErr) return { ok: false, error: "Couldn't save your invitation settings. Try again." };

  if ((prefsBefore?.allow_invitations ?? false) !== data.allowInvitations) {
    await recordConsent(patient.id, user.userId, "contact", data.allowInvitations, { categories: data.conditionCategories });
  }
  await logAudit({ actorUserId: user.userId, actorRole: "patient", action: "settings.updated", targetType: "patient", targetId: patient.id });

  // Location or travel changes affect which trials are in range.
  const locationChanged = before?.town !== town.name || before?.travel_radius_miles !== data.travelRadiusMiles;
  if (locationChanged) {
    await runMatchesForPatient(patient.id, { type: "profile_edit", id: "travel", label: "Your travel settings" });
  }

  revalidatePath("/app", "layout");
  return { ok: true, rematched: locationChanged };
}

/** Unmute a clinic so its invitations show again. */
export async function unmuteClinic(clinicId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Please sign in again." };
  const patient = await getMyPatient();
  if (!z.string().uuid().safeParse(clinicId).success) return { ok: false, error: "Clinic not found." };
  const admin = createAdminClient();
  const { error } = await admin.from("muted_clinics").delete().eq("patient_id", patient.id).eq("clinic_id", clinicId);
  if (error) return { ok: false, error: "Couldn't unmute. Try again." };
  revalidatePath("/app/settings");
  return { ok: true };
}

const donorSchema = z.object({
  enabled: z.boolean(),
  agreed: z.boolean(),
  consents: z
    .array(z.object({ dataType: z.string(), researchType: z.string() }))
    .transform((xs) => xs.filter((c) => DATA_TYPE_VALUES.includes(c.dataType) && RESEARCH_TYPE_VALUES.includes(c.researchType))),
});

/**
 * Turn the Data Donor program on (with the Donor Agreement and an opt-in grid,
 * all off by default) or off. Turning it off withdraws every research consent
 * for future analyses. Matching is unaffected either way (A6.5).
 */
export async function setDonor(input: z.input<typeof donorSchema>): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Please sign in again." };
  const patient = await getMyPatient();
  const parsed = donorSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Something wasn't valid. Try again." };
  const { enabled, agreed, consents } = parsed.data;
  const admin = createAdminClient();

  if (enabled) {
    if (!agreed) return { ok: false, error: "Please agree to the Data Donor Agreement to continue." };
    const { error } = await admin.from("patients").update({ is_donor: true, research_withdrawn: false }).eq("id", patient.id);
    if (error) return { ok: false, error: "Couldn't turn on Data Donor. Try again." };
    await recordConsent(patient.id, user.userId, "donor_agreement", true);
    for (const dt of DATA_TYPE_VALUES) {
      for (const rt of RESEARCH_TYPE_VALUES) {
        const allowed = consents.some((c) => c.dataType === dt && c.researchType === rt);
        await admin.from("research_consents").upsert(
          { patient_id: patient.id, data_type: dt, research_type: rt, allowed, updated_at: new Date().toISOString() },
          { onConflict: "patient_id,data_type,research_type" },
        );
        if (allowed) await recordConsent(patient.id, user.userId, "research", true, { data_type: dt, research_type: rt });
      }
    }
    await logAudit({ actorUserId: user.userId, actorRole: "patient", action: "donor.enabled", targetType: "patient", targetId: patient.id });
  } else {
    const { error } = await admin.from("patients").update({ is_donor: false }).eq("id", patient.id);
    if (error) return { ok: false, error: "Couldn't turn off Data Donor. Try again." };
    await admin.from("research_consents").update({ allowed: false, updated_at: new Date().toISOString() }).eq("patient_id", patient.id);
    await recordConsent(patient.id, user.userId, "donor_agreement", false);
    await logAudit({ actorUserId: user.userId, actorRole: "patient", action: "donor.disabled", targetType: "patient", targetId: patient.id });
  }

  revalidatePath("/app", "layout");
  return { ok: true };
}
