"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { setStudyStatus } from "../../actions";

export function StudyStatusButton({ trialId, status }: { trialId: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const next = status === "active" ? "closed" : "active";

  function run() {
    startTransition(async () => {
      try {
        const res = await setStudyStatus(trialId, next);
        if (!res.ok) {
          toast.error(res.error ?? "Couldn't update the study.");
          return;
        }
        toast.success(next === "closed" ? "Study closed to new participants." : "Study reopened.");
        setConfirming(false);
        router.refresh();
      } catch {
        toast.error("Couldn't update the study. Try again.");
      }
    });
  }

  if (next === "closed" && confirming) {
    return (
      <span role="alertdialog" aria-label="Close this study?" className="flex flex-wrap items-center gap-2 text-sm">
        Close to new participants?
        <Button size="sm" variant="destructive" onClick={run} disabled={pending}>{pending ? "Closing…" : "Close study"}</Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>Cancel</Button>
      </span>
    );
  }

  return (
    <Button size="sm" variant="outline" disabled={pending} onClick={() => (next === "closed" ? setConfirming(true) : run())}>
      {next === "closed" ? "Close study" : pending ? "Reopening…" : "Reopen study"}
    </Button>
  );
}
