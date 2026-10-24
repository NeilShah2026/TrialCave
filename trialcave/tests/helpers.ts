/**
 * Test helpers: turn demo persona definitions + demo studies into in-memory
 * fact maps and EvalCriterion arrays, so B9.9 can run without a database.
 */

import { PERSONAS, type Persona } from "@/lib/demo/personas";
import { DEMO_STUDIES, type DemoStudy } from "@/lib/demo/studies";
import { buildFactMapFromRows, type ConfirmedFact } from "@/lib/matching/facts";
import type { FactMap } from "@/lib/matching/facts";
import type { EvalCriterion } from "@/lib/matching/types";
import { isoDateAgo, birthDateForAge } from "@/lib/dates";

const TODAY = new Date();

function personaFactsToRows(p: Persona): ConfirmedFact[] {
  return p.facts.map((f, i) => ({
    id: `pf-${i}`,
    field: f.field,
    value_num: typeof f.value === "number" ? f.value : null,
    value_bool: typeof f.value === "boolean" ? f.value : null,
    value_text: typeof f.value === "string" ? f.value : null,
    unit: f.unit ?? null,
    observed_at: isoDateAgo(f.ago, TODAY),
    source: f.source,
    document_id: null,
  }));
}

export function personaFactMap(email: string, extraFacts: ConfirmedFact[] = []): FactMap {
  const p = PERSONAS.find((x) => x.email === email)!;
  const rows = [...personaFactsToRows(p), ...extraFacts];
  // currentFacts = latest per field (simple: last one wins per field here).
  const latest = new Map<string, ConfirmedFact>();
  for (const r of rows) {
    if (!r.field) continue;
    const prev = latest.get(r.field);
    if (!prev || (r.observed_at ?? "") >= (prev.observed_at ?? "")) latest.set(r.field, r);
  }
  return buildFactMapFromRows({
    patient: { id: "p1", date_of_birth: birthDateForAge(p.ageYears, TODAY), sex: p.sex },
    currentFacts: [...latest.values()],
    allConfirmedFacts: rows,
    connectedSources: p.connectedSources,
    wearableDays: p.wearable
      ? Array.from({ length: 30 }, (_, d) => ({
          day: isoDateAgo({ days: d }, TODAY),
          steps: p.wearable!.steps,
          time_in_range_pct: p.wearable!.timeInRangePct ?? null,
        }))
      : [],
    documents: [],
    today: TODAY,
  });
}

export function studyCriteria(title: string): EvalCriterion[] {
  const study: DemoStudy = DEMO_STUDIES.find((s) => s.title === title)!;
  return study.criteria.map((c, i) => ({
    id: `${title}-c${i}`,
    kind: c.kind,
    plainText: c.plainText,
    category: c.category,
    field: c.field,
    operator: c.operator,
    valueMin: c.valueMin,
    valueMax: c.valueMax,
    valueText: c.valueText,
    unit: c.unit,
    machineCheckable: c.field !== null && c.operator !== null,
    patientQuestion: c.question,
  }));
}

/** A fact row to simulate Maria's confirmed visit-summary update (HbA1c 8.4). */
export function hba1cFact(value: number): ConfirmedFact {
  return {
    id: "visit-hba1c",
    field: "hba1c_pct",
    value_num: value,
    value_bool: null,
    value_text: null,
    unit: "%",
    observed_at: isoDateAgo({ days: 4 }, TODAY),
    source: "document",
    document_id: null,
  };
}
