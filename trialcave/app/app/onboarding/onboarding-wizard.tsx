"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { completeOnboarding, type OnboardingInput } from "./actions";

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "pt", label: "Português" },
  { value: "ht", label: "Kreyòl ayisyen" },
];
const RADII = [10, 20, 30, 50];
const CONDITION_CATEGORIES = [
  { value: "diabetes_metabolic", label: "Diabetes & metabolic" },
  { value: "cardiology", label: "Heart & cardiology" },
  { value: "kidney", label: "Kidney" },
  { value: "oncology", label: "Cancer" },
  { value: "neurology", label: "Brain & nervous system" },
];
const DATA_TYPES = ["wearables", "labs", "imaging", "history"];
const RESEARCH_TYPES = ["academic", "pharma", "ai", "device"];

export function OnboardingWizard({ towns, defaultName }: { towns: string[]; defaultName: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState(1);
  const totalSteps = 5;

  const [form, setForm] = useState<OnboardingInput>({
    displayName: defaultName,
    dateOfBirth: "",
    sex: "female",
    town: towns[0] ?? "",
    travelRadiusMiles: 25,
    preferredLanguage: "en",
    isDonor: false,
    allowInvitations: false,
    conditionCategories: [],
    researchConsents: [],
  });
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedDonor, setAgreedDonor] = useState(false);

  function set<K extends keyof OnboardingInput>(key: K, value: OnboardingInput[K]) {
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

  function toggleConsent(dataType: string, researchType: string) {
    setForm((f) => {
      const exists = f.researchConsents.some((c) => c.dataType === dataType && c.researchType === researchType);
      return {
        ...f,
        researchConsents: exists
          ? f.researchConsents.filter((c) => !(c.dataType === dataType && c.researchType === researchType))
          : [...f.researchConsents, { dataType, researchType }],
      };
    });
  }
  const hasConsent = (d: string, r: string) => form.researchConsents.some((c) => c.dataType === d && c.researchType === r);

  const canAdvance = (() => {
    if (step === 1) return form.displayName && form.dateOfBirth && form.town;
    if (step === 2) return agreedTerms;
    if (step === 3) return !form.isDonor || agreedDonor;
    return true;
  })();

  function submit() {
    startTransition(async () => {
      const res = await completeOnboarding(form);
      if (!res.ok) {
        toast.error(res.error ?? "Could not finish onboarding.");
        return;
      }
      toast.success("You're all set.");
      router.push("/app");
      router.refresh();
    });
  }

  return (
    <div>
      <Progress value={(step / totalSteps) * 100} className="mb-6" />

      {step === 1 ? (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">The basics</h2>
          <div className="space-y-1.5">
            <Label htmlFor="name">Your name</Label>
            <Input id="name" value={form.displayName} onChange={(e) => set("displayName", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dob">Date of birth</Label>
            <Input id="dob" type="date" value={form.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} />
            <p className="text-xs text-muted-foreground">TrialCave is for adults 18 and older.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Sex assigned at birth</Label>
            <p className="text-xs text-muted-foreground">Trials use this to check eligibility.</p>
            <div className="flex gap-2">
              {(["female", "male"] as const).map((s) => (
                <Button key={s} type="button" variant={form.sex === s ? "default" : "outline"} size="sm" onClick={() => set("sex", s)}>
                  {s === "female" ? "Female" : "Male"}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="town">Town</Label>
            <select id="town" value={form.town} onChange={(e) => set("town", e.target.value)} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm">
              {towns.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>How far would you travel?</Label>
            <div className="flex gap-2">
              {RADII.map((r) => (
                <Button key={r} type="button" variant={form.travelRadiusMiles === r ? "default" : "outline"} size="sm" onClick={() => set("travelRadiusMiles", r)}>
                  {r} mi
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lang">Language</Label>
            <select id="lang" value={form.preferredLanguage} onChange={(e) => set("preferredLanguage", e.target.value as OnboardingInput["preferredLanguage"])} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm">
              {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Terms and privacy</h2>
          <p className="text-sm text-muted-foreground">
            Your health data stays in your vault. Nothing is shared without your approval, and
            TrialCave never sells personal data. You can download, correct, delete, or withdraw
            your data anytime.
          </p>
          <label className="flex items-start gap-3 text-sm">
            <Checkbox checked={agreedTerms} onCheckedChange={(v) => setAgreedTerms(Boolean(v))} />
            <span>I agree to the Terms and have read the Privacy Notice.</span>
          </label>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Become a Data Donor (optional)</h2>
          <p className="text-sm text-muted-foreground">
            Like donating blood plasma: you contribute de-identified data to research, it stays
            inside the Enclave, and you collect a paycheck when your donation powers a study.
            Matching and applying are always free whether or not you donate.
          </p>
          <label className="flex items-center gap-3 text-sm">
            <Checkbox checked={form.isDonor} onCheckedChange={(v) => set("isDonor", Boolean(v))} />
            <span>Yes, I want to be a Data Donor.</span>
          </label>

          {form.isDonor ? (
            <div className="space-y-4 rounded-md border border-border p-4">
              <label className="flex items-start gap-3 text-sm">
                <Checkbox checked={agreedDonor} onCheckedChange={(v) => setAgreedDonor(Boolean(v))} />
                <span>I agree to the Data Donor Agreement. I can withdraw anytime.</span>
              </label>
              <div>
                <p className="text-sm font-medium">Choose what you allow (all off by default)</p>
                <div className="mt-2 overflow-x-auto">
                  <table className="text-xs">
                    <thead>
                      <tr><th className="p-1 text-left">Data</th>{RESEARCH_TYPES.map((r) => <th key={r} className="p-1 capitalize">{r}</th>)}</tr>
                    </thead>
                    <tbody>
                      {DATA_TYPES.map((d) => (
                        <tr key={d}>
                          <td className="p-1 capitalize">{d}</td>
                          {RESEARCH_TYPES.map((r) => (
                            <td key={r} className="p-1 text-center">
                              <Checkbox checked={hasConsent(d, r)} onCheckedChange={() => toggleConsent(d, r)} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {step === 4 ? (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Clinic invitations (optional)</h2>
          <p className="text-sm text-muted-foreground">
            Clinics never see who you are. They can only reach you if you meet their study&apos;s
            criteria, and nothing is shared unless you approve.
          </p>
          <label className="flex items-center gap-3 text-sm">
            <Checkbox checked={form.allowInvitations} onCheckedChange={(v) => set("allowInvitations", Boolean(v))} />
            <span>Allow verified clinics to invite me.</span>
          </label>
          {form.allowInvitations ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Which conditions?</p>
              {CONDITION_CATEGORIES.map((c) => (
                <label key={c.value} className="flex items-center gap-3 text-sm">
                  <Checkbox checked={form.conditionCategories.includes(c.value)} onCheckedChange={() => toggleCategory(c.value)} />
                  <span>{c.label}</span>
                </label>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {step === 5 ? (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Add your records</h2>
          <p className="text-sm text-muted-foreground">
            After this, you can take photos of your paperwork, upload files, or enter results by
            hand. We&apos;ll match you against recruiting trials right away.
          </p>
          <ul className="list-inside list-disc text-sm text-muted-foreground">
            <li>Take photos of visit summaries or lab reports</li>
            <li>Upload a PDF</li>
            <li>Enter lab results by hand</li>
          </ul>
        </div>
      ) : null}

      <div className="mt-8 flex items-center justify-between">
        <Button type="button" variant="ghost" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1 || pending}>
          Back
        </Button>
        {step < totalSteps ? (
          <Button type="button" onClick={() => setStep((s) => s + 1)} disabled={!canAdvance}>
            Continue
          </Button>
        ) : (
          <Button type="button" onClick={submit} disabled={pending}>
            {pending ? "Setting up…" : "Finish"}
          </Button>
        )}
      </div>
    </div>
  );
}
