"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { OutreachCount } from "@/lib/outreach/eligible";
import { sendInvitations } from "../../actions";

export function FindParticipants({
  trialId,
  verified,
  active,
  inviteMessage,
  irbNumber,
  count,
}: {
  trialId: string;
  verified: boolean;
  active: boolean;
  inviteMessage: string;
  irbNumber: string | null;
  count: OutreachCount;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function send() {
    startTransition(async () => {
      try {
        const res = await sendInvitations(trialId);
        if (!res.ok) {
          toast.error(res.error ?? "Could not send invitations.");
          return;
        }
        // Don't echo an exact number back: it could reveal a small group.
        toast.success("Invitations sent. People will see them in their TrialCave inbox.");
        setConfirming(false);
        router.refresh();
      } catch {
        toast.error("Could not send invitations. Try again.");
      }
    });
  }

  const countText = !count.any
    ? "No one matches yet"
    : count.belowFloor
      ? `Fewer than ${count.floor} people near your site meet your criteria`
      : `${count.total} people near your site meet your criteria`;

  return (
    <Card>
      <CardContent className="pt-6 text-center">
        <p className="text-xl font-semibold">{countText}</p>
        {!count.belowFloor && count.any ? (
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
        {inviteMessage ? (
          <p className="mx-auto mt-1 max-w-md text-sm italic text-muted-foreground">&ldquo;{inviteMessage}&rdquo;</p>
        ) : null}

        <div className="mt-4">
          {!verified ? (
            <p className="text-sm text-tc-danger">Invitations are disabled until TrialCave verifies your clinic.</p>
          ) : !active ? (
            <p className="text-sm text-muted-foreground">This study isn&apos;t active, so it can&apos;t send invitations.</p>
          ) : !count.any ? (
            <Button disabled>No one to invite yet</Button>
          ) : !confirming ? (
            <Button onClick={() => setConfirming(true)}>
              Send invitations{count.belowFloor ? "" : ` to ${count.total} people`}
            </Button>
          ) : (
            <div role="alertdialog" aria-label="Confirm sending invitations" className="flex flex-wrap items-center justify-center gap-2">
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
