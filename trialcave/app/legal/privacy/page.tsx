import { PublicHeader } from "@/components/public-header";
import { CONSENT_VERSION } from "@/lib/env";

export const metadata = { title: "Privacy Notice · TrialCave" };

export default function PrivacyNoticePage() {
  return (
    <main className="flex-1">
      <PublicHeader />
      <div className="mx-auto max-w-[800px] px-4 py-10 text-sm leading-relaxed">
        <h1 className="text-3xl font-semibold">Privacy Notice</h1>
        <p className="mt-2 text-muted-foreground">Version {CONSENT_VERSION}. Demo text. Not reviewed by a lawyer.</p>

        <h2 className="mt-6 text-lg font-semibold">What we collect</h2>
        <p className="mt-1 text-muted-foreground">
          Health facts you add from records, labs, connected devices, or by hand; your town and
          travel radius; your language and contact preferences.
        </p>

        <h2 className="mt-4 text-lg font-semibold">What we don&apos;t collect</h2>
        <p className="mt-1 text-muted-foreground">
          Precise location (town only, never GPS), genetic test results, and no Social Security,
          driver&apos;s license, bank, or card numbers.
        </p>

        <h2 className="mt-4 text-lg font-semibold">No sale of personal data</h2>
        <p className="mt-1 text-muted-foreground">
          We never sell your personal data. Clinics only see what you approve. Research partners
          run approved analyses inside the Enclave and only take out aggregate results.
        </p>

        <h2 className="mt-4 text-lg font-semibold">No third-party trackers</h2>
        <p className="mt-1 text-muted-foreground">No analytics pixels, ad SDKs, or session replay on any page.</p>

        <h2 className="mt-4 text-lg font-semibold">Your rights</h2>
        <p className="mt-1 text-muted-foreground">
          Download a copy, correct, delete, or withdraw your data at any time from your Privacy
          settings. We follow strict privacy and security practices and will notify you of a
          breach as required by law.
        </p>

        <h2 className="mt-4 text-lg font-semibold">Retention</h2>
        <p className="mt-1 text-muted-foreground">
          We keep your health data until you delete it or close your account. Consent records and
          payment records are kept as long as required and are disclosed when you delete.
        </p>
      </div>
    </main>
  );
}
