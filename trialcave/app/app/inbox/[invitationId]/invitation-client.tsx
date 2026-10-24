"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SHARE_FIELDS, shareFieldLabel } from "@/lib/share-fields";
import { respondToInvitation, stopSharing } from "../actions";

const STATUS_TEXT: Record<string, string> = {
  declined: "You declined this invitation. The clinic only sees that someone declined, never who.",
  expired: "This invitation expired.",
  withdrawn: "You stopped sharing with this clinic. They no longer have access.",
};

export function InvitationClient({
  invitationId,
  status,
  clinicName,
  sharedFields,
}: {
  invitationId: string;
  status: string;
  clinicName: string;
  sharedFields: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [shared, setShared] = useState<Record<string, boolean>>(
    Object.fromEntries(SHARE_FIELDS.map((f) => [f.key, f.defaultOn])),
  );
  const [phone, setPhone] = useState("");
  const chosen = SHARE_FIELDS.filter((f) => shared[f.key]);
  const hasContact = Boolean(shared.email || shared.phone);

  function respond(decision: "approve" | "decline" | "mute") {
    startTransition(async () => {
      try {
        const res = await respondToInvitation(invitationId, decision, chosen.map((f) => f.key), phone || undefined);
        if (!res.ok) {
          toast.error(res.error ?? "Could not respond.");
          router.refresh();
          return;
        }
        toast.success(
          decision === "approve"
            ? `${clinicName} can now contact you.`
            : decision === "mute"
              ? `You won't see invitations from ${clinicName}. Undo this in Settings.`
              : "Declined. The clinic won't know it was you.",
        );
        router.push("/app/inbox");
        router.refresh();
      } catch {
        toast.error("Could not respond. Check your connection and try again.");
      }
    });
  }

  function stop() {
    startTransition(async () => {
      try {
        const res = await stopSharing(invitationId);
        if (!res.ok) {
          toast.error(res.error ?? "Couldn't stop sharing.");
          return;
        }
        toast.success("Stopped sharing. The clinic no longer has access.");
        router.refresh();
      } catch {
        toast.error("Couldn't stop sharing. Try again.");
      }
    });
  }

  if (status === "approved") {
    return (
      <div className="space-y-4">
        <p className="rounded-2xl bg-tc-success-soft px-5 py-4 text-[1.05rem] font-semibold text-tc-success-ink">
          You approved this invitation. {clinicName} can see:
        </p>
        <p className="text-[1.05rem] text-tc-ink-2">{sharedFields.map(shareFieldLabel).join(", ") || "nothing"}</p>
        <Button variant="outline" onClick={stop} disabled={pending}>
          {pending ? "Stopping…" : "Stop sharing"}
        </Button>
      </div>
    );
  }
  if (status !== "pending") {
    return (
      <p className="rounded-2xl bg-tc-mist px-5 py-4 text-[1.05rem] font-semibold text-tc-ink-2">
        {STATUS_TEXT[status] ?? `This invitation is ${status}.`}
      </p>
    );
  }

  return (
    <div>
      <h2 className="text-[1.45rem] font-extrabold tracking-tight">If you approve, they will see:</h2>
      <fieldset className="mt-4 grid gap-3 sm:grid-cols-2">
        <legend className="sr-only">Fields to share</legend>
        {SHARE_FIELDS.map((f) => (
          <label
            key={f.key}
            className="flex min-h-[3.25rem] cursor-pointer items-center gap-3 rounded-2xl border-2 border-tc-border px-4 py-3 text-[1.05rem] text-tc-ink has-[:checked]:border-tc-primary has-[[data-state=checked]]:border-tc-primary"
          >
            <Checkbox checked={Boolean(shared[f.key])} onCheckedChange={(v) => setShared((s) => ({ ...s, [f.key]: Boolean(v) }))} />
            <span className="font-semibold">{f.label}</span>
            {f.sensitive ? (
              <Badge variant="muted" className="ml-auto"><Lock className="size-3.5" aria-hidden /> Sensitive</Badge>
            ) : null}
          </label>
        ))}
      </fieldset>
      {shared.phone ? (
        <div className="mt-4 max-w-sm space-y-2">
          <Label htmlFor="invite-phone">Phone number</Label>
          <Input id="invite-phone" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
      ) : null}
      {!hasContact ? (
        <p className="mt-4 rounded-2xl bg-tc-danger-soft px-5 py-4 text-[1rem] font-semibold text-tc-danger-ink" role="alert">
          Pick email or phone so the clinic can reach you.
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        <Button size="lg" onClick={() => respond("approve")} disabled={pending || !hasContact}>
          {pending ? "Saving…" : "Approve & share"}
        </Button>
        <Button size="lg" variant="outline" onClick={() => respond("decline")} disabled={pending}>Not interested</Button>
        <Button variant="ghost" onClick={() => respond("mute")} disabled={pending}>Don&apos;t show invites from this clinic</Button>
      </div>
    </div>
  );
}
