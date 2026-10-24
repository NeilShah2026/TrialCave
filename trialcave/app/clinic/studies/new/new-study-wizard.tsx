"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { CATEGORY_OPTIONS } from "@/lib/categories";
import { VOCABULARY, getVocabField } from "@/lib/matching/vocabulary";
import { parseProtocol, saveStudy, type DraftCriterion, type StudyDraft } from "../../actions";

const selectClass =
  "h-9 rounded-md border border-border bg-card px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
const textareaClass =
  "w-full rounded-md border border-border bg-card p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

const CHECKABLE_FIELDS = VOCABULARY.filter((v) => !v.derived || v.field === "age");
const OPERATOR_LABEL: Record<string, string> = {
  gte: "at least",
  lte: "at most",
  between: "between",
  eq: "equals",
  present: "has / is yes",
  absent: "does not have / is no",
};

function emptyCriterion(kind: "inclusion" | "exclusion"): DraftCriterion {
  return {
    kind,
    plainText: "",
    category: "other",
    field: null,
    operator: null,
    valueMin: null,
    valueMax: null,
    valueText: null,
    unit: null,
    patientQuestion: null,
  };
}

const STEPS = ["Basics", "Eligibility", "Checklist", "IRB & invitation"];

function numOrNull(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function CriterionEditor({
  c,
  index,
  onChange,
  onRemove,
}: {
  c: DraftCriterion;
  index: number;
  onChange: (patch: Partial<DraftCriterion>) => void;
  onRemove: () => void;
}) {
  const vocab = c.field ? getVocabField(c.field) : undefined;
  const ops = vocab?.type === "bool" ? ["present", "absent"] : vocab?.type === "number" ? ["gte", "lte", "between"] : vocab ? ["eq"] : [];
  const id = `crit-${index}`;

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor={`${id}-kind`}>Type</label>
        <select
          id={`${id}-kind`}
          value={c.kind}
          onChange={(e) => onChange({ kind: e.target.value as DraftCriterion["kind"] })}
          className={selectClass}
        >
          <option value="inclusion">Needed</option>
          <option value="exclusion">Rules out</option>
        </select>
        <label className="sr-only" htmlFor={`${id}-text`}>Criterion text</label>
        <Input
          id={`${id}-text`}
          value={c.plainText}
          onChange={(e) => onChange({ plainText: e.target.value })}
          placeholder="Plain-language criterion, e.g. HbA1c between 7% and 10.5%"
          className="h-9 min-w-[220px] flex-1"
        />
        <Button type="button" size="sm" variant="ghost" onClick={onRemove} aria-label={`Remove criterion ${index + 1}`}>
          <Trash2 aria-hidden />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label htmlFor={`${id}-field`} className="text-muted-foreground">Check automatically using</label>
        <select
          id={`${id}-field`}
          value={c.field ?? ""}
          onChange={(e) => {
            const f = e.target.value || null;
            const v = f ? getVocabField(f) : undefined;
            onChange({
              field: f,
              operator: v ? (v.type === "bool" ? (c.kind === "exclusion" ? "present" : "present") : v.type === "number" ? "between" : "eq") : null,
              unit: v?.unit ?? null,
              category: v ? (v.category === "lab" || v.category === "vital" ? "lab" : v.category === "medication" ? "medication" : v.category === "demographic" ? "demographic" : "diagnosis") : "other",
              patientQuestion: v?.question ?? c.patientQuestion,
            });
          }}
          className={selectClass}
        >
          <option value="">Nothing (ask or let the study team check)</option>
          {CHECKABLE_FIELDS.map((v) => (
            <option key={v.field} value={v.field}>{v.label}</option>
          ))}
        </select>
        {vocab && ops.length > 0 ? (
          <>
            <label className="sr-only" htmlFor={`${id}-op`}>Rule</label>
            <select
              id={`${id}-op`}
              value={c.operator ?? ops[0]}
              onChange={(e) => onChange({ operator: e.target.value as DraftCriterion["operator"] })}
              className={selectClass}
            >
              {ops.map((o) => <option key={o} value={o}>{OPERATOR_LABEL[o]}</option>)}
            </select>
          </>
        ) : null}
        {vocab?.type === "number" && (c.operator === "gte" || c.operator === "between") ? (
          <Input aria-label="Minimum" inputMode="decimal" className="h-9 w-20" value={c.valueMin ?? ""} onChange={(e) => onChange({ valueMin: numOrNull(e.target.value) })} placeholder="min" />
        ) : null}
        {vocab?.type === "number" && (c.operator === "lte" || c.operator === "between") ? (
          <Input aria-label="Maximum" inputMode="decimal" className="h-9 w-20" value={c.valueMax ?? ""} onChange={(e) => onChange({ valueMax: numOrNull(e.target.value) })} placeholder="max" />
        ) : null}
        {vocab?.type === "text" ? (
          <Input aria-label="Value" className="h-9 w-28" value={c.valueText ?? ""} onChange={(e) => onChange({ valueText: e.target.value || null })} />
        ) : null}
        {vocab?.unit ? <span className="text-xs text-muted-foreground">{vocab.unit}</span> : null}
      </div>

      {!c.field ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label htmlFor={`${id}-q`} className="text-muted-foreground">Yes/no question for patients (optional)</label>
          <Input
            id={`${id}-q`}
            value={c.patientQuestion ?? ""}
            onChange={(e) => onChange({ patientQuestion: e.target.value || null })}
            placeholder="e.g. Have you had weight-loss surgery?"
            className="h-9 min-w-[220px] flex-1"
          />
        </div>
      ) : null}
    </div>
  );
}

