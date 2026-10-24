import { PublicHeader } from "@/components/public-header";
import { CONSENT_VERSION } from "@/lib/env";

export const metadata = { title: "Data Donor Agreement · TrialCave" };

export default function DonorAgreementPage() {
  return (
    <main className="flex-1">
      <PublicHeader />
      <div className="mx-auto max-w-[800px] px-4 py-10 text-sm leading-relaxed">
        <h1 className="text-3xl font-semibold">Data Donor Agreement</h1>
        <p className="mt-2 text-muted-foreground">Version {CONSENT_VERSION}. Demo text. Not reviewed by a lawyer.</p>

        <h2 className="mt-6 text-lg font-semibold">Donating is voluntary</h2>
        <p className="mt-1 text-muted-foreground">
          Becoming a Data Donor is optional. Finding trials, matching, and applying are always
          free whether or not you donate.
        </p>

        <h2 className="mt-4 text-lg font-semibold">What you donate</h2>
        <p className="mt-1 text-muted-foreground">
          You choose which data types (wearables, labs, imaging, history) and which kinds of
          research (academic, pharma, AI, device) your donation supports. All off by default.
        </p>

        <h2 className="mt-4 text-lg font-semibold">How the Enclave protects you</h2>
        <p className="mt-1 text-muted-foreground">
          Your de-identified data stays inside the Enclave. Researchers only ever receive
          aggregate results, and any group smaller than 10 people is hidden. No one downloads
          individual records.
        </p>

        <h2 className="mt-4 text-lg font-semibold">Your paycheck</h2>
        <p className="mt-1 text-muted-foreground">
          Donor paychecks are a thank-you payment, not wages, and may be taxable. Only data with
          real provenance (connected devices, documents on file) earns money.
        </p>

        <h2 className="mt-4 text-lg font-semibold">Withdrawal</h2>
        <p className="mt-1 text-muted-foreground">
          You can withdraw at any time. Your data won&apos;t be used in any new analysis. Group
          results already produced can&apos;t be recalled. There&apos;s a small residual
          re-identification risk with any de-identified data, which we work to minimize.
        </p>
      </div>
    </main>
  );
}
