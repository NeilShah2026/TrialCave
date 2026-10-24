import { redirect } from "next/navigation";

import { Brand } from "@/components/brand";
import { PageBody, PageHero } from "@/components/page-hero";
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
      <header className="border-b border-tc-border bg-white">
        <div className="mx-auto flex max-w-[1320px] items-center px-[clamp(16px,4vw,72px)] py-4">
          <Brand href="/app" />
        </div>
      </header>
      <PageHero
        kicker="A few quick steps"
        title="Set up your TrialCave profile"
        width="narrow"
      />
      <PageBody width="narrow">
        <Card className="mx-auto max-w-[640px]">
          <CardContent className="pt-6 sm:p-8">
            <OnboardingWizard towns={TOWN_NAMES} defaultName={profile?.full_name ?? ""} donorPath={path === "donor"} />
          </CardContent>
        </Card>
      </PageBody>
    </main>
  );
}
