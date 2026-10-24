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

/** Page title and intro live in the PageHero on the server page. */
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
      <p className="text-[1rem] text-tc-ink-2">None on file.</p>
    ) : (
      <ul className="text-[1rem]">
        {items.map((i) => (
          <li key={i.label} className="flex justify-between gap-3 border-b border-tc-border py-2 last:border-0">
            <span className="font-semibold text-tc-ink">{i.label}</span>
            <span className="text-tc-ink-2">
              {i.value}
              {i.date ? ` · ${format(parseISO(i.date), "MMM yyyy")}` : ""}
            </span>
          </li>
        ))}
      </ul>
    );

  return (
    <div>
      <Card className="print:hidden">
        <CardContent className="pt-6 sm:pt-7">
          <fieldset className="grid gap-3 sm:grid-cols-3">
            <legend className="mb-3 text-[1.15rem] font-bold">Include</legend>
            {OPTIONS.map((o) => (
              <label
                key={o.key}
                className="flex min-h-[3.1rem] cursor-pointer items-center gap-3 rounded-2xl border-2 border-tc-border px-4 py-2 text-[1rem] font-semibold text-tc-ink has-[[data-state=checked]]:border-tc-primary"
              >
                <Checkbox
                  checked={include[o.key]}
                  onCheckedChange={(v) => setInclude((s) => ({ ...s, [o.key]: Boolean(v) }))}
                />
                {o.label}
              </label>
            ))}
          </fieldset>
          <Button size="lg" className="mt-5" onClick={() => window.print()}>
            <Printer aria-hidden /> Print / Save as PDF
          </Button>
        </CardContent>
      </Card>

      <article className="mt-6 rounded-[24px] bg-white p-7 text-tc-ink shadow-card print:mt-0 print:rounded-none print:p-0 print:shadow-none">
        <header className="border-b-2 border-tc-border pb-4">
          <p className="text-[0.95rem] font-bold text-tc-primary-ink">TrialCave pre-screen summary</p>
          <h2 className="mt-1 text-[1.45rem] font-extrabold tracking-tight">{trialTitle}</h2>
          <p className="mt-1 text-[1rem] text-tc-ink-2">{trialRef} · {statusLabel}</p>
        </header>

        <section className="mt-5">
          <h3 className="text-[1.15rem] font-bold">About me</h3>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[1rem] sm:grid-cols-4">
            {name ? (<><dt className="text-tc-muted">Name</dt><dd className="font-semibold">{name}</dd></>) : null}
            {include.age && personal.age ? (<><dt className="text-tc-muted">Age</dt><dd className="font-semibold">{personal.age}</dd></>) : null}
            {include.sex && personal.sex ? (<><dt className="text-tc-muted">Sex</dt><dd className="font-semibold">{personal.sex}</dd></>) : null}
            {include.town && personal.town ? (<><dt className="text-tc-muted">Town</dt><dd className="font-semibold">{personal.town}</dd></>) : null}
          </dl>
          {!name && !include.age && !include.sex && !include.town ? (
            <p className="text-[1rem] text-tc-ink-2">No personal details included.</p>
          ) : null}
        </section>

        {include.conditions ? (
          <section className="mt-5">
            <h3 className="text-[1.15rem] font-bold">Diagnoses</h3>
            {renderList(conditions)}
          </section>
        ) : null}
        {include.labs ? (
          <section className="mt-5">
            <h3 className="text-[1.15rem] font-bold">Lab results and vitals</h3>
            {renderList(labs)}
          </section>
        ) : null}
        {include.medications ? (
          <section className="mt-5">
            <h3 className="text-[1.15rem] font-bold">Medications</h3>
            {renderList(medications)}
          </section>
        ) : null}

        {include.criteria ? (
          <section className="mt-5">
            <h3 className="text-[1.15rem] font-bold">Eligibility checklist</h3>
            {criteria.length === 0 ? (
              <p className="text-[1rem] text-tc-ink-2">No criteria checked yet.</p>
            ) : (
              <ul className="mt-2 text-[1rem]">
                {criteria.map((c) => (
                  <li key={c.id} className="flex gap-2 border-t border-tc-border py-2 first:border-t-0">
                    <CriterionIcon status={c.sensitive ? "unknown" : c.status} kind={c.kind} className="[&_svg]:size-5" />
                    <span>
                      {c.kind === "exclusion" ? "Exclusion: " : ""}
                      {c.text} — <span className="text-tc-ink-2">{c.sensitive ? "Not included" : statusWord(c.kind, c.status)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        <footer className="mt-6 border-t-2 border-tc-border pt-4 text-[0.95rem] text-tc-muted">
          Prepared by the patient using TrialCave on {today}. Not a medical record. The study team
          makes the final decision.
        </footer>
      </article>
    </div>
  );
}
