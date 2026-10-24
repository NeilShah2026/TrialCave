"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { setHistoryFact } from "./records/actions";
import type { MissingItem } from "@/lib/matching/missingInfo";

export function MissingInfoList({ items }: { items: MissingItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function answer(field: string, value: boolean) {
    startTransition(async () => {
      const res = await setHistoryFact(field, value);
      if (res.ok) {
        toast.success(res.changeCount > 0 ? "Updated. Your matches changed." : "Updated.");
        router.refresh();
      }
    });
  }

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing outstanding. Nice work.</p>;
  }

  return (
    <ul className="space-y-3">
      {items.slice(0, 5).map((item) => (
        <li key={item.field} className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm">
            {item.action === "question" ? "❓" : "🧪"} {item.label}
            <span className="text-muted-foreground"> · {item.trialCount} trial{item.trialCount > 1 ? "s" : ""}</span>
          </span>
          {item.action === "question" ? (
            <span className="flex gap-1">
              <Button size="sm" variant="outline" disabled={pending} onClick={() => answer(item.field, true)}>Yes</Button>
              <Button size="sm" variant="outline" disabled={pending} onClick={() => answer(item.field, false)}>No</Button>
            </span>
          ) : (
            <Button asChild size="sm" variant="outline">
              <Link href="/app/profile?tab=labs">Add result</Link>
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
