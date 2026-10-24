"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

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
    <main className="flex-1">
      <section role="alert" className="mx-auto max-w-lg px-4 py-16 text-center">
        <AlertTriangle className="mx-auto size-10 text-tc-warning" aria-hidden />
        <h1 className="mt-4 text-2xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-muted-foreground">
          This page didn&apos;t load. Your data is safe. Try again, or head back home.
        </p>
        {error.digest ? (
          <p className="mt-2 text-xs text-muted-foreground">Reference: {error.digest}</p>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button onClick={() => reset()}>Try again</Button>
          <Button asChild variant="outline">
            <Link href="/">Go home</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
