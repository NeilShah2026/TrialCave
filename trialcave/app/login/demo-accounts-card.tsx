"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DEMO_ACCOUNTS } from "@/lib/demo/accounts";
import { demoSignIn } from "./actions";

const ROLE_LABEL = {
  patient: "Patient",
  clinic: "Clinic",
  researcher: "Researcher",
  admin: "Admin",
} as const;

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
    <Card>
      <CardHeader>
        <CardTitle>Demo accounts</CardTitle>
        <CardDescription>
          One click signs you in. All people and organizations are fictional.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {error ? (
          <p role="alert" className="rounded-md bg-tc-danger/10 px-3 py-2 text-sm text-tc-danger">
            {error}
          </p>
        ) : null}
        {DEMO_ACCOUNTS.map((a) => (
          <button
            key={a.email}
            type="button"
            onClick={() => handleSignIn(a.email)}
            disabled={pending}
            aria-busy={active === a.email && pending}
            className="flex w-full items-start justify-between gap-3 rounded-md border border-border bg-card px-3 py-2 text-left transition-colors hover:border-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-wait disabled:opacity-60"
          >
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-medium">{a.name}</span>
              <span className="text-xs text-muted-foreground">{a.blurb}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
              {active === a.email && pending ? (
                <>
                  <Loader2 className="size-3 animate-spin" aria-hidden /> Signing in…
                </>
              ) : (
                ROLE_LABEL[a.role]
              )}
            </span>
          </button>
        ))}
        <p className="pt-1 text-xs text-muted-foreground">
          Not working? Seed the demo first (<code>npm run db:seed</code>).
        </p>
      </CardContent>
    </Card>
  );
}
