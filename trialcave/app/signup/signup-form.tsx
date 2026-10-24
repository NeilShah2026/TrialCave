"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Building2, CheckCircle2, FlaskConical, HeartPulse } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { signUp, type SignUpState } from "./actions";

type RoleChoice = "patient" | "clinic" | "researcher";

const roleOptions: { value: RoleChoice; title: string; body: string; icon: typeof HeartPulse }[] = [
  {
    value: "patient",
    title: "I'm looking for trials",
    body: "Build a health profile and get matched. Optionally become a Data Donor.",
    icon: HeartPulse,
  },
  {
    value: "clinic",
    title: "I'm a research clinic",
    body: "Reach pre-qualified participants without seeing who they are.",
    icon: Building2,
  },
  {
    value: "researcher",
    title: "I'm a research partner",
    body: "Run approved aggregate analyses inside the Enclave.",
    icon: FlaskConical,
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
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="role" value={role} />
      {initialPath === "donor" ? <input type="hidden" name="path" value="donor" /> : null}

      <fieldset className="space-y-3">
        <legend className="mb-3 text-[1.15rem] font-bold text-tc-ink">I am…</legend>
        {roleOptions.map((o) => {
          const selected = role === o.value;
          const Icon = o.icon;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => setRole(o.value)}
              aria-pressed={selected}
              className={cn(
                "flex min-h-12 w-full items-start gap-4 rounded-2xl border-2 p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-tc-primary-soft",
                selected
                  ? "border-tc-primary bg-tc-primary-soft"
                  : "border-tc-border bg-white hover:border-tc-primary",
              )}
            >
              <span
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-xl",
                  selected ? "bg-tc-primary text-white" : "bg-tc-mist text-tc-primary-ink",
                )}
              >
                <Icon className="size-6" aria-hidden />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[1.05rem] font-bold text-tc-ink">{o.title}</span>
                <span className="text-[0.95rem] text-tc-ink-2">{o.body}</span>
              </span>
              {selected ? (
                <CheckCircle2 className="mt-1 size-6 shrink-0 text-tc-primary" aria-hidden />
              ) : null}
            </button>
          );
        })}
      </fieldset>

      {initialPath === "donor" && role === "patient" ? (
        <p className="rounded-2xl bg-tc-accent px-5 py-4 font-semibold text-tc-ink">
          You&apos;ll be able to turn on Data Donor during setup. It&apos;s always optional.
        </p>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="name">Your name</Label>
        <Input id="name" name="name" autoComplete="name" required />
      </div>

      {role !== "patient" ? (
        <div className="space-y-2">
          <Label htmlFor="org">{role === "clinic" ? "Clinic name" : "Organization name"}</Label>
          <Input id="org" name="org" autoComplete="organization" required />
        </div>
      ) : null}

      {role === "clinic" ? (
        <div className="space-y-2">
          <Label htmlFor="town">Clinic town</Label>
          <select
            id="town"
            name="town"
            defaultValue="Boston"
            aria-describedby="town-help"
            className="min-h-[3.1rem] w-full rounded-[14px] border-2 border-input bg-white px-3 text-[1.05rem] text-tc-ink focus-visible:border-tc-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-tc-primary-soft"
          >
            {towns.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <p id="town-help" className="text-[0.95rem] text-tc-muted">Used to find participants near your site.</p>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="space-y-2">
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
        <p id="password-help" className="text-[0.95rem] text-tc-muted">At least 10 characters.</p>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-tc-mist p-4 text-[1rem] text-tc-ink-2">
        <input
          type="checkbox"
          name="agreed"
          required
          className="mt-0.5 size-5 shrink-0 accent-[var(--tc-primary)]"
        />
        <span>
          I agree to the{" "}
          {AGREEMENT[role].map((a, i) => (
            <span key={a.href}>
              {i > 0 ? " and " : ""}
              <Link
                href={a.href}
                target="_blank"
                className="font-bold text-tc-primary-ink underline underline-offset-4"
              >
                {a.label}
              </Link>
            </span>
          ))}
          .{role === "patient" ? " TrialCave is for adults 18 and older." : ""}
        </span>
      </label>

      {state.error ? (
        <p role="alert" className="rounded-2xl bg-tc-danger-soft px-5 py-4 font-semibold text-tc-danger-ink">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Creating your account…" : "Create account"}
      </Button>
    </form>
  );
}
