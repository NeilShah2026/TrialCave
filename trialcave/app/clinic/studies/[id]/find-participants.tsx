"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { sendInvitations } from "../../actions";

export function FindParticipants({
  trialId,
  verified,
  inviteMessage,
  irbNumber,
  count,
}: {
  trialId: string;
  verified: boolean;
  inviteMessage: string;
  irbNumber: string | null;
  count: { total: number; strong: number; possible: number; belowFloor: boolean };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function send() {
    startTransition(async () => {
      const res = await sendInvitations(trialId);
      if (!res.ok) {
        toast.error(res.error ?? "Could not send invitations.");
        return;
      }
      toast.success(`Invitations sent to ${res.sent} people.`);
      setConfirming(false);
      router.refresh();
    });
  }

  const countText = count.belowFloor
    ? "Fewer than 5 people"
    : `${count.total} people near your site meet your criteria`;

  return (
    <Card>
      <CardContent className="pt-6 text-center">
        <p className="text-xl font-semibold">{countText}</p>
        {!count.belowFloor ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Strong {count.strong} · Possible {count.possible}
          </p>
        ) : null}
        <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
          You won&apos;t see who they are. Invitations stay anonymous until each person approves.
          Declines are never identified.
        </p>
        {irbNumber ? (
          <p className="mt-3 text-xs text-muted-foreground">Invitation text (IRB {irbNumber}):</p>
        ) : null}
        <p className="mx-auto mt-1 max-w-md text-sm italic text-muted-foreground">&ldquo;{inviteMessage}&rdquo;</p>

        <div className="mt-4">
          {!verified ? (
            <p className="text-sm text-tc-danger">Invitations are disabled until TrialCave verifies your clinic.</p>
          ) : count.total === 0 ? (
            <Button disabled>No one to invite yet</Button>
          ) : !confirming ? (
            <Button onClick={() => setConfirming(true)}>
              Send invitations{count.belowFloor ? "" : ` to ${count.total} people`}
            </Button>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <span className="text-sm">Send the IRB-approved invitation?</span>
              <Button size="sm" onClick={send} disabled={pending}>{pending ? "Sending…" : "Confirm"}</Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>Cancel</Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
