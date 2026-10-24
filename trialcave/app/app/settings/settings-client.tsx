"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { LANGUAGES, type Language } from "@/lib/i18n/languages";
import { CONDITION_CATEGORIES, TRAVEL_RADII } from "@/lib/patient-options";
import { cn } from "@/lib/utils";
import { unmuteClinic, updateSettings } from "./actions";

interface SettingsValues {
  preferredLanguage: Language;
  town: string;
  travelRadiusMiles: number;
  allowInvitations: boolean;
  conditionCategories: string[];
}

const selectClass =
  "h-10 w-full rounded-md border border-border bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export function SettingsForm({ towns, initial }: { towns: string[]; initial: SettingsValues }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Older accounts may have a radius that isn't one of the choices: snap to the nearest.
  const [baseline] = useState<SettingsValues>(() => ({
    ...initial,
    conditionCategories: [...initial.conditionCategories].sort(),
    travelRadiusMiles: (TRAVEL_RADII as readonly number[]).includes(initial.travelRadiusMiles)
      ? initial.travelRadiusMiles
      : TRAVEL_RADII.reduce((best, r) => (Math.abs(r - initial.travelRadiusMiles) < Math.abs(best - initial.travelRadiusMiles) ? r : best), TRAVEL_RADII[0]),
  }));
  const [form, setForm] = useState<SettingsValues>(baseline);
  const normalized = (v: SettingsValues) => JSON.stringify({ ...v, conditionCategories: [...v.conditionCategories].sort() });
  // A snapped radius still counts as a change worth saving.
  const dirty = normalized(form) !== normalized(baseline) || baseline.travelRadiusMiles !== initial.travelRadiusMiles;

  function set<K extends keyof SettingsValues>(key: K, value: SettingsValues[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleCategory(cat: string) {
    setForm((f) => ({
      ...f,
      conditionCategories: f.conditionCategories.includes(cat)
        ? f.conditionCategories.filter((c) => c !== cat)
        : [...f.conditionCategories, cat],
    }));
  }

  function save() {
    startTransition(async () => {
      try {
        const res = await updateSettings(form);
        if (!res.ok) {
          toast.error(res.error ?? "Couldn't save.");
          return;
        }
        toast.success(res.rematched ? "Saved. Your matches were re-checked for your new travel range." : "Settings saved.");
        router.refresh();
      } catch {
        toast.error("Couldn't save. Check your connection and try again.");
      }
    });
  }

  return (
    <Card>
      <CardContent className="space-y-6 pt-6">
        <section className="space-y-1.5">
          <h2 className="text-lg font-semibold">Language</h2>
          <Label htmlFor="settings-lang">Show trial summaries and questions in</Label>
          <select
            id="settings-lang"
            value={form.preferredLanguage}
            onChange={(e) => set("preferredLanguage", e.target.value as Language)}
            className={cn(selectClass, "max-w-xs")}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.nativeLabel}</option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">Translations are machine-made. You can always see the original English.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Location and travel</h2>
          <div className="max-w-xs space-y-1.5">
            <Label htmlFor="settings-town">Town</Label>
            <select id="settings-town" value={form.town} onChange={(e) => set("town", e.target.value)} className={selectClass}>
              {towns.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">We only store your town, never your address.</p>
          </div>
          <fieldset>
            <legend className="text-sm font-medium">How far would you travel?</legend>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {TRAVEL_RADII.map((r) => (
                <Button
                  key={r}
                  type="button"
                  size="sm"
                  variant={form.travelRadiusMiles === r ? "default" : "outline"}
                  aria-pressed={form.travelRadiusMiles === r}
                  onClick={() => set("travelRadiusMiles", r)}
                >
                  {r} mi
                </Button>
              ))}
            </div>
          </fieldset>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Clinic invitations</h2>
          <p className="text-sm text-muted-foreground">
            Clinics never see who you are. They can only reach you if you meet their study&apos;s
            criteria, and nothing is shared unless you approve.
          </p>
          <label className="flex items-center gap-3 text-sm">
            <Checkbox checked={form.allowInvitations} onCheckedChange={(v) => set("allowInvitations", Boolean(v))} />
            Allow verified clinics to invite me
          </label>
          {form.allowInvitations ? (
            <fieldset className="space-y-2 pl-7">
              <legend className="text-sm font-medium">For which conditions?</legend>
              {CONDITION_CATEGORIES.map((c) => (
                <label key={c.value} className="flex items-center gap-3 text-sm">
                  <Checkbox checked={form.conditionCategories.includes(c.value)} onCheckedChange={() => toggleCategory(c.value)} />
                  {c.label}
                </label>
              ))}
              {form.conditionCategories.length === 0 ? (
                <p className="text-xs text-tc-warning">Pick at least one, or clinics won&apos;t be able to invite you.</p>
              ) : null}
            </fieldset>
          ) : null}
        </section>

        <div className="flex flex-wrap gap-2">
          <Button onClick={save} disabled={pending || !dirty}>
            {pending ? "Saving…" : "Save settings"}
          </Button>
          {normalized(form) !== normalized(baseline) ? (
            <Button variant="ghost" onClick={() => setForm(baseline)} disabled={pending}>
              Undo changes
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function MutedClinics({ clinics }: { clinics: { id: string; name: string }[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function unmute(id: string, name: string) {
    startTransition(async () => {
      try {
        const res = await unmuteClinic(id);
        if (!res.ok) {
          toast.error(res.error ?? "Couldn't unmute.");
          return;
        }
        toast.success(`You'll see invitations from ${name} again.`);
        router.refresh();
      } catch {
        toast.error("Couldn't unmute. Try again.");
      }
    });
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="text-lg font-semibold">Muted clinics</h2>
        {clinics.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">
            You haven&apos;t muted any clinics. You can mute one from any invitation.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {clinics.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                <span>{c.name}</span>
                <Button size="sm" variant="outline" disabled={pending} onClick={() => unmute(c.id, c.name)}>
                  Unmute
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
