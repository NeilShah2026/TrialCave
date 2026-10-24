"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";

/**
 * Error state for every route (B0 rule 6). Shows a friendly message and a retry
 * button. Never shows stack traces or patient data.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Ids only; never log patient data.
    console.error("Route error", error.digest ?? "");
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center bg-tc-mist px-[clamp(16px,4vw,72px)] py-[clamp(32px,8vh,96px)]">
      <Brand className="mb-8" />
      <section
        role="alert"
        className="w-full max-w-[560px] rounded-[24px] bg-white p-8 text-center shadow-card sm:p-10"
      >
        <span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-tc-warning-soft text-tc-warning-ink">
          <AlertTriangle className="size-8" aria-hidden />
        </span>
        <h1 className="mt-6 text-[clamp(1.8rem,3vw,2.4rem)] font-extrabold tracking-[-0.02em]">
          Something went wrong
        </h1>
        <p className="mt-3 text-[1.1rem] text-tc-ink-2">
          This page didn&apos;t load. Your data is safe. Try again, or head back home.
        </p>
        {error.digest ? (
          <p className="mt-3 text-[0.95rem] text-tc-muted">Reference: {error.digest}</p>
        ) : null}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button size="lg" onClick={() => reset()}>Try again</Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/">Go home</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
