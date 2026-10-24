import Link from "next/link";
import { Check } from "lucide-react";

import { SiteHeader } from "@/components/site-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TOWN_NAMES } from "@/lib/geo/towns";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Create an account" };

const REASSURANCES = [
  "Finding trials and applying are always free.",
  "Nothing is shared until you approve it, field by field.",
  "Data Donor is optional. Donors are compensated when their data powers research.",
];

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ path?: string }>;
}) {
  const { path } = await searchParams;

  return (
    <main className="flex-1">
      <SiteHeader />
      <h1 className="sr-only">Create a TrialCave account</h1>

      <div className="grid lg:min-h-[calc(100vh-5rem)] lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <section
          aria-label="About TrialCave"
          className="on-dark relative overflow-hidden bg-tc-night px-[clamp(16px,4vw,72px)] py-8 text-white lg:py-16"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              backgroundImage: "radial-gradient(rgba(95,169,162,.55) 1.2px, transparent 1.4px)",
              backgroundSize: "22px 22px",
            }}
          />
          <div className="relative mx-auto max-w-[34rem] lg:sticky lg:top-24 lg:mr-0">
            <p className="text-[clamp(2rem,4vw,3.4rem)] font-extrabold leading-[1.06] tracking-[-0.025em]">
              Your <span className="text-tc-mint">data.</span> Your{" "}
              <span className="text-tc-mint">choice.</span> Your{" "}
              <span className="text-tc-mint">paycheck.</span>
            </p>
            <p className="mt-3 text-[clamp(1.05rem,1.3vw,1.3rem)] text-tc-night-text">
              TrialCave is for adults 18 and older.
            </p>
            <ul className="mt-8 hidden space-y-4 sm:block">
              {REASSURANCES.map((r) => (
                <li key={r} className="flex items-start gap-3 text-[1.1rem] text-tc-night-text">
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-tc-night-2">
                    <Check className="size-4 text-tc-mint" strokeWidth={3} aria-hidden />
                  </span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <div className="bg-tc-mist px-[clamp(16px,4vw,72px)] py-8 lg:py-16">
          <div className="mx-auto w-full max-w-[480px] lg:ml-0">
            <Card>
              <CardHeader>
                <CardTitle>Create your account</CardTitle>
                <CardDescription>
                  Finding trials and applying are always free. TrialCave is for
                  adults 18 and older.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SignupForm initialPath={path} towns={TOWN_NAMES} />
                <p className="mt-6 text-[1rem] text-tc-ink-2">
                  Already have an account?{" "}
                  <Link href="/login" className="font-bold text-tc-primary-ink underline-offset-4 hover:underline">
                    Log in
                  </Link>
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
