"use client";

import { useActionState, useState } from "react";
import Link from "next/link";

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

const AGREEMENT: Record<RoleChoice, { href: string; label: string }[]> = {
  patient: [
    { href: "/legal/terms", label: "Terms" },
    { href: "/legal/privacy", label: "Privacy Notice" },
  ],
  clinic: [
    { href: "/legal/terms", label: "Terms" },
    { href: "/legal/clinic-agreement", label: "Clinic Agreement" },
  ],
  researcher: [
    { href: "/legal/terms", label: "Terms" },
    { href: "/legal/research-partner-agreement", label: "Research Partner Agreement" },
  ],
};

const initialState: SignUpState = { error: null };

export function SignupForm({ initialPath, towns }: { initialPath?: string; towns: string[] }) {
  const [role, setRole] = useState<RoleChoice>(
    initialPath === "clinic" ? "clinic" : initialPath === "researcher" ? "researcher" : "patient",
  );
  const [state, formAction, pending] = useActionState(signUp, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="role" value={role} />
      {initialPath === "donor" ? <input type="hidden" name="path" value="donor" /> : null}

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">I am…</legend>
        {roleOptions.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => setRole(o.value)}
            aria-pressed={role === o.value}
            className={cn(
              "flex w-full flex-col items-start rounded-md border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              role === o.value ? "border-primary bg-tc-primary-soft" : "border-border bg-card hover:bg-muted",
            )}
          >
            <span className="text-sm font-medium">{o.title}</span>
            <span className="text-xs text-muted-foreground">{o.body}</span>
          </button>
        ))}
      </fieldset>

      {initialPath === "donor" && role === "patient" ? (
        <p className="rounded-md bg-tc-accent/40 px-3 py-2 text-sm">
          You&apos;ll be able to turn on Data Donor during setup. It&apos;s always optional.
        </p>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="name">Your name</Label>
        <Input id="name" name="name" autoComplete="name" required />
      </div>

      {role !== "patient" ? (
        <div className="space-y-1.5">
          <Label htmlFor="org">{role === "clinic" ? "Clinic name" : "Organization name"}</Label>
          <Input id="org" name="org" autoComplete="organization" required />
        </div>
      ) : null}

      {role === "clinic" ? (
        <div className="space-y-1.5">
          <Label htmlFor="town">Clinic town</Label>
          <select
            id="town"
            name="town"
            defaultValue="Boston"
            className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {towns.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <p className="text-xs text-muted-foreground">Used to find participants near your site.</p>
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
          aria-describedby="password-help"
        />
        <p id="password-help" className="text-xs text-muted-foreground">At least 10 characters.</p>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="agreed" required className="mt-1 size-4 accent-[var(--tc-primary)]" />
        <span>
          I agree to the{" "}
          {AGREEMENT[role].map((a, i) => (
            <span key={a.href}>
              {i > 0 ? " and " : ""}
              <Link href={a.href} target="_blank" className="text-primary hover:underline">{a.label}</Link>
            </span>
          ))}
          .{role === "patient" ? " TrialCave is for adults 18 and older." : ""}
        </span>
      </label>

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
