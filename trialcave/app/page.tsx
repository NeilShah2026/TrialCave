import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  FileUp,
  KeyRound,
  ListChecks,
  Lock,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";

import { PublicHeader } from "@/components/public-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const promises = [
  {
    icon: KeyRound,
    title: "Your data",
    body: "It's yours. See everything TrialCave holds, download a copy, correct it, or delete it anytime.",
  },
  {
    icon: ShieldCheck,
    title: "Your choice",
    body: "Nothing is used without your consent. You choose which research your donation supports, and you approve every clinic that contacts you.",
  },
  {
    icon: Wallet,
    title: "Your paycheck",
    body: "When your donation powers research, you're compensated, and you can see which kinds of studies it supported.",
  },
];

const recordSteps = [
  { icon: FileUp, title: "Upload a visit summary", body: "A PDF or a few photos of your paperwork. We read it for you." },
  { icon: ListChecks, title: "Confirm each item", body: "Every item shows the line it came from. Nothing is used until you say yes." },
  { icon: Sparkles, title: "See what changed", body: "We re-check every trial and show exactly which matches moved, and why." },
];

const enclaveSteps = [
  "You donate de-identified data",
  "It's protected inside the Enclave",
  "Researchers run approved analyses inside",
  "Only group results leave",
];

export default async function LandingPage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const { deleted } = await searchParams;

  return (
    <main className="flex-1">
      <PublicHeader />

      {deleted ? (
        <p role="status" className="mx-auto mt-4 max-w-[1100px] rounded-md bg-tc-primary-soft px-4 py-2 text-sm">
          Your account was deleted. Thank you for trying TrialCave.
        </p>
      ) : null}

      <section className="mx-auto max-w-[1100px] px-4 py-12 sm:py-16">
        <p className="text-sm font-medium text-primary">Your data, your choice, your paycheck.</p>
        <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Find the trial that fits you.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          Search recruiting studies in Massachusetts, get matched using your own health records,
          and donate data that moves research forward, with a paycheck to say thanks.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/trials">Find a trial</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/signup?path=donor">Become a Data Donor</Link>
          </Button>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Free for patients. Available in English, Español, Português, and Kreyòl ayisyen.
        </p>
      </section>

      <section aria-labelledby="promises" className="mx-auto max-w-[1100px] px-4 pb-12">
        <h2 id="promises" className="sr-only">Our promises</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {promises.map((p) => (
            <Card key={p.title}>
              <CardContent className="pt-6">
                <p.icon className="size-6 text-primary" aria-hidden />
                <h3 className="mt-3 text-lg font-semibold">{p.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{p.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="records" className="border-y border-border bg-card">
        <div className="mx-auto max-w-[1100px] px-4 py-12">
          <h2 id="records" className="text-2xl font-semibold">Your records, checked against every trial</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Most trial finders ask what you remember. TrialCave reads the records you already have
            and checks each trial one requirement at a time, with the record behind every result.
          </p>
          <ol className="mt-6 grid gap-4 sm:grid-cols-3">
            {recordSteps.map((s, i) => (
              <li key={s.title} className="rounded-2xl border border-border p-5">
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-full bg-tc-primary-soft text-sm font-semibold text-primary">{i + 1}</span>
                  <s.icon className="size-5 text-primary" aria-hidden />
                </div>
                <h3 className="mt-3 font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="two-way" className="mx-auto max-w-[1100px] px-4 py-12">
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <Users className="size-6 text-primary" aria-hidden />
            <h2 id="two-way" className="mt-3 text-2xl font-semibold">Two-way, always on your terms</h2>
            <p className="mt-2 text-muted-foreground">
              Research clinics can only reach you if you meet their study&apos;s criteria and you&apos;ve
              turned invitations on. They see a count, never your name. Nothing is shared until you
              approve, and you pick exactly which fields they see.
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              {[
                "Invitations stay anonymous until you approve",
                "IRB-approved invitation text only",
                "Mute any clinic, stop sharing anytime",
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-tc-success" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div id="enclave">
            <Lock className="size-6 text-primary" aria-hidden />
            <h2 className="mt-3 text-2xl font-semibold">How the Enclave works</h2>
            <p className="mt-2 text-muted-foreground">
              Data Donors help research without handing anything over. No one downloads individual
              records, and groups smaller than 10 people are always hidden.
            </p>
            <ol className="mt-4 space-y-2">
              {enclaveSteps.map((s, i) => (
                <li key={s} className="flex items-center gap-3 text-sm">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-tc-accent text-xs font-semibold">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
            <Link href="/how-it-works#enclave" className="mt-4 inline-flex items-center gap-1 text-sm text-primary hover:underline">
              Learn how it&apos;s protected <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="clinics" className="mx-auto max-w-[1100px] px-4 pb-16">
        <Card className="border-tc-secondary/30 bg-tc-secondary-soft">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
            <div className="flex gap-3">
              <Building2 className="mt-1 size-6 shrink-0 text-tc-secondary" aria-hidden />
              <div>
                <h2 id="clinics" className="text-xl font-semibold">For research clinics</h2>
                <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                  Reach pre-qualified participants near your site. See how many people meet your
                  criteria, send IRB-approved invitations, and receive pre-screen reports with only
                  the fields each person shares.
                </p>
              </div>
            </div>
            <Button asChild variant="secondary">
              <Link href="/signup?path=clinic">Reach pre-qualified participants</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
