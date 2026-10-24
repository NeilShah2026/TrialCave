"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_OPTIONS } from "@/lib/categories";
import { parseProtocol, saveStudy, type StudyDraft } from "../../actions";

export function NewStudyWizard() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState(1);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("diabetes_metabolic");
  const [conditions, setConditions] = useState("");
  const [eligibilityText, setEligibilityText] = useState("");
  const [nctId, setNctId] = useState("");

  const [draft, setDraft] = useState<StudyDraft | null>(null);
  const [irb, setIrb] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [attested, setAttested] = useState(false);

  function runParse() {
    startTransition(async () => {
      const res = await parseProtocol({ title, conditions, eligibilityText: eligibilityText || undefined, nctId: nctId || undefined });
      if (!res.ok || !res.draft) {
        toast.error(res.error ?? "Parsing failed. You can still add criteria by hand.");
        setDraft({ title: title || "Untitled study", conditionCategory: category, plainSummary: "", whatIsInvolved: "", minAge: null, maxAge: null, sex: "ALL", criteria: [] });
        setStep(3);
        return;
      }
      setDraft({ ...res.draft, conditionCategory: category, title: res.draft.title || title });
      setStep(3);
    });
  }

  function updateCriterion(i: number, patch: Partial<StudyDraft["criteria"][number]>) {
    if (!draft) return;
    const criteria = draft.criteria.map((c, idx) => (idx === i ? { ...c, ...patch } : c));
    setDraft({ ...draft, criteria });
  }
  function removeCriterion(i: number) {
    if (!draft) return;
    setDraft({ ...draft, criteria: draft.criteria.filter((_, idx) => idx !== i) });
  }

  function save() {
    if (!draft) return;
    startTransition(async () => {
      const res = await saveStudy(draft, irb, inviteMessage);
      if (!res.ok || !res.trialId) {
        toast.error(res.error ?? "Could not save.");
        return;
      }
      toast.success("Study created.");
      router.push(`/clinic/studies/${res.trialId}`);
    });
  }

  return (
    <div className="space-y-6">
      {step === 1 ? (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <h2 className="text-lg font-semibold">1. Basics</h2>
            <div className="space-y-1.5">
              <Label htmlFor="title">Study title</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat">Condition category</Label>
              <select id="cat" value={category} onChange={(e) => setCategory(e.target.value)} className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm">
                {CATEGORY_OPTIONS.filter((o) => o.value !== "all").map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cond">Conditions (comma separated)</Label>
              <Input id="cond" value={conditions} onChange={(e) => setConditions(e.target.value)} placeholder="Type 2 diabetes" />
            </div>
            <Button onClick={() => setStep(2)} disabled={!title}>Continue</Button>
          </CardContent>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <h2 className="text-lg font-semibold">2. Eligibility</h2>
            <div className="space-y-1.5">
              <Label htmlFor="elig">Paste eligibility criteria</Label>
              <textarea id="elig" value={eligibilityText} onChange={(e) => setEligibilityText(e.target.value)} rows={8} className="w-full rounded-md border border-border bg-card p-3 text-sm" placeholder={"Inclusion Criteria:\n- Adults with type 2 diabetes\n- HbA1c 7-10.5%\n\nExclusion Criteria:\n- Uses insulin"} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nct">…or import by ClinicalTrials.gov NCT id</Label>
              <Input id="nct" value={nctId} onChange={(e) => setNctId(e.target.value)} placeholder="NCT01234567" />
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={runParse} disabled={pending || (!eligibilityText && !nctId)}>
                {pending ? "Parsing with AI…" : "Parse with AI"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 3 && draft ? (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <h2 className="text-lg font-semibold">3. Review checklist</h2>
            <p className="text-sm text-muted-foreground">Edit anything the AI got wrong, then confirm.</p>
            <div className="space-y-2">
              {draft.criteria.map((c, i) => (
                <div key={i} className="flex items-start gap-2 rounded-md border border-border p-2">
                  <Badge variant={c.kind === "inclusion" ? "success" : "danger"}>{c.kind}</Badge>
                  <Input value={c.plainText} onChange={(e) => updateCriterion(i, { plainText: e.target.value })} className="h-8 flex-1" />
                  <button type="button" onClick={() => removeCriterion(i)} className="text-xs text-tc-danger hover:underline">Remove</button>
                </div>
              ))}
              {draft.criteria.length === 0 ? <p className="text-sm text-muted-foreground">No criteria. Add them in the next version, or go back and paste text.</p> : null}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setStep(2)}>Back</Button>
              <Button onClick={() => setStep(4)}>Confirm checklist</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 4 && draft ? (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <h2 className="text-lg font-semibold">4. IRB and invitation</h2>
            <div className="space-y-1.5">
              <Label htmlFor="irb">IRB protocol number</Label>
              <Input id="irb" value={irb} onChange={(e) => setIrb(e.target.value)} placeholder="e.g. 2026-014" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="msg">Invitation text (shown to patients)</Label>
              <textarea id="msg" value={inviteMessage} onChange={(e) => setInviteMessage(e.target.value)} rows={4} className="w-full rounded-md border border-border bg-card p-3 text-sm" placeholder="Leave blank to use the default approved template." />
            </div>
            <label className="flex items-start gap-3 text-sm">
              <Checkbox checked={attested} onCheckedChange={(v) => setAttested(Boolean(v))} />
              <span>This invitation text and the study information shown to patients were approved by our IRB.</span>
            </label>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setStep(3)}>Back</Button>
              <Button onClick={save} disabled={pending || !irb || !attested}>
                {pending ? "Saving…" : "Create study"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
