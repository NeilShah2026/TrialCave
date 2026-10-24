"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { addLabResults, setHistoryFact } from "../records/actions";

export interface OverviewFact {
  field: string | null;
  label: string;
  value: string;
  observedAt: string | null;
  source: string;
}

const LAB_FIELDS = [
  { field: "hba1c_pct", label: "HbA1c (%)" },
  { field: "fasting_glucose_mgdl", label: "Fasting glucose (mg/dL)" },
  { field: "ldl_mgdl", label: "LDL (mg/dL)" },
  { field: "triglycerides_mgdl", label: "Triglycerides (mg/dL)" },
  { field: "egfr", label: "eGFR" },
  { field: "alt_ul", label: "ALT (U/L)" },
  { field: "bmi", label: "BMI" },
  { field: "weight_kg", label: "Weight (kg)" },
  { field: "systolic_bp", label: "Systolic BP" },
  { field: "diastolic_bp", label: "Diastolic BP" },
];

const HISTORY_FIELDS = [
  { field: "dx:type2_diabetes", label: "Type 2 diabetes" },
  { field: "dx:prediabetes", label: "Prediabetes" },
  { field: "dx:ckd", label: "Chronic kidney disease" },
  { field: "dx:hypertension", label: "High blood pressure" },
  { field: "med:metformin", label: "Take metformin" },
  { field: "med:insulin", label: "Use insulin" },
  { field: "event:mi_6mo", label: "Heart attack in past 6 months" },
  { field: "event:stroke_6mo", label: "Stroke in past 6 months" },
  { field: "current_smoker", label: "Currently smoke" },
];

export function ProfileTabs({
  overview,
  displayOnly,
  defaultTab,
}: {
  overview: OverviewFact[];
  displayOnly: OverviewFact[];
  defaultTab: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [labValues, setLabValues] = useState<Record<string, string>>({});
  const [labDate, setLabDate] = useState(format(new Date(), "yyyy-MM-dd"));

  function saveLabs() {
    const labs = Object.entries(labValues)
      .filter(([, v]) => v !== "" && Number.isFinite(Number(v)))
      .map(([field, v]) => ({ field, value: Number(v), observedAt: labDate }));
    if (labs.length === 0) {
      toast.error("Enter at least one value.");
      return;
    }
    startTransition(async () => {
      const res = await addLabResults(labs);
      if (res.ok) {
        toast.success(res.changeCount > 0 ? "Saved. Your matches updated." : "Saved.");
        setLabValues({});
        router.refresh();
      } else {
        toast.error(res.error ?? "Could not save.");
      }
    });
  }

  function answerHistory(field: string, value: boolean) {
    startTransition(async () => {
      const res = await setHistoryFact(field, value);
      if (res.ok) {
        toast.success(res.changeCount > 0 ? "Saved. Matches updated." : "Saved.");
        router.refresh();
      }
    });
  }

  return (
    <Tabs defaultValue={defaultTab}>
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="labs">Labs</TabsTrigger>
        <TabsTrigger value="history">Health history</TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <Card>
          <CardContent className="pt-6">
            {overview.length === 0 ? (
              <p className="text-sm text-muted-foreground">No confirmed facts yet. Add a record or enter labs.</p>
            ) : (
              <ul className="divide-y divide-border">
                {overview.map((f, i) => (
                  <li key={i} className="flex items-center justify-between py-2 text-sm">
                    <span className="font-medium">{f.label}</span>
                    <span className="flex items-center gap-2">
                      <span>{f.value}</span>
                      <Badge variant="muted">{f.source === "self_report" ? "your answer" : f.source === "document" ? "from a record" : f.source}</Badge>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {displayOnly.length > 0 ? (
              <div className="mt-4">
                <p className="text-sm font-semibold text-muted-foreground">Other items from your records</p>
                <ul className="mt-1 text-sm text-muted-foreground">
                  {displayOnly.map((f, i) => <li key={i}>{f.label}</li>)}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="labs">
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-lg font-semibold">Add lab results</h2>
            <div className="mt-3 space-y-1.5">
              <Label htmlFor="labdate">Date</Label>
              <Input id="labdate" type="date" value={labDate} onChange={(e) => setLabDate(e.target.value)} className="max-w-xs" />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {LAB_FIELDS.map((l) => (
                <div key={l.field} className="space-y-1">
                  <Label htmlFor={l.field}>{l.label}</Label>
                  <Input id={l.field} inputMode="decimal" value={labValues[l.field] ?? ""} onChange={(e) => setLabValues((v) => ({ ...v, [l.field]: e.target.value }))} />
                </div>
              ))}
            </div>
            <Button className="mt-4" onClick={saveLabs} disabled={pending}>
              {pending ? "Saving…" : "Save lab results"}
            </Button>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="history">
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-lg font-semibold">Health history</h2>
            <p className="text-sm text-muted-foreground">Answer any that apply. One answer helps every trial.</p>
            <ul className="mt-3 divide-y divide-border">
              {HISTORY_FIELDS.map((h) => (
                <li key={h.field} className="flex items-center justify-between py-2 text-sm">
                  <span>{h.label}</span>
                  <span className="flex gap-1">
                    <Button size="sm" variant="outline" disabled={pending} onClick={() => answerHistory(h.field, true)}>Yes</Button>
                    <Button size="sm" variant="outline" disabled={pending} onClick={() => answerHistory(h.field, false)}>No</Button>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
