"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { signUp, type SignUpState } from "./actions";

type RoleChoice = "patient" | "clinic" | "researcher";

const roleOptions: { value: RoleChoice; title: string; body: string }[] = [
  {
    value: "patient",
    title: "I'm looking for trials",
    body: "Build a health profile and get matched. Optionally become a Data Donor.",
  },
  {
    value: "clinic",
    title: "I'm a research clinic",
    body: "Reach pre-qualified participants without seeing who they are.",
  },
  {
    value: "researcher",
    title: "I'm a research partner",
    body: "Run approved aggregate analyses inside the Enclave.",
  },
];

const initialState: SignUpState = { error: null };

export function SignupForm({ initialPath }: { initialPath?: string }) {
  const [role, setRole] = useState<RoleChoice>(
    initialPath === "clinic" ? "clinic" : "patient",
  );
  const [state, formAction, pending] = useActionState(signUp, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="role" value={role} />

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">I am…</legend>
        {roleOptions.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => setRole(o.value)}
            aria-pressed={role === o.value}
            className={cn(
              "flex w-full flex-col items-start rounded-md border px-3 py-2 text-left transition-colors",
              role === o.value
                ? "border-primary bg-tc-primary-soft"
                : "border-border bg-card hover:bg-muted",
            )}
          >
            <span className="text-sm font-medium">{o.title}</span>
            <span className="text-xs text-muted-foreground">{o.body}</span>
          </button>
        ))}
      </fieldset>

      <div className="space-y-1.5">
        <Label htmlFor="name">
          {role === "patient" ? "Your name" : "Your name"}
        </Label>
        <Input id="name" name="name" required />
      </div>

      {role !== "patient" ? (
        <div className="space-y-1.5">
          <Label htmlFor="org">Organization name</Label>
          <Input id="org" name="org" required />
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
        />
        <p className="text-xs text-muted-foreground">At least 10 characters.</p>
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-tc-danger">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creating your account…" : "Create account"}
      </Button>
    </form>
  );
}
