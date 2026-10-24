"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteMyAccount, deleteMyHealthData, rejoinResearch, withdrawFromResearch } from "./actions";

export function ResearchCard({ withdrawn, isDonor }: { withdrawn: boolean; isDonor: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      try {
        const res = await fn();
        if (!res.ok) {
          toast.error(res.error ?? "Something went wrong.");
          return;
        }
        toast.success(success);
        setConfirming(false);
        router.refresh();
      } catch {
        toast.error("Something went wrong. Try again.");
      }
    });
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="text-lg font-semibold">Withdraw from research</h2>
        {withdrawn ? (
          <>
            <p className="mt-1 text-sm text-muted-foreground">
              You&apos;ve withdrawn. Your data isn&apos;t used in any new Enclave analysis.
            </p>
            <Button
              variant="outline"
              className="mt-3"
              disabled={pending}
              onClick={() => run(rejoinResearch, "You can donate again. Turn on the kinds of research you want on the Donor page.")}
            >
              Rejoin research
            </Button>
          </>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted-foreground">
              Your data won&apos;t be used in any new analysis. Group results already produced
              can&apos;t be recalled. Matching and applying aren&apos;t affected.
              {!isDonor ? " You're not a Data Donor, so nothing is being used for research now." : ""}
            </p>
            {confirming ? (
              <div className="mt-3 flex flex-wrap gap-2" role="alertdialog" aria-label="Confirm withdrawal">
                <Button variant="destructive" disabled={pending} onClick={() => run(withdrawFromResearch, "Withdrawn from research.")}>
                  {pending ? "Withdrawing…" : "Yes, withdraw"}
                </Button>
                <Button variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>Cancel</Button>
              </div>
            ) : (
              <Button variant="outline" className="mt-3" onClick={() => setConfirming(true)}>Withdraw from research</Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ConfirmDelete({
  title,
  description,
  buttonLabel,
  action,
  onDone,
}: {
  title: string;
  description: string;
  buttonLabel: string;
  action: (text: string) => Promise<{ ok: boolean; error?: string } | void>;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const id = title.replace(/\W+/g, "-").toLowerCase();

  function submit() {
    startTransition(async () => {
      try {
        const res = await action(text);
        if (res && !res.ok) {
          toast.error(res.error ?? "Couldn't delete.");
          return;
        }
        onDone();
      } catch (e) {
        // A successful account deletion redirects; let that through.
        if (e && typeof e === "object" && "digest" in e) throw e;
        toast.error("Couldn't delete. Try again.");
      }
    });
  }

  return (
    <div className="rounded-md border border-border p-4">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      {!open ? (
        <Button variant="outline" className="mt-3 border-tc-danger/40 text-tc-danger" onClick={() => setOpen(true)}>
          {buttonLabel}
        </Button>
      ) : (
        <div className="mt-3 space-y-2" role="alertdialog" aria-labelledby={`${id}-label`}>
          <Label id={`${id}-label`} htmlFor={`${id}-input`}>
            Type DELETE to confirm. This can&apos;t be undone.
          </Label>
          <Input id={`${id}-input`} value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" className="max-w-[200px]" />
          <div className="flex gap-2">
            <Button variant="destructive" disabled={pending || text.trim() !== "DELETE"} onClick={submit}>
              {pending ? "Deleting…" : buttonLabel}
            </Button>
            <Button variant="ghost" disabled={pending} onClick={() => { setOpen(false); setText(""); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function DeleteDataCard() {
  const router = useRouter();
  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <h2 className="text-lg font-semibold">Delete</h2>
        <ConfirmDelete
          title="Delete my health data"
          description="Deletes your documents and files, health facts, device data, scans, answers, matches, and research choices, and withdraws open applications and invitations. We keep payment records and consent records, as the law requires."
          buttonLabel="Delete my health data"
          action={deleteMyHealthData}
          onDone={() => {
            toast.success("Your health data was deleted.");
            router.push("/app");
            router.refresh();
          }}
        />
        <ConfirmDelete
          title="Delete my account"
          description="Everything above, plus your login. Payment and consent records are kept with an anonymous id only."
          buttonLabel="Delete my account"
          action={deleteMyAccount}
          onDone={() => router.push("/")}
        />
      </CardContent>
    </Card>
  );
}
