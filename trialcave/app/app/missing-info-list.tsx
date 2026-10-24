"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { HelpCircle, FlaskConical, FileText } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { setHistoryFact } from "./records/actions";
import type { MissingItem } from "@/lib/matching/missingInfo";

export function MissingInfoList({ items, limit = 5 }: { items: MissingItem[]; limit?: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyField, setBusyField] = useState<string | null>(null);
  // "Not sure" hides the question for now; the study team can check it later.
  const [skipped, setSkipped] = useState<Set<string>>(new Set());

  function answer(field: string, value: boolean) {
    setBusyField(field);
    startTransition(async () => {
      try {
        const res = await setHistoryFact(field, value);
        if (!res.ok) {
          toast.error(res.error ?? "Couldn't save your answer.");
          return;
        }
        toast.success(res.changeCount > 0 ? `Saved. ${res.changeCount} match${res.changeCount === 1 ? "" : "es"} changed.` : "Saved.");
        router.refresh();
      } catch {
        toast.error("Couldn't save your answer. Check your connection and try again.");
      } finally {
        setBusyField(null);
      }
    });
  }

  function notSure(field: string) {
    setSkipped((s) => new Set(s).add(field));
    toast.message("No problem. The study team can check this with you.");
  }

  const visible = items.filter((i) => !skipped.has(i.field)).slice(0, limit);

  if (visible.length === 0) {
    return <p className="rounded-2xl bg-tc-mist px-5 py-4 text-[1rem] text-tc-ink-2">Nothing outstanding right now.</p>;
  }

  return (
    <ul className="space-y-3">
      {visible.map((item) => {
        const Icon = item.action === "question" ? HelpCircle : item.action === "add_lab" ? FlaskConical : FileText;
        const busy = pending && busyField === item.field;
        return (
          <li key={item.field} className="rounded-2xl bg-tc-mist p-4">
            <span className="flex min-w-0 items-start gap-3 text-[1.05rem] font-semibold text-tc-ink">
              <Icon className="mt-0.5 size-5 shrink-0 text-tc-warning" aria-hidden />
              <span>
                {item.action === "question" && item.question ? item.question : item.label}
                <span className="block text-[0.95rem] font-normal text-tc-muted">
                  Helps check {item.trialCount} trial{item.trialCount === 1 ? "" : "s"}
                </span>
              </span>
            </span>
            <div className="mt-3 pl-8">
              {item.action === "question" ? (
                <span className="flex flex-wrap gap-2" role="group" aria-label={item.label}>
                  <Button size="sm" variant="outline" disabled={pending} aria-busy={busy} onClick={() => answer(item.field, true)}>
                    Yes
                  </Button>
                  <Button size="sm" variant="outline" disabled={pending} aria-busy={busy} onClick={() => answer(item.field, false)}>
                    No
                  </Button>
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => notSure(item.field)}>
                    Not sure
                  </Button>
                </span>
              ) : item.action === "add_lab" ? (
                <Button asChild size="sm" variant="outline">
                  <Link href="/app/profile?tab=labs">Add result</Link>
                </Button>
              ) : (
                <Button asChild size="sm" variant="outline">
                  <Link href="/app/records">Add a record</Link>
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
