"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { CriterionIcon } from "@/components/criterion-icon";
import type { CriterionStatus } from "@/lib/matching/types";

export interface SummaryItem {
  label: string;
  value: string;
  date: string | null;
}

interface SummaryCriterion {
  id: string;
  kind: "inclusion" | "exclusion";
  status: CriterionStatus;
  text: string;
  sensitive: boolean;
}

const OPTIONS = [
  { key: "first_name", label: "First name" },
  { key: "last_name", label: "Last name" },
  { key: "age", label: "Age" },
  { key: "sex", label: "Sex" },
  { key: "town", label: "Town" },
  { key: "conditions", label: "Diagnoses" },
  { key: "labs", label: "Lab results and vitals" },
  { key: "medications", label: "Medications" },
  { key: "criteria", label: "Criteria checklist" },
] as const;
type OptionKey = (typeof OPTIONS)[number]["key"];

function statusWord(kind: "inclusion" | "exclusion", status: CriterionStatus): string {
  if (status === "unknown") return "Not known yet";
  if (kind === "exclusion") return status === "pass" ? "Doesn't apply" : "May rule me out";
  return status === "pass" ? "Meets" : "Doesn't meet";
}

export function SummaryClient({
  trialTitle,
  trialRef,
  statusLabel,
  personal,
  conditions,
  labs,
  medications,
  criteria,
}: {
  trialTitle: string;
  trialRef: string;
  statusLabel: string;
  personal: { firstName: string; lastName: string; age: string; sex: string; town: string };
  conditions: SummaryItem[];
  labs: SummaryItem[];
  medications: SummaryItem[];
  criteria: SummaryCriterion[];
}) {
  // B14.3: nothing included by default except first name (and the checklist,
  // which is the point of the summary and contains no values).
  const [include, setInclude] = useState<Record<OptionKey, boolean>>({
    first_name: true,
    last_name: false,
    age: false,
    sex: false,
    town: false,
    conditions: false,
    labs: false,
    medications: false,
    criteria: true,
  });
  const today = format(new Date(), "MMMM d, yyyy");
  const name = [include.first_name ? personal.firstName : "", include.last_name ? personal.lastName : ""].filter(Boolean).join(" ");

  const renderList = (items: SummaryItem[]) =>
    items.length === 0 ? (
      <p className="text-sm text-muted-foreground">None on file.</p>
    ) : (
      <ul className="text-sm">
        {items.map((i) => (
          <li key={i.label} className="flex justify-between gap-3 border-b border-border py-1 last:border-0">
            <span>{i.label}</span>
            <span className="text-muted-foreground">
              {i.value}
              {i.date ? ` · ${format(parseISO(i.date), "MMM yyyy")}` : ""}
            </span>
          </li>
        ))}
      </ul>
    );

  return (
    <div>
      <Card className="mt-4 print:hidden">
        <CardContent className="pt-6">
          <h1 className="text-2xl font-semibold">Pre-screen summary</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose what to include, then print it or save it as a PDF. Bring it to your doctor or
            send it to the study team. Nothing is shared from here.
          </p>
          <fieldset className="mt-4 grid gap-2 sm:grid-cols-3">
            <legend className="mb-2 text-sm font-medium">Include</legend>
            {OPTIONS.map((o) => (
              <label key={o.key} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={include[o.key]}
                  onCheckedChange={(v) => setInclude((s) => ({ ...s, [o.key]: Boolean(v) }))}
                />
                {o.label}
              </label>
            ))}
          </fieldset>
          <Button className="mt-4" onClick={() => window.print()}>
            <Printer aria-hidden /> Print / Save as PDF
          </Button>
        </CardContent>
      </Card>

      <article className="mt-6 rounded-2xl border border-border bg-card p-6 print:mt-0 print:border-0 print:p-0">
        <header className="border-b border-border pb-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">TrialCave pre-screen summary</p>
          <h2 className="mt-1 text-xl font-semibold">{trialTitle}</h2>
          <p className="text-sm text-muted-foreground">{trialRef} · {statusLabel}</p>
        </header>

        <section className="mt-4">
          <h3 className="text-sm font-semibold">About me</h3>
          <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
            {name ? (<><dt className="text-muted-foreground">Name</dt><dd>{name}</dd></>) : null}
            {include.age && personal.age ? (<><dt className="text-muted-foreground">Age</dt><dd>{personal.age}</dd></>) : null}
            {include.sex && personal.sex ? (<><dt className="text-muted-foreground">Sex</dt><dd>{personal.sex}</dd></>) : null}
            {include.town && personal.town ? (<><dt className="text-muted-foreground">Town</dt><dd>{personal.town}</dd></>) : null}
          </dl>
          {!name && !include.age && !include.sex && !include.town ? (
            <p className="text-sm text-muted-foreground">No personal details included.</p>
          ) : null}
        </section>

        {include.conditions ? (
          <section className="mt-4">
            <h3 className="text-sm font-semibold">Diagnoses</h3>
            {renderList(conditions)}
          </section>
        ) : null}
        {include.labs ? (
          <section className="mt-4">
            <h3 className="text-sm font-semibold">Lab results and vitals</h3>
            {renderList(labs)}
          </section>
        ) : null}
        {include.medications ? (
          <section className="mt-4">
            <h3 className="text-sm font-semibold">Medications</h3>
            {renderList(medications)}
          </section>
        ) : null}

        {include.criteria ? (
          <section className="mt-4">
            <h3 className="text-sm font-semibold">Eligibility checklist</h3>
            {criteria.length === 0 ? (
              <p className="text-sm text-muted-foreground">No criteria checked yet.</p>
            ) : (
              <ul className="mt-1 space-y-1 text-sm">
                {criteria.map((c) => (
                  <li key={c.id} className="flex gap-2">
                    <CriterionIcon status={c.sensitive ? "unknown" : c.status} kind={c.kind} className="[&_svg]:size-4" />
                    <span>
                      {c.kind === "exclusion" ? "Exclusion: " : ""}
                      {c.text} — <span className="text-muted-foreground">{c.sensitive ? "Not included" : statusWord(c.kind, c.status)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        <footer className="mt-6 border-t border-border pt-3 text-xs text-muted-foreground">
          Prepared by the patient using TrialCave on {today}. Not a medical record. The study team
          makes the final decision.
        </footer>
      </article>
    </div>
  );
}
