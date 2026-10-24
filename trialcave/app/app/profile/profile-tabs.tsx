"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { Pencil, Trash2, Watch, Activity, Hospital } from "lucide-react";
import { toast } from "sonner";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CONNECTOR_SOURCES, sourceLabel } from "@/lib/patient-options";
import { addLabResults, editFact, setHistoryFact } from "../records/actions";
import { connectSource, disconnectSource } from "./actions";

export interface OverviewFact {
  id: string;
  field: string | null;
  label: string;
  value: string;
  valueNum: number | null;
  valueBool: boolean | null;
  type: "number" | "bool" | "text";
  category: string;
  observedAt: string | null;
  source: string;
  fromDocument: boolean;
}

export interface DeviceSummary {
  connected: string[];
  avgSteps: number | null;
  avgRestingHr: number | null;
  avgSleep: number | null;
  avgTimeInRange: number | null;
}

const LAB_FIELDS = [
  { field: "hba1c_pct", label: "HbA1c", unit: "%" },
  { field: "fasting_glucose_mgdl", label: "Fasting glucose", unit: "mg/dL" },
  { field: "ldl_mgdl", label: "LDL cholesterol", unit: "mg/dL" },
  { field: "triglycerides_mgdl", label: "Triglycerides", unit: "mg/dL" },
  { field: "egfr", label: "Kidney function (eGFR)", unit: "mL/min/1.73m²" },
  { field: "alt_ul", label: "Liver enzyme (ALT)", unit: "U/L" },
  { field: "bmi", label: "BMI", unit: "kg/m²" },
  { field: "weight_kg", label: "Weight", unit: "kg" },
  { field: "systolic_bp", label: "Blood pressure (top number)", unit: "mmHg" },
  { field: "diastolic_bp", label: "Blood pressure (bottom number)", unit: "mmHg" },
];

const HISTORY_FIELDS = [
  { field: "dx:type2_diabetes", label: "Type 2 diabetes" },
  { field: "dx:type1_diabetes", label: "Type 1 diabetes" },
  { field: "dx:prediabetes", label: "Prediabetes" },
  { field: "dx:ckd", label: "Chronic kidney disease" },
  { field: "dx:hypertension", label: "High blood pressure" },
  { field: "dx:heart_failure", label: "Heart failure" },
  { field: "dx:cancer_active", label: "Currently treated for cancer" },
  { field: "med:metformin", label: "Take metformin" },
  { field: "med:insulin", label: "Use insulin" },
  { field: "med:glp1", label: "Take a GLP-1 medication (e.g. Ozempic)" },
  { field: "med:statin", label: "Take a statin" },
  { field: "event:mi_6mo", label: "Heart attack in the past 6 months" },
  { field: "event:stroke_6mo", label: "Stroke in the past 6 months" },
  { field: "current_smoker", label: "Currently smoke" },
];

function useAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function run<T extends { ok: boolean; error?: string; changeCount?: number }>(fn: () => Promise<T>, success: string, after?: () => void) {
    startTransition(async () => {
      try {
        const res = await fn();
        if (!res.ok) {
          toast.error(res.error ?? "Something went wrong.");
          return;
        }
        toast.success(res.changeCount && res.changeCount > 0 ? `${success} ${res.changeCount} match${res.changeCount === 1 ? "" : "es"} changed.` : success);
        after?.();
        router.refresh();
      } catch {
        toast.error("Something went wrong. Check your connection and try again.");
      }
    });
  }
  return { pending, run };
}

