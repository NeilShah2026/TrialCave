"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { setDonor } from "../settings/actions";
import { ConsentTable } from "./consent-grid";

/** Turn-on flow for non-donors (same as onboarding step 3). */
export function BecomeDonorForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [agreed, setAgreed] = useState(false);
  const [grid, setGrid] = useState<Record<string, boolean>>({});

  function toggle(d: string, r: string) {
    setGrid((g) => ({ ...g, [`${d}:${r}`]: !g[`${d}:${r}`] }));
  }

  function submit() {
    const consents = Object.entries(grid)
      .filter(([, v]) => v)
      .map(([k]) => {
        const [dataType, researchType] = k.split(":");
        return { dataType, researchType };
      });
    startTransition(async () => {
      try {
        const res = await setDonor({ enabled: true, agreed, consents });
        if (!res.ok) {
          toast.error(res.error ?? "Couldn't turn on Data Donor.");
          return;
        }
        toast.success("Welcome, Data Donor. Thank you.");
        router.refresh();
      } catch {
        toast.error("Couldn't turn on Data Donor. Try again.");
      }
    });
  }

  return (
    <Card className="mt-6">
      <CardContent className="space-y-4 pt-6">
        <h2 className="text-lg font-semibold">Turn on Data Donor</h2>
        <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
          <li>Your donated data is de-identified and stays inside the TrialCave Enclave.</li>
          <li>Researchers only ever get group results. Groups under 10 people are hidden.</li>
          <li>Paychecks are thank-you payments, not wages, and may be taxable.</li>
          <li>You can withdraw anytime. Matching and applying stay free either way.</li>
        </ul>
        <label className="flex items-start gap-3 text-sm">
          <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(Boolean(v))} className="mt-0.5" />
          <span>
            I agree to the{" "}
            <Link href="/legal/donor-agreement" target="_blank" className="text-primary hover:underline">
              Data Donor Agreement
            </Link>
            . I can withdraw anytime.
          </span>
        </label>
        <div>
          <p className="text-sm font-medium">Choose what you allow (all off by default)</p>
          <div className="mt-2">
            <ConsentTable grid={grid} onToggle={toggle} disabled={pending} />
          </div>
        </div>
        <Button onClick={submit} disabled={pending || !agreed}>
          {pending ? "Turning on…" : "Become a Data Donor"}
        </Button>
      </CardContent>
    </Card>
  );
}

/** Stop donating: withdraws every research consent for future analyses. */
export function StopDonatingButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function stop() {
    startTransition(async () => {
      try {
        const res = await setDonor({ enabled: false, agreed: false, consents: [] });
        if (!res.ok) {
          toast.error(res.error ?? "Couldn't turn off Data Donor.");
          return;
        }
        toast.success("You've stopped donating. Your data won't be used in any new analysis.");
        router.refresh();
      } catch {
        toast.error("Couldn't turn off Data Donor. Try again.");
      }
    });
  }

  if (!confirming) {
    return (
      <Button variant="outline" onClick={() => setConfirming(true)}>
        Stop donating
      </Button>
    );
  }
  return (
    <div role="alertdialog" aria-label="Stop donating?" className="space-y-2 rounded-md border border-border p-3 text-sm">
      <p>
        Your data won&apos;t be used in any new analysis. Group results already produced can&apos;t be
        recalled. Paychecks you&apos;ve earned are kept.
      </p>
      <div className="flex gap-2">
        <Button size="sm" variant="destructive" onClick={stop} disabled={pending}>
          {pending ? "Stopping…" : "Yes, stop donating"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
