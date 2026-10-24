"use client";

import { useState, useTransition } from "react";
import { ChevronRight, Loader2 } from "lucide-react";

import { DEMO_ACCOUNTS } from "@/lib/demo/accounts";
import { cn } from "@/lib/utils";
import { demoSignIn } from "./actions";

const ROLE_LABEL = {
  patient: "Patient",
  clinic: "Clinic",
  researcher: "Researcher",
  admin: "Admin",
} as const;

const ROLE_TONE = {
  patient: "bg-tc-primary-soft text-tc-primary-ink",
  clinic: "bg-tc-secondary-soft text-tc-secondary",
  researcher: "bg-tc-night text-tc-mint",
  admin: "bg-tc-accent text-tc-ink",
} as const;

/**
 * One-tap demo sign-in. Every row is a single fixed-height line (short label,
 * never wraps), so the list stays compact at any window size: one column on
 * phones, two on mid-size windows, one beside the form on desktop.
 */
export function DemoAccountsCard({ next }: { next?: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);

  function handleSignIn(email: string) {
    setError(null);
    setActive(email);
    startTransition(async () => {
      // On success the action redirects, so we only get a result back on error.
      const res = await demoSignIn(email, next);
      if (res?.error) {
        setError(res.error);
        setActive(null);
      }
    });
  }

  return (
    <section aria-labelledby="demo-accounts-title" className="w-full min-w-0 rounded-[24px] bg-white p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-1">
        <h2 id="demo-accounts-title" className="text-[1.1rem] font-extrabold tracking-tight">
          Or try a demo account
        </h2>
        <p className="text-[0.85rem] text-tc-muted">Everyone here is fictional.</p>
      </div>

      {error ? (
        <p role="alert" className="mt-3 rounded-2xl bg-tc-danger-soft px-4 py-2.5 text-[0.95rem] font-semibold text-tc-danger-ink">
          {error}
        </p>
      ) : null}

      <ul className="mt-3 grid grid-cols-1 gap-1.5 min-[560px]:grid-cols-2 lg:grid-cols-1">
        {DEMO_ACCOUNTS.map((a) => {
          const busy = active === a.email && pending;
          return (
            <li key={a.email} className="min-w-0">
              <button
                type="button"
                onClick={() => handleSignIn(a.email)}
                disabled={pending}
                aria-busy={busy}
                aria-label={`Sign in as ${a.name} (${ROLE_LABEL[a.role]}). ${a.blurb}`}
                title={`${a.name}. ${a.blurb}`}
                className="group flex h-12 w-full min-w-0 items-center gap-2.5 overflow-hidden rounded-xl border-2 border-transparent bg-tc-mist px-2.5 text-left transition-colors hover:border-tc-primary hover:bg-tc-primary-soft/60 focus-visible:border-tc-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-tc-primary-soft disabled:cursor-wait disabled:opacity-60 [@media(max-height:720px)]:lg:h-11"
              >
                <span
                  aria-hidden
                  className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg text-[0.85rem] font-extrabold", ROLE_TONE[a.role])}
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : a.short.charAt(0)}
                </span>
                <span className="min-w-0 flex-1 truncate whitespace-nowrap text-[0.95rem] font-bold text-tc-ink">
                  {a.short}
                  {a.place ? <span className="font-medium text-tc-muted min-[560px]:max-lg:hidden"> · {a.place}</span> : null}
                </span>
                <span className={cn("shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[0.75rem] font-bold min-[560px]:max-lg:hidden", ROLE_TONE[a.role])}>
                  {busy ? "Signing in…" : ROLE_LABEL[a.role]}
                </span>
                <ChevronRight className="hidden size-4 shrink-0 text-tc-primary-ink transition-transform group-hover:translate-x-0.5 xl:block" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
