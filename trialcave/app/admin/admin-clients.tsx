"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { verifyClinic, setProjectStatus, resyncTrials, parsePending, resetDemo } from "./actions";

export function VerifyClinicButton({ clinicId, verified }: { clinicId: string; verified: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant={verified ? "outline" : "default"}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await verifyClinic(clinicId, !verified);
          toast.success(verified ? "Clinic unverified." : "Clinic verified.");
          router.refresh();
        })
      }
    >
      {verified ? "Unverify" : "Verify"}
    </Button>
  );
}

export function ProjectDecisionButtons({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function decide(status: "approved" | "rejected") {
    startTransition(async () => {
      await setProjectStatus(projectId, status);
      toast.success(status === "approved" ? "Project approved." : "Project rejected.");
      router.refresh();
    });
  }
  return (
    <span className="flex gap-2">
      <Button size="sm" disabled={pending} onClick={() => decide("approved")}>Approve</Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => decide("rejected")}>Reject</Button>
    </span>
  );
}

export function TrialAdminButtons() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await resyncTrials();
            if (res.ok) toast.success(`Synced ${res.fetched} trials.`);
            else toast.error(res.error ?? "Sync failed.");
            router.refresh();
          })
        }
      >
        Re-sync now
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await parsePending();
            toast.success(`Parsed ${res.parsed}, failed ${res.failed}.`);
            router.refresh();
          })
        }
      >
        Parse pending (10)
      </Button>
    </div>
  );
}

export function ResetDemoButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  function reset() {
    startTransition(async () => {
      const res = await resetDemo();
      if (res.ok) toast.success("Demo reset.");
      else toast.error(res.error ?? "Reset failed.");
      setConfirming(false);
      router.refresh();
    });
  }
  if (!confirming) {
    return <Button variant="destructive" onClick={() => setConfirming(true)}>Reset demo</Button>;
  }
  return (
    <span className="flex items-center gap-2">
      <span className="text-sm">This wipes and reseeds all demo data. Sure?</span>
      <Button size="sm" variant="destructive" disabled={pending} onClick={reset}>{pending ? "Resetting…" : "Confirm reset"}</Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>Cancel</Button>
    </span>
  );
}
