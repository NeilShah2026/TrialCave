"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { reviewDocumentFacts, type FactDecision } from "../actions";

export interface ReviewFact {
  id: string;
  field: string | null;
  label: string;
  valueNum: number | null;
  valueBool: boolean | null;
  valueText: string | null;
  unit: string | null;
  sourceQuote: string;
  comparison: string;
  priorValue: string | null;
  sensitive: boolean;
  warning: string | null;
}

type Group = { key: string; title: string; facts: ReviewFact[] };

function displayValue(f: ReviewFact): string {
  if (f.valueBool !== null) return f.valueBool ? "Yes" : "No";
  if (f.valueNum !== null) return `${f.valueNum}${f.unit ? (f.unit === "%" ? "%" : ` ${f.unit}`) : ""}`;
  return f.valueText ?? "";
}

export function ReviewClient({
  documentId,
  facility,
  dateLabel,
  facts,
}: {
  documentId: string;
  facility: string;
  dateLabel: string;
  facts: ReviewFact[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Per-fact UI state: confirmed (checkbox) + optional edited value.
  const [state, setState] = useState<Record<string, { checked: boolean; edited: number | boolean | null }>>(
    Object.fromEntries(facts.map((f) => [f.id, { checked: true, edited: null }])),
  );
  const [editing, setEditing] = useState<string | null>(null);

  const groups: Group[] = [
    { key: "update", title: "Updates to your profile", facts: facts.filter((f) => f.comparison === "update") },
    { key: "new", title: "New", facts: facts.filter((f) => f.comparison === "new") },
    { key: "same", title: "Already in your profile", facts: facts.filter((f) => f.comparison === "same" || f.comparison === "older") },
    { key: "display_only", title: "Not used for matching (shown on your profile)", facts: facts.filter((f) => f.comparison === "display_only") },
  ].filter((g) => g.facts.length > 0);

  function toggle(id: string) {
    setState((s) => ({ ...s, [id]: { ...s[id], checked: !s[id].checked } }));
  }

  function saveEdit(f: ReviewFact, raw: string) {
    let edited: number | boolean | null = null;
    if (f.valueBool !== null) edited = raw.toLowerCase().startsWith("y");
    else if (f.valueNum !== null) {
      const n = Number(raw);
      edited = Number.isFinite(n) ? n : null;
    }
    setState((s) => ({ ...s, [f.id]: { ...s[f.id], edited } }));
    setEditing(null);
  }

  function confirmAll() {
    setState((s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, { ...v, checked: true }])));
  }

  function submit() {
    const decisions: FactDecision[] = facts.map((f) => {
      const st = state[f.id];
      const dec: FactDecision = { factId: f.id, decision: st.checked ? "confirm" : "reject" };
      if (st.edited !== null) {
        if (typeof st.edited === "number") dec.editValueNum = st.edited;
        if (typeof st.edited === "boolean") dec.editValueBool = st.edited;
      }
      return dec;
    });
    startTransition(async () => {
      const res = await reviewDocumentFacts(documentId, decisions);
      if (!res.ok) {
        toast.error(res.error ?? "Could not save.");
        return;
      }
      toast.success(
        res.changeCount > 0 ? "Saved. Your matches updated." : "Saved.",
      );
      router.push("/app?changes=open");
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{facility}</h1>
          <p className="text-sm text-muted-foreground">{dateLabel}</p>
        </div>
        <Button variant="outline" size="sm" onClick={confirmAll}>
          Confirm all
        </Button>
      </div>

      <p className="mt-2 text-sm text-muted-foreground">
        We found {facts.length} item{facts.length === 1 ? "" : "s"}. Check that each one looks
        right. Nothing is used until you confirm it. You can edit or uncheck anything.
      </p>

      <div className="mt-6 space-y-6">
        {groups.map((g) => (
          <div key={g.key}>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {g.title}
            </h2>
            <div className="mt-2 space-y-2">
              {g.facts.map((f) => {
                const st = state[f.id];
                const shownValue =
                  st.edited !== null
                    ? typeof st.edited === "boolean"
                      ? st.edited
                        ? "Yes"
                        : "No"
                      : String(st.edited)
                    : displayValue(f);
                return (
                  <Card key={f.id} className={st.checked ? "" : "opacity-60"}>
                    <CardContent className="flex items-start gap-3 py-3">
                      <input
                        type="checkbox"
                        checked={st.checked}
                        onChange={() => toggle(f.id)}
                        className="mt-1 size-4"
                        aria-label={`Confirm ${f.label}`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{f.label}</span>
                          <span className="text-foreground">{shownValue}</span>
                          {f.sensitive ? <Badge variant="muted">Sensitive · never shared unless you choose</Badge> : null}
                          {st.edited !== null ? <Badge variant="secondary">edited by you</Badge> : null}
                        </div>
                        {f.priorValue ? (
                          <p className="text-xs text-muted-foreground">was {f.priorValue}</p>
                        ) : null}
                        {f.warning ? (
                          <p className="text-xs text-tc-warning">{f.warning}</p>
                        ) : null}
                        <p className="mt-1 truncate text-xs italic text-muted-foreground">
                          &ldquo;{f.sourceQuote}&rdquo;
                        </p>
                        {editing === f.id ? (
                          <div className="mt-2 flex items-center gap-2">
                            <Input
                              autoFocus
                              defaultValue={f.valueBool !== null ? (f.valueBool ? "Yes" : "No") : f.valueNum ?? ""}
                              className="h-8 w-40"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveEdit(f, (e.target as HTMLInputElement).value);
                              }}
                              onBlur={(e) => saveEdit(f, e.target.value)}
                            />
                            <span className="text-xs text-muted-foreground">
                              {f.valueBool !== null ? "Yes / No" : f.unit ?? ""}
                            </span>
                          </div>
                        ) : null}
                      </div>
                      {f.comparison !== "display_only" ? (
                        <button
                          type="button"
                          onClick={() => setEditing(editing === f.id ? null : f.id)}
                          className="flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <Pencil className="size-3" /> Edit
                        </button>
                      ) : null}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex gap-3">
        <Button onClick={submit} disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          {pending ? "Saving…" : "Save & update my matches"}
        </Button>
      </div>
    </div>
  );
}
