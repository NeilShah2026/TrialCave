import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ClinicNav } from "@/components/clinic-nav";
import { getMyClinic, getSessionUser } from "@/lib/auth";
import { NewStudyWizard } from "./new-study-wizard";

export const dynamic = "force-dynamic";

export default async function NewStudyPage() {
  const user = await getSessionUser();
  const clinic = await getMyClinic();

  return (
    <main className="flex-1">
      <ClinicNav email={user?.email ?? ""} clinicName={clinic.name} />
      <div className="mx-auto max-w-[800px] px-4 py-8">
        <Link href="/clinic" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft className="size-4" aria-hidden /> Studies
        </Link>
        <h1 className="mt-3 text-2xl font-semibold">New study</h1>
        <div className="mt-6">
          <NewStudyWizard />
        </div>
      </div>
    </main>
  );
}
