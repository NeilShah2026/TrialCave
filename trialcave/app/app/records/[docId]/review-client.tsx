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
    { key: "same", title: "Already in your profile", facts: facts.filter((f) => f.comparison === "same") },
    { key: "older", title: "Older than what's in your profile (kept for your history)", facts: facts.filter((f) => f.comparison === "older") },
    { key: "display_only", title: "Not used for matching (shown on your profile)", facts: facts.filter((f) => f.comparison === "display_only") },
  ].filter((g) => g.facts.length > 0);

  const checkedCount = Object.values(state).filter((s) => s.checked).length;

  function toggle(id: string) {
    setState((s) => ({ ...s, [id]: { ...s[id], checked: !s[id].checked } }));
  }

  function setEdited(id: string, edited: number | boolean | null) {
    setState((s) => ({ ...s, [id]: { ...s[id], edited, checked: true } }));
    setEditing(null);
  }

  function saveNumber(f: ReviewFact, raw: string) {
    const trimmed = raw.trim();
    if (trimmed === "") {
      setEditing(null);
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n)) {
      toast.error("Enter a number.");
      return;
    }
    setEdited(f.id, n === f.valueNum ? null : n);
  }

  function submit(confirmEverything: boolean) {
    const decisions: FactDecision[] = facts.map((f) => {
      const st = state[f.id];
      const keep = confirmEverything || st.checked;
      const dec: FactDecision = { factId: f.id, decision: keep ? "confirm" : "reject" };
      if (st.edited !== null) {
        if (typeof st.edited === "number") dec.editValueNum = st.edited;
        if (typeof st.edited === "boolean") dec.editValueBool = st.edited;
      }
      return dec;
    });
    startTransition(async () => {
      try {
        const res = await reviewDocumentFacts(documentId, decisions);
        if (!res.ok) {
          toast.error(res.error ?? "Could not save.");
          return;
        }
        toast.success(res.changeCount > 0 ? "Saved. Your matches updated." : "Saved. Your profile is up to date.");
        router.push(res.changeCount > 0 ? "/app/changes" : "/app");
        router.refresh();
      } catch {
        toast.error("Could not save. Check your connection and try again.");
      }
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{facility}</h1>
          <p className="text-sm text-muted-foreground">{dateLabel}</p>
        </div>
      </div>

      <p className="mt-2 text-sm text-muted-foreground">
        We found {facts.length} item{facts.length === 1 ? "" : "s"}. Check that each one looks
        right. Nothing is used until you confirm it. Uncheck anything that&apos;s wrong, or edit it.
      </p>

      <div className="mt-6 space-y-6">
        {groups.map((g) => (
          <section key={g.key} aria-labelledby={`group-${g.key}`}>
            <h2 id={`group-${g.key}`} className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
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
                      : `${st.edited}${f.unit ? (f.unit === "%" ? "%" : ` ${f.unit}`) : ""}`
                    : displayValue(f);
                return (
                  <Card key={f.id} className={st.checked ? "" : "opacity-60"}>
                    <CardContent className="flex items-start gap-3 py-3">
                      <input
                        id={`fact-${f.id}`}
                        type="checkbox"
                        checked={st.checked}
                        onChange={() => toggle(f.id)}
                        className="mt-1 size-4 accent-[var(--tc-primary)]"
                        aria-label={`Use ${f.label}`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <label htmlFor={`fact-${f.id}`} className="font-medium">{f.label}</label>
                          <span className="text-foreground">{shownValue}</span>
                          {f.sensitive ? <Badge variant="muted">Sensitive · never shared unless you choose</Badge> : null}
                          {st.edited !== null ? <Badge variant="secondary">Edited by you</Badge> : null}
                          {!st.checked ? <Badge variant="muted">Won&apos;t be used</Badge> : null}
                        </div>
                        {f.priorValue ? (
                          <p className="text-xs text-muted-foreground">Your profile had {f.priorValue}</p>
                        ) : null}
                        {f.warning ? <p className="text-xs text-tc-warning">{f.warning}</p> : null}
                        {f.sourceQuote ? (
                          <p className="mt-1 break-words text-xs italic text-muted-foreground">
                            From the document: &ldquo;{f.sourceQuote}&rdquo;
                          </p>
                        ) : null}
                        {editing === f.id ? (
                          f.valueBool !== null ? (
                            <div className="mt-2 flex items-center gap-2" role="group" aria-label={`Edit ${f.label}`}>
                              <Button size="sm" variant="outline" onClick={() => setEdited(f.id, f.valueBool === true ? null : true)}>Yes</Button>
                              <Button size="sm" variant="outline" onClick={() => setEdited(f.id, f.valueBool === false ? null : false)}>No</Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                            </div>
                          ) : (
                            <div className="mt-2 flex items-center gap-2">
                              <Input
                                autoFocus
                                aria-label={`New value for ${f.label}`}
                                inputMode="decimal"
                                defaultValue={st.edited !== null ? String(st.edited) : f.valueNum ?? ""}
                                className="h-8 w-32"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") e.currentTarget.blur();
                                  if (e.key === "Escape") setEditing(null);
                                }}
                                onBlur={(e) => saveNumber(f, e.target.value)}
                              />
                              <span className="text-xs text-muted-foreground">{f.unit ?? ""}</span>
                            </div>
                          )
                        ) : null}
                      </div>
                      {f.comparison !== "display_only" && (f.valueNum !== null || f.valueBool !== null) ? (
                        <button
                          type="button"
                          onClick={() => setEditing(editing === f.id ? null : f.id)}
                          className="flex items-center gap-1 rounded text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          aria-label={`Edit ${f.label}`}
                        >
                          <Pencil className="size-3" aria-hidden /> Edit
                        </button>
                      ) : null}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button onClick={() => submit(false)} disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {pending ? "Saving…" : `Save ${checkedCount} of ${facts.length} & update my matches`}
        </Button>
        <Button variant="outline" onClick={() => submit(true)} disabled={pending}>
          Confirm all
        </Button>
      </div>
    </div>
  );
}
