import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";

import { Brand } from "@/components/brand";
import { DEMO_MODE } from "@/lib/env";
import { LoginForm } from "./login-form";
import { DemoAccountsCard } from "./demo-accounts-card";

export const metadata = { title: "Log in" };

const REASSURANCES = [
  "Your vault is private. Clinics never browse profiles.",
  "You approve every field before anything is shared.",
  "Download, correct, or delete your data anytime.",
];

/**
 * Log in: a full-screen page with no site header or footer (see ChromeGate).
 * On desktop it is exactly one screen tall and never scrolls. The night
 * panel carries the demo notice and the medical-advice line that the site
 * footer normally shows (B0 rules 4 and 5).
 */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;

  return (
    <main className="grid min-h-svh flex-1 grid-cols-1 bg-tc-mist lg:h-svh lg:max-h-svh lg:grid-cols-[minmax(300px,0.8fr)_minmax(0,2fr)] lg:overflow-hidden xl:grid-cols-[minmax(380px,0.85fr)_minmax(0,2fr)]">
      {/* Night panel */}
      <section
        aria-label="About TrialCave"
        className="on-dark relative flex flex-col overflow-hidden bg-tc-night px-[clamp(24px,3.2vw,56px)] py-6 text-white min-[560px]:max-lg:py-3.5 lg:py-[clamp(24px,5vh,48px)]"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage: "radial-gradient(rgba(95,169,162,.55) 1.2px, transparent 1.4px)",
            backgroundSize: "22px 22px",
            maskImage: "linear-gradient(160deg, #000 20%, transparent 85%)",
            WebkitMaskImage: "linear-gradient(160deg, #000 20%, transparent 85%)",
          }}
        />
        <div className="relative flex items-center justify-between gap-4">
          <Brand tone="light" />
          <Link href="/" className="inline-flex min-h-11 items-center gap-1.5 rounded-lg text-[0.95rem] font-bold text-tc-mint hover:underline lg:hidden">
            <ArrowLeft className="size-4" aria-hidden /> Home
          </Link>
        </div>

        {/* Mid-size windows get a slim top bar instead, so the page fits without scrolling. */}
        <div className="relative mt-6 min-[560px]:max-lg:hidden lg:my-auto lg:py-6">
          <p className="text-[clamp(2rem,3vw,3.2rem)] font-extrabold leading-[1.04] tracking-[-0.03em]">
            Welcome <span className="text-tc-mint">back.</span>
          </p>
          <p className="mt-3 text-[1.1rem] text-tc-night-text">Your vault is waiting.</p>
          <ul className="mt-7 hidden space-y-4 xl:block [@media(max-height:700px)]:hidden">
            {REASSURANCES.map((r) => (
              <li key={r} className="flex items-start gap-3 text-[1.02rem] text-tc-night-text">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-tc-night-2">
                  <Check className="size-4 text-tc-mint" strokeWidth={3} aria-hidden />
                </span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative hidden space-y-3 lg:block">
          {DEMO_MODE ? (
            <p role="note" className="inline-flex rounded-xl bg-tc-accent px-3.5 py-1.5 text-[0.82rem] font-bold text-tc-ink">
              Demo environment. All patient data is synthetic.
            </p>
          ) : null}
          <p className="max-w-[26rem] text-[0.82rem] leading-relaxed text-[#9fbcb8]">
            TrialCave does not provide medical advice. Final eligibility is always decided by the study team.
          </p>
          <nav aria-label="Legal" className="flex flex-wrap gap-x-4 gap-y-1 text-[0.82rem] font-semibold text-tc-night-text">
            <Link href="/legal/privacy" className="hover:text-white hover:underline">Privacy</Link>
            <Link href="/legal/terms" className="hover:text-white hover:underline">Terms</Link>
            <Link href="/how-it-works" className="hover:text-white hover:underline">How it works</Link>
          </nav>
        </div>
      </section>

      {/* Form side */}
      <div className="flex min-h-0 min-w-0 flex-col px-[clamp(20px,3.5vw,64px)] py-6 min-[560px]:max-lg:py-3 lg:py-[clamp(16px,4vh,40px)]">
        <div className="hidden items-center justify-between gap-4 lg:flex">
          <Link href="/" className="inline-flex min-h-11 items-center gap-1.5 rounded-lg text-[0.98rem] font-bold text-tc-primary-ink hover:underline">
            <ArrowLeft className="size-4" aria-hidden /> Back to home
          </Link>
          <p className="text-[0.98rem] text-tc-ink-2">
            New to TrialCave?{" "}
            <Link href="/signup" className="font-bold text-tc-primary-ink underline-offset-4 hover:underline">
              Create an account
            </Link>
          </p>
        </div>

        <div className="flex min-h-0 flex-1 items-center py-6 min-[560px]:max-lg:py-4 lg:py-4 [@media(max-height:700px)]:lg:py-2">
          <div
            className={
              DEMO_MODE
                ? "mx-auto grid w-full max-w-[1000px] grid-cols-1 items-center gap-x-[clamp(24px,4vw,64px)] gap-y-8 min-[560px]:max-lg:gap-y-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]"
                : "mx-auto w-full max-w-[440px]"
            }
          >
            <div className="w-full max-w-[440px] justify-self-center">
              <h1 className="text-[clamp(1.9rem,2.6vw,2.5rem)] font-extrabold leading-tight tracking-[-0.025em] min-[560px]:max-lg:text-[1.9rem]">
                Log in
              </h1>
              <p className="mt-1.5 text-[1.02rem] text-tc-ink-2">Use the email and password for your account.</p>
              {next ? (
                <p className="mt-4 rounded-2xl bg-tc-primary-soft px-4 py-3 font-semibold text-tc-primary-ink">Please log in to continue.</p>
              ) : null}
              <div className="mt-6 min-[560px]:max-lg:mt-4 [@media(max-height:720px)]:mt-4">
                <LoginForm next={next} />
              </div>
              <p className="mt-5 text-[1rem] text-tc-ink-2 min-[560px]:max-lg:mt-3 lg:hidden">
                New to TrialCave?{" "}
                <Link href="/signup" className="font-bold text-tc-primary-ink underline-offset-4 hover:underline">
                  Create an account
                </Link>
              </p>
            </div>

            {DEMO_MODE ? <DemoAccountsCard next={next} /> : null}
          </div>
        </div>

        {/* Phones: the night panel's footer line moves to the bottom. */}
        <div className="space-y-2 border-t border-tc-border pt-5 text-[0.85rem] text-tc-muted min-[560px]:max-lg:space-y-1 min-[560px]:max-lg:pt-3 lg:hidden">
          <p>
            {DEMO_MODE ? <span className="font-bold text-tc-ink">Demo environment. All patient data is synthetic. </span> : null}
            TrialCave does not provide medical advice. Final eligibility is always decided by the study team.
          </p>
          <nav aria-label="Legal" className="flex gap-4 font-semibold">
            <Link href="/legal/privacy" className="hover:underline">Privacy</Link>
            <Link href="/legal/terms" className="hover:underline">Terms</Link>
            <Link href="/how-it-works" className="hover:underline">How it works</Link>
          </nav>
        </div>
      </div>
    </main>
  );
}
