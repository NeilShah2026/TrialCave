"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { verifyClinic, setIrbOnFile, setProjectStatus, resyncTrials, parsePending, resetDemo } from "./actions";

/** Shared runner: awaits a server action, shows a toast, refreshes. */
function useRunner() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function run<T extends { ok: boolean; error?: string }>(fn: () => Promise<T>, success: (r: T) => string, after?: () => void) {
    startTransition(async () => {
      try {
        const res = await fn();
        if (!res.ok) {
          toast.error(res.error ?? "Something went wrong.");
          return;
        }
        toast.success(success(res));
        after?.();
        router.refresh();
      } catch {
        toast.error("Something went wrong. Try again.");
      }
    });
  }
  return { pending, run };
}

export function VerifyClinicButton({ clinicId, verified }: { clinicId: string; verified: boolean }) {
  const { pending, run } = useRunner();
  return (
    <Button
      size="sm"
      variant={verified ? "outline" : "default"}
      disabled={pending}
      onClick={() => run(() => verifyClinic(clinicId, !verified), () => (verified ? "Clinic unverified. Pending invitations were withdrawn." : "Clinic verified."))}
    >
      {pending ? "Saving…" : verified ? "Unverify" : "Verify"}
    </Button>
  );
}

export function IrbToggle({ clinicId, onFile }: { clinicId: string; onFile: boolean }) {
  const { pending, run } = useRunner();
  return (
    <Button size="sm" variant="outline" disabled={pending} aria-pressed={onFile} className={onFile ? "border-tc-success-soft bg-tc-success-soft text-tc-success-ink" : undefined} onClick={() => run(() => setIrbOnFile(clinicId, !onFile), () => (onFile ? "IRB letter marked missing." : "IRB letter marked on file."))}>
      IRB on file: {onFile ? "Yes" : "No"}
    </Button>
  );
}

export function ProjectDecisionButtons({ projectId, status }: { projectId: string; status: string }) {
  const { pending, run } = useRunner();
  return (
    <span className="flex flex-wrap gap-2">
      {status !== "approved" ? (
        <Button size="sm" disabled={pending} onClick={() => run(() => setProjectStatus(projectId, "approved"), () => "Project approved.")}>Approve</Button>
      ) : null}
      {status !== "rejected" ? (
        <Button size="sm" variant="outline" className="hover:border-tc-danger-ink hover:text-tc-danger-ink" disabled={pending} onClick={() => run(() => setProjectStatus(projectId, "rejected"), () => (status === "approved" ? "Project access revoked." : "Project rejected."))}>
          {status === "approved" ? "Revoke" : "Reject"}
        </Button>
      ) : null}
    </span>
  );
}

export function TrialAdminButtons({ aiAvailable }: { aiAvailable: boolean }) {
  const { pending, run } = useRunner();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="outline" disabled={pending} onClick={() => run(resyncTrials, (r) => `Synced ${r.fetched} trials from ClinicalTrials.gov.`)}>
        {pending ? "Working…" : "Re-sync now"}
      </Button>
      <Button
        variant="outline"
        disabled={pending || !aiAvailable}
        title={aiAvailable ? undefined : "Needs ANTHROPIC_API_KEY"}
        onClick={() => run(parsePending, (r) => `Parsed ${r.parsed}, failed ${r.failed}.`)}
      >
        Parse pending (10)
      </Button>
      {!aiAvailable ? <span className="text-[0.95rem] text-tc-muted">Parsing needs an Anthropic API key.</span> : null}
    </div>
  );
}

export function ResetDemoButton({ enabled }: { enabled: boolean }) {
  const { pending, run } = useRunner();
  const [confirming, setConfirming] = useState(false);
  if (!enabled) return <p className="rounded-2xl bg-tc-mist px-5 py-4 font-semibold text-tc-ink-2">Reset is only available in demo mode.</p>;
  if (!confirming) {
    return <Button variant="destructive" onClick={() => setConfirming(true)}>Reset demo</Button>;
  }
  return (
    <div role="alertdialog" aria-label="Confirm demo reset" className="flex max-w-[40rem] flex-wrap items-center gap-3 rounded-2xl border-2 border-tc-danger-soft bg-white p-5 shadow-pop">
      <span className="w-full text-[1.05rem] font-bold text-tc-danger-ink">This wipes and reseeds all demo data. It can take a minute. Sure?</span>
      <Button variant="destructive" disabled={pending} onClick={() => run(resetDemo, () => "Demo reset.", () => setConfirming(false))}>
        {pending ? "Resetting…" : "Confirm reset"}
      </Button>
      <Button variant="outline" disabled={pending} onClick={() => setConfirming(false)}>Cancel</Button>
    </div>
  );
}