function FactRow({ f }: { f: OverviewFact }) {
  const { pending, run } = useAction();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(f.valueNum != null ? String(f.valueNum) : "");
  const locked = f.source === "wearable" || f.source === "portal";
  const badge = f.fromDocument && f.observedAt ? `From your ${format(parseISO(f.observedAt), "MMM d")} record` : sourceLabel(f.source);

  return (
    <li className="py-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">{f.label}</span>
        <span className="flex flex-wrap items-center gap-2">
          <span>{f.value}</span>
          {f.observedAt ? <span className="text-xs text-muted-foreground">{format(parseISO(f.observedAt), "MMM yyyy")}</span> : null}
          <Badge variant="muted">{badge}</Badge>
          {!locked && f.type !== "text" ? (
            <Button size="sm" variant="ghost" onClick={() => setEditing((e) => !e)} aria-label={`Edit ${f.label}`} disabled={pending}>
              <Pencil aria-hidden /> Edit
            </Button>
          ) : null}
          {!locked ? (
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Remove ${f.label}`}
              disabled={pending}
              onClick={() => run(() => editFact(f.id, null), `Removed ${f.label}.`)}
            >
              <Trash2 aria-hidden />
            </Button>
          ) : null}
        </span>
      </div>
      {editing ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {f.type === "bool" ? (
            <>
              <Button size="sm" variant={f.valueBool ? "default" : "outline"} disabled={pending} onClick={() => run(() => editFact(f.id, { bool: true }), "Saved.", () => setEditing(false))}>Yes</Button>
              <Button size="sm" variant={f.valueBool === false ? "default" : "outline"} disabled={pending} onClick={() => run(() => editFact(f.id, { bool: false }), "Saved.", () => setEditing(false))}>No</Button>
            </>
          ) : (
            <>
              <Input
                aria-label={`New value for ${f.label}`}
                inputMode="decimal"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="h-9 w-32"
              />
              <Button
                size="sm"
                disabled={pending || draft.trim() === "" || !Number.isFinite(Number(draft))}
                onClick={() => run(() => editFact(f.id, { num: Number(draft) }), "Saved.", () => setEditing(false))}
              >
                Save
              </Button>
            </>
          )}
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={pending}>Cancel</Button>
        </div>
      ) : null}
    </li>
  );
}

export function ProfileTabs({
  overview,
  displayOnly,
  devices,
  defaultTab,
}: {
  overview: OverviewFact[];
  displayOnly: OverviewFact[];
  devices: DeviceSummary;
  defaultTab: string;
}) {
  const { pending, run } = useAction();
  const [labValues, setLabValues] = useState<Record<string, string>>({});
  const [labDate, setLabDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const current = new Map(overview.filter((f) => f.field).map((f) => [f.field as string, f]));

  function saveLabs() {
    const entries = Object.entries(labValues).filter(([, v]) => v.trim() !== "");
    const bad = entries.find(([, v]) => !Number.isFinite(Number(v)));
    if (bad) {
      toast.error("Use numbers only, for example 7.2.");
      return;
    }
    if (entries.length === 0) {
      toast.error("Enter at least one value.");
      return;
    }
    const labs = entries.map(([field, v]) => ({ field, value: Number(v), observedAt: labDate }));
    run(() => addLabResults(labs), "Saved.", () => setLabValues({}));
  }

  const groups = [
    { title: "Diagnoses", items: overview.filter((f) => f.category === "condition") },
    { title: "Lab results and vitals", items: overview.filter((f) => f.category === "lab" || f.category === "vital") },
    { title: "Medications", items: overview.filter((f) => f.category === "medication") },
    { title: "Health history", items: overview.filter((f) => f.category === "history" || f.category === "reproductive") },
  ].filter((g) => g.items.length > 0);

  return (
    <Tabs defaultValue={defaultTab}>
      <TabsList className="h-auto flex-wrap">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="labs">Labs</TabsTrigger>
        <TabsTrigger value="history">Health history</TabsTrigger>
        <TabsTrigger value="devices">Devices</TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <Card>
          <CardContent className="pt-6">
            {overview.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                <p>No confirmed items yet.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild size="sm"><Link href="/app/records">Add a record</Link></Button>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {groups.map((g) => (
                  <section key={g.title}>
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{g.title}</h2>
                    <ul className="divide-y divide-border">
                      {g.items.map((f) => <FactRow key={f.id} f={f} />)}
                    </ul>
                  </section>
                ))}
              </div>
            )}
            {displayOnly.length > 0 ? (
              <div className="mt-5">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Other items from your records</h2>
                <p className="text-xs text-muted-foreground">Not used for matching.</p>
                <ul className="mt-1 divide-y divide-border">
                  {displayOnly.map((f) => <FactRow key={f.id} f={f} />)}
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
            <p className="text-sm text-muted-foreground">
              Fill in any you have. Values you type are used for matching. Uploading the lab report
              also counts for the Data Donor program.
            </p>
            <div className="mt-3 space-y-1.5">
              <Label htmlFor="labdate">Test date</Label>
              <Input id="labdate" type="date" value={labDate} max={format(new Date(), "yyyy-MM-dd")} onChange={(e) => setLabDate(e.target.value)} className="max-w-xs" />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {LAB_FIELDS.map((l) => {
                const cur = current.get(l.field);
                return (
                  <div key={l.field} className="space-y-1">
                    <Label htmlFor={l.field}>
                      {l.label} <span className="font-normal text-muted-foreground">({l.unit})</span>
                    </Label>
                    <Input
                      id={l.field}
                      inputMode="decimal"
                      placeholder={cur ? `Now ${cur.value}` : undefined}
                      value={labValues[l.field] ?? ""}
                      onChange={(e) => setLabValues((v) => ({ ...v, [l.field]: e.target.value }))}
                    />
                  </div>
                );
              })}
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
              {HISTORY_FIELDS.map((h) => {
                const cur = current.get(h.field);
                const answer = cur?.valueBool;
                return (
                  <li key={h.field} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span>
                      {h.label}
                      {cur ? <span className="ml-2 text-xs text-muted-foreground">({sourceLabel(cur.source)})</span> : null}
                    </span>
                    <span className="flex gap-1" role="group" aria-label={h.label}>
                      <Button
                        size="sm"
                        variant={answer === true ? "default" : "outline"}
                        aria-pressed={answer === true}
                        disabled={pending}
                        onClick={() => run(() => setHistoryFact(h.field, true), "Saved.")}
                      >
                        Yes
                      </Button>
                      <Button
                        size="sm"
                        variant={answer === false ? "default" : "outline"}
                        aria-pressed={answer === false}
                        disabled={pending}
                        onClick={() => run(() => setHistoryFact(h.field, false), "Saved.")}
                      >
                        No
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-pressed={answer === undefined}
                        disabled={pending || answer === undefined}
                        onClick={() => run(() => setHistoryFact(h.field, null), "Cleared your answer.")}
                      >
                        Not sure
                      </Button>
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="devices">
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-lg font-semibold">Devices and portals</h2>
            <p className="text-sm text-muted-foreground">
              Demo mode: connecting adds 90 days of sample data so you can see how this works. Device
              data can&apos;t be edited by hand. We never collect location or GPS data.
            </p>
            {devices.connected.length > 0 ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                {[
                  { label: "Daily steps", value: devices.avgSteps != null ? Math.round(devices.avgSteps).toLocaleString() : "—" },
                  { label: "Resting heart rate", value: devices.avgRestingHr != null ? `${Math.round(devices.avgRestingHr)} bpm` : "—" },
                  { label: "Sleep", value: devices.avgSleep != null ? `${devices.avgSleep} h` : "—" },
                  { label: "Time in range", value: devices.avgTimeInRange != null ? `${Math.round(devices.avgTimeInRange)}%` : "—" },
                ].map((s) => (
                  <div key={s.label} className="rounded-md border border-border p-3">
                    <p className="text-xs text-muted-foreground">{s.label} · 30-day avg</p>
                    <p className="text-lg font-semibold">{s.value}</p>
                  </div>
                ))}
              </div>
            ) : null}
            <ul className="mt-4 divide-y divide-border">
              {CONNECTOR_SOURCES.map((s) => {
                const connected = devices.connected.includes(s.value);
                const Icon = s.kind === "portal" ? Hospital : s.kind === "cgm" ? Activity : Watch;
                return (
                  <li key={s.value} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span className="flex items-center gap-2">
                      <Icon className="size-4 text-muted-foreground" aria-hidden />
                      {s.label}
                      {connected ? <Badge variant="success">Connected</Badge> : null}
                    </span>
                    {connected ? (
                      <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => disconnectSource(s.value), `${s.label} disconnected.`)}>
                        Disconnect
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => connectSource(s.value), `${s.label} connected.`)}>
                        Connect
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
