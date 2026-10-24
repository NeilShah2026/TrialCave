"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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
      <CardContent className="p-6 text-center sm:p-10">
        <p className="mx-auto max-w-[36rem] text-[1.8rem] font-extrabold leading-tight tracking-tight text-tc-ink">{countText}</p>
        {!count.belowFloor && count.any ? (
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Badge variant="success" className="px-4 py-2 text-[0.95rem]">Strong {count.strong}</Badge>
            <Badge variant="warning" className="px-4 py-2 text-[0.95rem]">Possible {count.possible}</Badge>
          </div>
        ) : null}
        <p className="mx-auto mt-5 max-w-[34rem] text-[1.05rem] text-tc-ink-2">
          You won&apos;t see who they are. Invitations stay anonymous until each person approves.
          Declines are never identified.
        </p>
        {irbNumber || inviteMessage ? (
          <div className="mx-auto mt-6 max-w-[36rem] rounded-2xl bg-tc-mist p-5 text-left">
            {irbNumber ? (
              <p className="text-[0.95rem] font-bold text-tc-muted">Invitation text (IRB {irbNumber}):</p>
            ) : null}
            {inviteMessage ? (
              <p className="mt-1 text-[1.05rem] italic text-tc-ink">&ldquo;{inviteMessage}&rdquo;</p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-6">
          {!verified ? (
            <p className="mx-auto max-w-[36rem] rounded-2xl bg-tc-danger-soft px-5 py-4 font-semibold text-tc-danger-ink">Invitations are disabled until TrialCave verifies your clinic.</p>
          ) : !active ? (
            <p className="mx-auto max-w-[36rem] rounded-2xl bg-tc-warning-soft px-5 py-4 font-semibold text-tc-warning-ink">This study isn&apos;t active, so it can&apos;t send invitations.</p>
          ) : !count.any ? (
            <Button size="lg" disabled>No one to invite yet</Button>
          ) : !confirming ? (
            <Button size="lg" variant="secondary" onClick={() => setConfirming(true)}>
              Send invitations{count.belowFloor ? "" : ` to ${count.total} people`}
            </Button>
          ) : (
            <div
              role="alertdialog"
              aria-label="Confirm sending invitations"
              className="mx-auto flex max-w-[36rem] flex-wrap items-center justify-center gap-3 rounded-2xl bg-white p-5 shadow-pop"
            >
              <span className="w-full text-[1.1rem] font-bold text-tc-ink">Send the IRB-approved invitation?</span>
              <Button variant="secondary" onClick={send} disabled={pending}>{pending ? "Sending…" : "Confirm"}</Button>
              <Button variant="outline" onClick={() => setConfirming(false)} disabled={pending}>Cancel</Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
