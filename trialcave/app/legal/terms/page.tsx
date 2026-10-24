import { PublicHeader } from "@/components/public-header";
import { CONSENT_VERSION } from "@/lib/env";

export const metadata = { title: "Terms of Service · TrialCave" };

export default function TermsPage() {
  return (
    <main className="flex-1">
      <PublicHeader />
      <div className="mx-auto max-w-[800px] px-4 py-10 text-sm leading-relaxed">
        <h1 className="text-3xl font-semibold">Terms of Service</h1>
        <p className="mt-2 text-muted-foreground">Version {CONSENT_VERSION}. Demo text. Not reviewed by a lawyer.</p>

        <h2 className="mt-6 text-lg font-semibold">Who can use TrialCave</h2>
        <p className="mt-1 text-muted-foreground">TrialCave is for adults 18 and older who live in or near Massachusetts.</p>

        <h2 className="mt-4 text-lg font-semibold">Not medical advice</h2>
        <p className="mt-1 text-muted-foreground">
          TrialCave helps you find and pre-screen for clinical trials. It does not provide medical
          advice, and final eligibility is always decided by the study team.
        </p>

        <h2 className="mt-4 text-lg font-semibold">Acceptable use</h2>
        <p className="mt-1 text-muted-foreground">
          Provide accurate information. Don&apos;t submit data that isn&apos;t yours or that you
          know to be false.
        </p>

        <h2 className="mt-4 text-lg font-semibold">Governing law</h2>
        <p className="mt-1 text-muted-foreground">These terms are governed by the laws of the Commonwealth of Massachusetts.</p>
      </div>
    </main>
  );
}
