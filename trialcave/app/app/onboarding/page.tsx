import { redirect } from "next/navigation";

import { Brand } from "@/components/brand";
import { Card, CardContent } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { TOWN_NAMES } from "@/lib/geo/towns";
import { OnboardingWizard } from "./onboarding-wizard";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "patient") redirect("/");

  // If they already have a patient row, skip onboarding.
  const admin = createAdminClient();
  const { data: existing } = await admin.from("patients").select("id").eq("user_id", user.userId).maybeSingle();
  if (existing) redirect("/app");

  const { data: profile } = await admin.from("profiles").select("full_name").eq("id", user.userId).maybeSingle();

  return (
    <main className="flex-1">
      <header className="mx-auto flex max-w-[1100px] items-center px-4 py-5">
        <Brand href="/app" />
      </header>
      <section className="mx-auto max-w-lg px-4 py-6">
        <Card>
          <CardContent className="pt-6">
            <OnboardingWizard towns={TOWN_NAMES} defaultName={profile?.full_name ?? ""} />
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
