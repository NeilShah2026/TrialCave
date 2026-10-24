import Link from "next/link";

import { PatientNav } from "@/components/patient-nav";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getMyPatient, getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { TOWN_NAMES } from "@/lib/geo/towns";
import type { Language } from "@/lib/i18n/languages";
import { SettingsForm, MutedClinics } from "./settings-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await getSessionUser();
  const patient = await getMyPatient();
  const admin = createAdminClient();

  const [{ data: p }, { data: prefs }, { data: muted }] = await Promise.all([
    admin.from("patients").select("preferred_language, town, travel_radius_miles, is_donor").eq("id", patient.id).maybeSingle(),
    admin.from("contact_preferences").select("allow_invitations, condition_categories").eq("patient_id", patient.id).maybeSingle(),
    admin.from("muted_clinics").select("clinic_id, clinics(name)").eq("patient_id", patient.id),
  ]);

  return (
    <main className="flex-1">
      <PatientNav email={user?.email ?? ""} />
      <div className="mx-auto max-w-[800px] px-4 py-8">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-muted-foreground">Language, travel, and how research clinics can reach you.</p>

        <div className="mt-6 space-y-4">
          <SettingsForm
            towns={TOWN_NAMES}
            initial={{
              preferredLanguage: (p?.preferred_language ?? "en") as Language,
              town: p?.town ?? TOWN_NAMES[0],
              travelRadiusMiles: p?.travel_radius_miles ?? 20,
              allowInvitations: prefs?.allow_invitations ?? false,
              conditionCategories: prefs?.condition_categories ?? [],
            }}
          />

          <MutedClinics
            clinics={(muted ?? []).map((m) => ({
              id: m.clinic_id as string,
              name: (m.clinics as unknown as { name: string } | null)?.name ?? "A clinic",
            }))}
          />

          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
              <div>
                <h2 className="text-lg font-semibold">Data Donor</h2>
                <p className="text-sm text-muted-foreground">
                  {p?.is_donor
                    ? "You're a Data Donor. Choose which research your donation supports."
                    : "Optional. Donate de-identified data to research and collect a paycheck."}
                </p>
              </div>
              <Button asChild variant="outline"><Link href="/app/donor">{p?.is_donor ? "Manage donation" : "Learn more"}</Link></Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
              <div>
                <h2 className="text-lg font-semibold">Your data and privacy</h2>
                <p className="text-sm text-muted-foreground">Download, correct, or delete your data, or withdraw from research.</p>
              </div>
              <Button asChild variant="outline"><Link href="/app/privacy">Privacy controls</Link></Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
