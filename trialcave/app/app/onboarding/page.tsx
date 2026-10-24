import { redirect } from "next/navigation";

import { Brand } from "@/components/brand";
import { Card, CardContent } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { TOWN_NAMES } from "@/lib/geo/towns";
import { OnboardingWizard } from "./onboarding-wizard";

export const dynamic = "force-dynamic";

export const metadata = { title: "Set up your profile" };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ path?: string }> }) {
  const { path } = await searchParams;
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
            <h1 className="mb-4 text-2xl font-semibold">Set up your TrialCave profile</h1>
            <OnboardingWizard towns={TOWN_NAMES} defaultName={profile?.full_name ?? ""} donorPath={path === "donor"} />
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
