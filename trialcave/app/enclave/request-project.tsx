"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DATA_TYPES, RESEARCH_TYPES } from "@/lib/patient-options";
import { ANALYSIS_META, type AnalysisKey } from "@/lib/enclave/analyses";
import { requestProject } from "./actions";

export function RequestProjectForm({ startOpen = false }: { startOpen?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(startOpen);
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [researchType, setResearchType] = useState("academic");
  const [dataTypes, setDataTypes] = useState<string[]>([]);
  const [analyses, setAnalyses] = useState<AnalysisKey[]>([]);

  const toggle = <T extends string>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  function submit() {
    startTransition(async () => {
      try {
        const res = await requestProject({ title, description, researchType, dataTypes, analyses });
        if (!res.ok) {
          toast.error(res.error ?? "Couldn't submit.");
          return;
        }
        toast.success("Request sent. TrialCave will review it before any analysis can run.");
        setOpen(false);
        setTitle("");
        setDescription("");
        setDataTypes([]);
        setAnalyses([]);
        router.refresh();
      } catch {
        toast.error("Couldn't submit. Try again.");
      }
    });
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus aria-hidden /> Request a project
      </Button>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-5 p-6 sm:p-8">
        <h2 className="text-[1.45rem] font-extrabold tracking-tight">Request a research project</h2>
        <p className="text-[1.05rem] text-tc-ink-2">
          Projects run only predefined, aggregate analyses on Donors who consented to your data
          types and research type. A TrialCave admin approves every project.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="proj-title">Project title</Label>
          <Input id="proj-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="proj-desc">Research question</Label>
          <textarea
            id="proj-desc"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-[14px] border-2 border-input bg-white px-3 py-3 text-[1.05rem] text-tc-ink focus-visible:border-tc-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-tc-primary-soft"
          />
        </div>
        <fieldset>
          <legend className="text-[1.05rem] font-bold">Research type</legend>
          <div className="mt-2 flex flex-wrap gap-3">
            {RESEARCH_TYPES.map((r) => (
              <Button key={r.value} type="button" variant={researchType === r.value ? "default" : "outline"} aria-pressed={researchType === r.value} onClick={() => setResearchType(r.value)}>
                {r.label}
              </Button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-[1.05rem] font-bold">Data types</legend>
          <div className="mt-2 flex flex-wrap gap-3">
            {DATA_TYPES.map((d) => (
              <label key={d.value} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl bg-tc-mist px-4 text-[1.05rem]">
                <Checkbox checked={dataTypes.includes(d.value)} onCheckedChange={() => setDataTypes((l) => toggle(l, d.value))} />
                {d.label}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-[1.05rem] font-bold">Analyses</legend>
          <div className="mt-2 space-y-2">
            {(Object.keys(ANALYSIS_META) as AnalysisKey[]).map((k) => {
              const covered = ANALYSIS_META[k].needs.every((n) => dataTypes.includes(n));
              return (
                <label key={k} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl bg-tc-mist px-4 py-2 text-[1.05rem]">
                  <Checkbox checked={analyses.includes(k)} onCheckedChange={() => setAnalyses((l) => toggle(l, k))} />
                  <span>
                    {ANALYSIS_META[k].label}
                    <span className={`ml-2 text-[0.95rem] ${covered ? "text-tc-muted" : "font-semibold text-tc-warning-ink"}`}>needs {ANALYSIS_META[k].needs.join(" + ")}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
        <div className="flex flex-wrap gap-3">
          <Button onClick={submit} disabled={pending}>{pending ? "Sending…" : "Send for approval"}</Button>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}
