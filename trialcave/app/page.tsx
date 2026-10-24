import Link from "next/link";
import { KeyRound, ShieldCheck, Wallet } from "lucide-react";

import { Brand } from "@/components/brand";
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

export default function LandingPage() {
  return (
    <main className="flex-1">
      <header className="mx-auto flex max-w-[1100px] items-center justify-between px-4 py-5">
        <Brand />
        <nav className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/trials">Find a trial</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/how-it-works">How it works</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/login">Log in</Link>
          </Button>
        </nav>
      </header>

      <section className="mx-auto max-w-[1100px] px-4 py-12 sm:py-16">
        <p className="text-sm font-medium text-primary">
          Your data, your choice, your paycheck.
        </p>
        <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Find the trial that fits you.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          Search recruiting studies in Massachusetts, get matched using your own
          health records, and donate data that moves research forward, with a
          paycheck to say thanks.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/trials">Find a trial</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/signup?path=donor">Become a Data Donor</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto max-w-[1100px] px-4 pb-16">
        <div className="grid gap-4 sm:grid-cols-3">
          {promises.map((p) => (
            <Card key={p.title}>
              <CardContent className="pt-6">
                <p.icon className="size-6 text-primary" aria-hidden />
                <h2 className="mt-3 text-lg font-semibold">{p.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{p.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
