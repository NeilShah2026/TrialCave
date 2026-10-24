import { PublicHeader } from "@/components/public-header";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "How it works · TrialCave" };

const PROMISES = [
  { title: "Your data", body: "See everything TrialCave holds, download a copy, correct it, or delete it anytime." },
  { title: "Your choice", body: "Nothing is used without your consent. You choose which research your donation supports, and you approve every clinic that contacts you." },
  { title: "Your paycheck", body: "When your donation powers research, you're compensated, and you can see which kinds of studies it supported." },
];

const NEVER = [
  "Never sell or hand over your data",
  "Never let clinics browse profiles",
  "Never show a clinic who declined",
  "Never collect precise location or genetic data",
  "Never pay for radiation scans",
  "Never decide trial eligibility — the study team does",
];

export default function HowItWorksPage() {
  return (
    <main className="flex-1">
      <PublicHeader />
      <div className="mx-auto max-w-[800px] px-4 py-10">
        <h1 className="text-3xl font-semibold">How TrialCave works</h1>
        <p className="mt-2 text-muted-foreground">Your data, your choice, your paycheck.</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {PROMISES.map((p) => (
            <Card key={p.title}><CardContent className="pt-6">
              <h2 className="font-semibold">{p.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{p.body}</p>
            </CardContent></Card>
          ))}
        </div>

        <section className="mt-10">
          <h2 className="text-xl font-semibold">Your records become your profile</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Take photos of your paperwork, upload a file, or enter results by hand. We read each
            document and show you every item with the exact line it came from. Nothing is used
            until you confirm it. Then we check your profile against recruiting trials, one
            criterion at a time, and explain every result in plain language.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold">Two-way, always on your terms</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Clinics can only reach you if you meet their study&apos;s criteria. They see a count,
            never a name, until you approve — and you pick exactly which fields to share.
          </p>
        </section>

        <section className="mt-8" id="enclave">
          <h2 className="text-xl font-semibold">How the Enclave works</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Data Donors contribute de-identified data to research. It stays inside the Enclave.
            Researchers run approved analyses there and only ever take out aggregate results —
            group averages with small groups hidden. No one downloads individual records, and
            research partners pay for the analysis, not for your data. Donors collect a paycheck
            when their donation powers a study.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Paychecks only ever come from data with real provenance — connected devices and
            documents on file. Typed-in answers help you find trials but never earn money, so
            there&apos;s no reason to fake data.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold">What we never do</h2>
          <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
            {NEVER.map((n) => <li key={n}>{n}</li>)}
          </ul>
        </section>
      </div>
    </main>
  );
}
