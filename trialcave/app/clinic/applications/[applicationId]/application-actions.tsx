"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { updateApplicationStatus } from "../../actions";

const OPTIONS = [
  { value: "under_review", label: "Move to review", done: "Moved to review." },
  { value: "contacted", label: "Mark contacted", done: "Marked as contacted." },
  { value: "not_a_fit", label: "Not a fit", done: "Marked as not a fit." },
] as const;

export function ApplicationActions({ applicationId, current }: { applicationId: string; current: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function set(status: (typeof OPTIONS)[number]["value"], done: string) {
    startTransition(async () => {
      try {
        const res = await updateApplicationStatus(applicationId, status);
        if (!res.ok) {
          toast.error(res.error ?? "Could not update.");
          return;
        }
        toast.success(done);
        router.refresh();
      } catch {
        toast.error("Could not update. Try again.");
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Application status">
      {OPTIONS.map((o) => (
        <Button
          key={o.value}
          variant={current === o.value ? "default" : o.value === "not_a_fit" ? "ghost" : "outline"}
          aria-pressed={current === o.value}
          disabled={pending || current === o.value}
          onClick={() => set(o.value, o.done)}
        >
          {o.label}
        </Button>
      ))}
    </div>
  );
}
