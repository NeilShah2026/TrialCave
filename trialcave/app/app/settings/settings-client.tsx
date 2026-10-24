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
  "min-h-[3.1rem] w-full rounded-[14px] border-2 border-input bg-white px-3 text-[1.05rem] text-tc-ink focus-visible:border-tc-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-tc-primary-soft";
const sectionTitle = "text-[1.45rem] font-extrabold tracking-tight";
const choiceRow =
  "flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-tc-border px-4 py-3 text-[1.05rem] text-tc-ink has-[[data-state=checked]]:border-tc-primary has-[[data-state=checked]]:bg-tc-primary-soft";

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
      <CardContent className="space-y-8 pt-6 sm:pt-7">
        <section className="space-y-2">
          <h2 className={sectionTitle}>Language</h2>
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
          <p className="text-[0.95rem] text-tc-muted">Translations are machine-made. You can always see the original English.</p>
        </section>

        <section className="space-y-4 border-t border-tc-border pt-8">
          <h2 className={sectionTitle}>Location and travel</h2>
          <div className="max-w-xs space-y-2">
            <Label htmlFor="settings-town">Town</Label>
            <select id="settings-town" value={form.town} onChange={(e) => set("town", e.target.value)} className={selectClass}>
              {towns.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <p className="text-[0.95rem] text-tc-muted">We only store your town, never your address.</p>
          </div>
          <fieldset>
            <legend className="text-[1rem] font-bold text-tc-ink">How far would you travel?</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {TRAVEL_RADII.map((r) => (
                <Button
                  key={r}
                  type="button"
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

        <section className="space-y-4 border-t border-tc-border pt-8">
          <h2 className={sectionTitle}>Clinic invitations</h2>
          <p className="text-[1.05rem] text-tc-ink-2">
            Clinics never see who you are. They can only reach you if you meet their study&apos;s
            criteria, and nothing is shared unless you approve.
          </p>
          <label className={choiceRow}>
            <Checkbox checked={form.allowInvitations} onCheckedChange={(v) => set("allowInvitations", Boolean(v))} />
            <span className="font-semibold">Allow verified clinics to invite me</span>
          </label>
          {form.allowInvitations ? (
            <div className="rounded-2xl bg-tc-mist p-5">
            <fieldset className="space-y-2">
              <legend className="mb-2 text-[1.05rem] font-bold text-tc-ink">For which conditions?</legend>
              {CONDITION_CATEGORIES.map((c) => (
                <label key={c.value} className={cn(choiceRow, "bg-white")}>
                  <Checkbox checked={form.conditionCategories.includes(c.value)} onCheckedChange={() => toggleCategory(c.value)} />
                  {c.label}
                </label>
              ))}
              {form.conditionCategories.length === 0 ? (
                <p className="rounded-xl bg-tc-warning-soft px-4 py-3 text-[1rem] font-semibold text-tc-warning-ink">
                  Pick at least one, or clinics won&apos;t be able to invite you.
                </p>
              ) : null}
            </fieldset>
            </div>
          ) : null}
        </section>

        <div className="flex flex-wrap gap-3 border-t border-tc-border pt-6">
          <Button size="lg" onClick={save} disabled={pending || !dirty}>
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
      <CardContent className="pt-6 sm:pt-7">
        <h2 className="text-[1.45rem] font-extrabold tracking-tight">Muted clinics</h2>
        {clinics.length === 0 ? (
          <p className="mt-2 text-[1.05rem] text-tc-ink-2">
            You haven&apos;t muted any clinics. You can mute one from any invitation.
          </p>
        ) : (
          <ul className="mt-3">
            {clinics.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 border-t border-tc-border py-3 text-[1.05rem] first:border-t-0">
                <span className="font-semibold text-tc-ink">{c.name}</span>
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
