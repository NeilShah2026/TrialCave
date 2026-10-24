import { ClinicNav } from "@/components/clinic-nav";
import { PageBody, PageHero } from "@/components/page-hero";
import { getMyClinic, getSessionUser } from "@/lib/auth";
import { NewStudyWizard } from "./new-study-wizard";

export const dynamic = "force-dynamic";
export const metadata = { title: "New study" };

export default async function NewStudyPage() {
  const user = await getSessionUser();
  const clinic = await getMyClinic();

  return (
    <main className="flex-1">
      <ClinicNav email={user?.email ?? ""} clinicName={clinic.name} />
      <PageHero tone="indigo" width="narrow" kicker={clinic.name} title="New study" back={{ href: "/clinic", label: "Studies" }} />
      <PageBody width="narrow">
        <NewStudyWizard clinicName={clinic.name} verified={clinic.verified} />
      </PageBody>
    </main>
  );
}
