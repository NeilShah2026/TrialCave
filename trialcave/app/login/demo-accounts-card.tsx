"use client";

import { useState, useTransition } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DEMO_ACCOUNTS } from "@/lib/demo/accounts";
import { demoSignIn } from "./actions";

export function DemoAccountsCard() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);

  function handleSignIn(email: string) {
    setError(null);
    setActive(email);
    startTransition(async () => {
      try {
        await demoSignIn(email);
      } catch (e) {
        // redirect() throws a control-flow signal that must be rethrown.
        if (
          e &&
          typeof e === "object" &&
          "digest" in e &&
          String((e as { digest: string }).digest).startsWith("NEXT_REDIRECT")
        ) {
          throw e;
        }
        setError(e instanceof Error ? e.message : "Demo sign-in failed.");
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
          <p role="alert" className="text-sm text-tc-danger">
            {error}
          </p>
        ) : null}
        {DEMO_ACCOUNTS.map((a) => (
          <button
            key={a.email}
            type="button"
            onClick={() => handleSignIn(a.email)}
            disabled={pending}
            className="flex w-full flex-col items-start rounded-md border border-border bg-card px-3 py-2 text-left transition-colors hover:bg-muted disabled:opacity-60"
          >
            <span className="text-sm font-medium">{a.name}</span>
            <span className="text-xs text-muted-foreground">{a.blurb}</span>
            {active === a.email && pending ? (
              <span className="mt-1 text-xs text-primary">Signing in…</span>
            ) : null}
          </button>
        ))}
        <p className="pt-1 text-xs text-muted-foreground">
          Seed the demo (<code>npm run db:seed</code>) before using these.
        </p>
      </CardContent>
    </Card>
  );
}