export function NewStudyWizard({ clinicName, verified }: { clinicName: string; verified: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState(1);

  const [draft, setDraft] = useState<StudyDraft>({
    title: "",
    conditionCategory: "diabetes_metabolic",
    conditions: [],
    plainSummary: "",
    whatIsInvolved: "",
    minAge: 18,
    maxAge: null,
    sex: "ALL",
    criteria: [],
  });
  const [conditionsText, setConditionsText] = useState("");
  const [eligibilityText, setEligibilityText] = useState("");
  const [nctId, setNctId] = useState("");
  const [rawText, setRawText] = useState("");
  const [irb, setIrb] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [attested, setAttested] = useState(false);

  function patch(p: Partial<StudyDraft>) {
    setDraft((d) => ({ ...d, ...p }));
  }

  function runParse() {
    startTransition(async () => {
      try {
        const res = await parseProtocol({
          title: draft.title,
          conditions: conditionsText,
          eligibilityText: eligibilityText || undefined,
          nctId: nctId.trim() || undefined,
        });
        if (res.rawText) setRawText(res.rawText);
        else setRawText(eligibilityText);
        if (res.draft) {
          const d = res.draft;
          setDraft((cur) => ({
            ...cur,
            title: d.title || cur.title,
            conditions: d.conditions?.length ? d.conditions : cur.conditions,
            plainSummary: d.plainSummary || cur.plainSummary,
            whatIsInvolved: d.whatIsInvolved || cur.whatIsInvolved,
            minAge: d.minAge ?? cur.minAge,
            maxAge: d.maxAge ?? cur.maxAge,
            sex: d.sex,
            criteria: d.criteria.length ? d.criteria : cur.criteria.length ? cur.criteria : [emptyCriterion("inclusion")],
          }));
        } else {
          setDraft((cur) => ({ ...cur, criteria: cur.criteria.length ? cur.criteria : [emptyCriterion("inclusion")] }));
        }
        if (!res.ok) toast.message(res.error ?? "Add the checklist by hand.");
        else toast.success(`Found ${res.draft?.criteria.length ?? 0} criteria. Review each one.`);
        setStep(3);
      } catch {
        toast.error("Parsing failed. Add the checklist by hand.");
        setRawText(eligibilityText);
        setDraft((cur) => ({ ...cur, criteria: cur.criteria.length ? cur.criteria : [emptyCriterion("inclusion")] }));
        setStep(3);
      }
    });
  }

  function skipToManual() {
    setRawText(eligibilityText);
    setDraft((cur) => ({ ...cur, criteria: cur.criteria.length ? cur.criteria : [emptyCriterion("inclusion")] }));
    setStep(3);
  }

  function updateCriterion(i: number, p: Partial<DraftCriterion>) {
    setDraft((d) => ({ ...d, criteria: d.criteria.map((c, idx) => (idx === i ? { ...c, ...p } : c)) }));
  }

  const validCriteria = draft.criteria.filter((c) => c.plainText.trim().length >= 3);

  function save() {
    const toSave: StudyDraft = { ...draft, criteria: validCriteria };
    startTransition(async () => {
      try {
        const res = await saveStudy(toSave, irb, inviteMessage, attested);
        if (!res.ok || !res.trialId) {
          toast.error(res.error ?? "Could not save.");
          return;
        }
        toast.success("Study created and matched.");
        router.push(`/clinic/studies/${res.trialId}`);
      } catch {
        toast.error("Could not save the study. Try again.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <Progress value={(step / STEPS.length) * 100} aria-label={`Step ${step} of ${STEPS.length}`} />
        <ol className="mt-2 flex flex-wrap gap-x-4 text-xs text-muted-foreground">
          {STEPS.map((s, i) => (
            <li key={s} aria-current={step === i + 1 ? "step" : undefined} className={step === i + 1 ? "font-medium text-foreground" : ""}>
              {i + 1}. {s}
            </li>
          ))}
        </ol>
      </div>

      {!verified ? (
        <p className="rounded-md bg-tc-secondary-soft px-3 py-2 text-sm">
          Your clinic is pending verification. You can create studies now. Invitations and
          applications open once TrialCave verifies {clinicName}.
        </p>
      ) : null}

      {step === 1 ? (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <h2 className="text-lg font-semibold">1. Basics</h2>
            <div className="space-y-1.5">
              <Label htmlFor="title">Study title</Label>
              <Input id="title" value={draft.title} onChange={(e) => patch({ title: e.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cat">Condition category</Label>
                <select id="cat" value={draft.conditionCategory} onChange={(e) => patch({ conditionCategory: e.target.value })} className={`${selectClass} h-10 w-full`}>
                  {CATEGORY_OPTIONS.filter((o) => o.value !== "all").map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cond">Conditions (comma separated)</Label>
                <Input
                  id="cond"
                  value={conditionsText}
                  onChange={(e) => {
                    setConditionsText(e.target.value);
                    patch({ conditions: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) });
                  }}
                  placeholder="Type 2 diabetes"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="minage">Minimum age</Label>
                <Input id="minage" inputMode="numeric" value={draft.minAge ?? ""} onChange={(e) => patch({ minAge: numOrNull(e.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="maxage">Maximum age</Label>
                <Input id="maxage" inputMode="numeric" value={draft.maxAge ?? ""} onChange={(e) => patch({ maxAge: numOrNull(e.target.value) })} placeholder="No limit" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sex">Sex</Label>
                <select id="sex" value={draft.sex} onChange={(e) => patch({ sex: e.target.value as StudyDraft["sex"] })} className={`${selectClass} h-10 w-full`}>
                  <option value="ALL">All</option>
                  <option value="FEMALE">Female</option>
                  <option value="MALE">Male</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="summary">Plain-language summary (shown to patients)</Label>
              <textarea id="summary" rows={3} value={draft.plainSummary} onChange={(e) => patch({ plainSummary: e.target.value })} className={textareaClass} placeholder="What the study tests, in everyday words." />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="involved">What&apos;s involved</Label>
              <Input id="involved" value={draft.whatIsInvolved} onChange={(e) => patch({ whatIsInvolved: e.target.value })} placeholder="About 8 visits over 26 weeks" />
            </div>
            <Button onClick={() => setStep(2)} disabled={draft.title.trim().length < 3}>Continue</Button>
          </CardContent>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <h2 className="text-lg font-semibold">2. Eligibility</h2>
            <div className="space-y-1.5">
              <Label htmlFor="elig">Paste eligibility criteria</Label>
              <textarea
                id="elig"
                value={eligibilityText}
                onChange={(e) => setEligibilityText(e.target.value)}
                rows={8}
                className={textareaClass}
                placeholder={"Inclusion Criteria:\n- Adults with type 2 diabetes\n- HbA1c 7-10.5%\n\nExclusion Criteria:\n- Uses insulin"}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nct">…or import by ClinicalTrials.gov NCT id</Label>
              <Input id="nct" value={nctId} onChange={(e) => setNctId(e.target.value)} placeholder="NCT01234567" className="max-w-xs" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={() => setStep(1)} disabled={pending}>Back</Button>
              <Button onClick={runParse} disabled={pending || (!eligibilityText.trim() && !nctId.trim())}>
                {pending ? "Reading criteria…" : "Parse with AI"}
              </Button>
              <Button variant="outline" onClick={skipToManual} disabled={pending}>Write the checklist by hand</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 3 ? (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <h2 className="text-lg font-semibold">3. Review checklist</h2>
            <p className="text-sm text-muted-foreground">
              Each row is one criterion. Link it to a profile field to check it automatically, or add a
              yes/no question. Anything else is left for your study team.
            </p>
            {rawText ? (
              <details className="rounded-md border border-border p-3 text-sm">
                <summary className="cursor-pointer font-medium">Original eligibility text</summary>
                <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">{rawText}</pre>
              </details>
            ) : null}
            <div className="space-y-2">
              {draft.criteria.map((c, i) => (
                <CriterionEditor
                  key={i}
                  c={c}
                  index={i}
                  onChange={(p) => updateCriterion(i, p)}
                  onRemove={() => setDraft((d) => ({ ...d, criteria: d.criteria.filter((_, idx) => idx !== i) }))}
                />
              ))}
              {draft.criteria.length === 0 ? <p className="text-sm text-muted-foreground">No criteria yet. Add one below.</p> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setDraft((d) => ({ ...d, criteria: [...d.criteria, emptyCriterion("inclusion")] }))}>
                <Plus aria-hidden /> Add requirement
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setDraft((d) => ({ ...d, criteria: [...d.criteria, emptyCriterion("exclusion")] }))}>
                <Plus aria-hidden /> Add exclusion
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              <Button variant="ghost" onClick={() => setStep(2)}>Back</Button>
              <Button onClick={() => setStep(4)} disabled={validCriteria.length === 0}>
                Confirm checklist ({validCriteria.length})
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 4 ? (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <h2 className="text-lg font-semibold">4. IRB and invitation</h2>
            <div className="space-y-1.5">
              <Label htmlFor="irb">IRB protocol number</Label>
              <Input id="irb" value={irb} onChange={(e) => setIrb(e.target.value)} placeholder="e.g. 2026-014" className="max-w-xs" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="msg">Invitation text (shown to patients)</Label>
              <textarea id="msg" value={inviteMessage} onChange={(e) => setInviteMessage(e.target.value)} rows={4} className={textareaClass} placeholder="Leave blank to use the default template." />
            </div>
            <label className="flex items-start gap-3 text-sm">
              <Checkbox checked={attested} onCheckedChange={(v) => setAttested(Boolean(v))} className="mt-0.5" />
              <span>This invitation text and the study information shown to patients were approved by our IRB.</span>
            </label>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={() => setStep(3)} disabled={pending}>Back</Button>
              <Button onClick={save} disabled={pending || !irb.trim() || !attested}>
                {pending ? "Saving and matching…" : "Create study"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
