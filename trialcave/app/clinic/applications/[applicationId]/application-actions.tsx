"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { updateApplicationStatus } from "../../actions";

export function ApplicationActions({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function set(status: "under_review" | "contacted" | "not_a_fit") {
    startTransition(async () => {
      const res = await updateApplicationStatus(applicationId, status);
      if (res.ok) {
        toast.success("Updated.");
        router.refresh();
      } else {
        toast.error("Could not update.");
      }
    });
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" disabled={pending} onClick={() => set("under_review")}>Move to review</Button>
      <Button variant="outline" disabled={pending} onClick={() => set("contacted")}>Mark contacted</Button>
      <Button variant="ghost" disabled={pending} onClick={() => set("not_a_fit")}>Not a fit</Button>
    </div>
  );
}
