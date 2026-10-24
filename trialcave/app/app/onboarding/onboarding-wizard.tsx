"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
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

const SELECT_CLASS =
  "min-h-[3.1rem] w-full rounded-[14px] border-2 border-input bg-white px-3 text-[1.05rem] text-tc-ink focus-visible:border-tc-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-tc-primary-soft";
const STEP_TITLE = "text-[1.45rem] font-extrabold tracking-tight";
const BODY = "text-[1.05rem] text-tc-ink-2";
const LINK = "font-bold text-tc-primary-ink hover:underline";
const CHOICE_ROW = "flex cursor-pointer items-start gap-3 rounded-2xl border-2 border-tc-border p-4 text-[1.05rem] text-tc-ink has-[[data-state=checked]]:border-tc-primary has-[[data-state=checked]]:bg-tc-primary-soft";

export function OnboardingWizard({ towns, defaultName, donorPath = false }: { towns: string[]; defaultName: string; donorPath?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState(1);
  const totalSteps = 5;

  const [form, setForm] = useState<OnboardingInput>({
    displayName: defaultName,
    dateOfBirth: "",
    sex: "female",
    town: towns[0] ?? "",
    travelRadiusMiles: 20,
    preferredLanguage: "en",
    isDonor: donorPath,
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
      try {
        const res = await completeOnboarding(form);
        if (!res.ok) {
          toast.error(res.error ?? "Could not finish onboarding.");
          return;
        }
        toast.success("You're all set.");
        router.push("/app");
        router.refresh();
      } catch (e) {
        // A duplicate onboarding redirects to /app; let that through.
        if (e && typeof e === "object" && "digest" in e) throw e;
        toast.error("Could not finish onboarding. Try again.");
      }
    });
  }

  return (
    <div>
      <div className="mb-8">
        <p className="mb-2 text-[0.95rem] font-bold text-tc-primary-ink">
          Step {step} of {totalSteps}
        </p>
        <Progress value={(step / totalSteps) * 100} aria-label={`Step ${step} of ${totalSteps}`} />
      </div>

      {step === 1 ? (
        <div className="space-y-5">
          <h2 className={STEP_TITLE}>The basics</h2>
          <div className="space-y-2">
            <Label htmlFor="name">Your name</Label>
            <Input id="name" value={form.displayName} onChange={(e) => set("displayName", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dob">Date of birth</Label>
            <Input id="dob" type="date" min="1900-01-01" value={form.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} />
            <p className="text-[0.95rem] text-tc-muted">TrialCave is for adults 18 and older.</p>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-[1rem] font-bold text-tc-ink">Sex assigned at birth</legend>
            <p className="text-[0.95rem] text-tc-muted">Trials use this to check eligibility.</p>
            <div className="flex flex-wrap gap-2">
              {(["female", "male"] as const).map((s) => (
                <Button key={s} type="button" variant={form.sex === s ? "default" : "outline"} aria-pressed={form.sex === s} onClick={() => set("sex", s)}>
                  {s === "female" ? "Female" : "Male"}
                </Button>
              ))}
            </div>
          </fieldset>
          <div className="space-y-2">
            <Label htmlFor="town">Town</Label>
            <select id="town" value={form.town} onChange={(e) => set("town", e.target.value)} className={SELECT_CLASS}>
              {towns.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-[1rem] font-bold text-tc-ink">How far would you travel?</legend>
            <div className="flex flex-wrap gap-2">
              {RADII.map((r) => (
                <Button key={r} type="button" variant={form.travelRadiusMiles === r ? "default" : "outline"} aria-pressed={form.travelRadiusMiles === r} onClick={() => set("travelRadiusMiles", r)}>
                  {r} mi
                </Button>
              ))}
            </div>
          </fieldset>
          <div className="space-y-2">
            <Label htmlFor="lang">Language</Label>
            <select id="lang" value={form.preferredLanguage} onChange={(e) => set("preferredLanguage", e.target.value as OnboardingInput["preferredLanguage"])} className={SELECT_CLASS}>
              {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-5">
          <h2 className={STEP_TITLE}>Terms and privacy</h2>
          <p className={BODY}>
            Your health data stays in your vault. Nothing is shared without your approval, and
            TrialCave never sells personal data. You can download, correct, delete, or withdraw
            your data anytime.
          </p>
          <label className={CHOICE_ROW}>
            <Checkbox checked={agreedTerms} onCheckedChange={(v) => setAgreedTerms(Boolean(v))} className="mt-0.5" />
            <span>
              I agree to the{" "}
              <Link href="/legal/terms" target="_blank" className={LINK}>Terms</Link>{" "}
              and have read the{" "}
              <Link href="/legal/privacy" target="_blank" className={LINK}>Privacy Notice</Link>.
            </span>
          </label>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-5">
          <h2 className={STEP_TITLE}>Become a Data Donor (optional)</h2>
          <p className={BODY}>
            Like donating blood plasma: you contribute de-identified data to research, it stays
            inside the Enclave, and you collect a paycheck when your donation powers a study.
            Matching and applying are always free whether or not you donate.
          </p>
          <label className={CHOICE_ROW}>
            <Checkbox checked={form.isDonor} onCheckedChange={(v) => set("isDonor", Boolean(v))} className="mt-0.5" />
            <span className="font-semibold">Yes, I want to be a Data Donor.</span>
          </label>

          {form.isDonor ? (
            <div className="space-y-5 rounded-2xl bg-tc-mist p-5">
              <label className="flex items-start gap-3 text-[1.05rem] text-tc-ink">
                <Checkbox checked={agreedDonor} onCheckedChange={(v) => setAgreedDonor(Boolean(v))} className="mt-0.5" />
                <span>
                  I agree to the{" "}
                  <Link href="/legal/donor-agreement" target="_blank" className={LINK}>Data Donor Agreement</Link>.
                  I can withdraw anytime.
                </span>
              </label>
              <div>
                <p className="text-[1.05rem] font-bold text-tc-ink">Choose what you allow (all off by default)</p>
                <div className="mt-3 overflow-x-auto rounded-2xl border-2 border-tc-border bg-white">
                  <table className="w-full text-[1rem] text-tc-ink">
                    <caption className="sr-only">Which research each kind of data may support</caption>
                    <thead>
                      <tr className="bg-tc-mist">
                        <th scope="col" className="px-3 py-2 text-left font-bold">Data</th>
                        {RESEARCH_TYPES.map((r) => <th key={r} scope="col" className="px-3 py-2 font-bold capitalize">{r}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {DATA_TYPES.map((d) => (
                        <tr key={d} className="border-t border-tc-border">
                          <th scope="row" className="px-3 py-2 text-left font-semibold capitalize">{d}</th>
                          {RESEARCH_TYPES.map((r) => (
                            <td key={r} className="px-3 py-2 text-center">
                              <Checkbox checked={hasConsent(d, r)} onCheckedChange={() => toggleConsent(d, r)} aria-label={`Allow ${d} for ${r} research`} />
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
        <div className="space-y-5">
          <h2 className={STEP_TITLE}>Clinic invitations (optional)</h2>
          <p className={BODY}>
            Clinics never see who you are. They can only reach you if you meet their study&apos;s
            criteria, and nothing is shared unless you approve.
          </p>
          <label className={CHOICE_ROW}>
            <Checkbox checked={form.allowInvitations} onCheckedChange={(v) => set("allowInvitations", Boolean(v))} className="mt-0.5" />
            <span className="font-semibold">Allow verified clinics to invite me.</span>
          </label>
          {form.allowInvitations ? (
            <fieldset className="space-y-2">
              <legend className="mb-2 text-[1.05rem] font-bold text-tc-ink">Which conditions?</legend>
              {CONDITION_CATEGORIES.map((c) => (
                <label key={c.value} className={CHOICE_ROW}>
                  <Checkbox checked={form.conditionCategories.includes(c.value)} onCheckedChange={() => toggleCategory(c.value)} className="mt-0.5" />
                  <span>{c.label}</span>
                </label>
              ))}
            </fieldset>
          ) : null}
        </div>
      ) : null}

      {step === 5 ? (
        <div className="space-y-5">
          <h2 className={STEP_TITLE}>Add your records</h2>
          <p className={BODY}>
            After this, you can take photos of your paperwork, upload files, or enter results by
            hand. We&apos;ll match you against recruiting trials right away.
          </p>
          <ul className="space-y-2">
            {["Take photos of visit summaries or lab reports", "Upload a PDF", "Enter lab results by hand"].map((t) => (
              <li key={t} className="rounded-2xl bg-tc-mist px-5 py-3 text-[1.05rem] font-semibold text-tc-ink">{t}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-10 flex items-center justify-between gap-3 border-t border-tc-border pt-6">
        <Button type="button" variant="ghost" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1 || pending}>
          Back
        </Button>
        {step < totalSteps ? (
          <Button type="button" size="lg" onClick={() => setStep((s) => s + 1)} disabled={!canAdvance}>
            Continue
          </Button>
        ) : (
          <Button type="button" size="lg" onClick={submit} disabled={pending}>
            {pending ? "Setting up…" : "Finish"}
          </Button>
        )}
      </div>
    </div>
  );
}
