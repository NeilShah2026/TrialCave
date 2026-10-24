"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { respondToInvitation, stopSharing } from "../actions";

const SHARE_FIELDS: { key: string; label: string; defaultOn: boolean; sensitive?: boolean }[] = [
  { key: "first_name", label: "First name", defaultOn: true },
  { key: "email", label: "Email", defaultOn: true },
  { key: "age", label: "Age", defaultOn: true },
  { key: "sex", label: "Sex", defaultOn: true },
  { key: "town", label: "Town", defaultOn: true },
  { key: "condition_summary", label: "Condition summary", defaultOn: true },
  { key: "labs", label: "Lab results", defaultOn: true },
  { key: "last_name", label: "Last name", defaultOn: false },
  { key: "phone", label: "Phone", defaultOn: false },
  { key: "medications", label: "Medications", defaultOn: false },
  { key: "wearable_summary", label: "Wearable summary", defaultOn: false },
  { key: "reproductive_health", label: "Pregnancy/breastfeeding answers", defaultOn: false, sensitive: true },
];

export function InvitationClient({ invitationId, status }: { invitationId: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [shared, setShared] = useState<Record<string, boolean>>(
    Object.fromEntries(SHARE_FIELDS.map((f) => [f.key, f.defaultOn])),
  );
  const [phone, setPhone] = useState("");

  function respond(decision: "approve" | "decline" | "mute") {
    const fields = Object.entries(shared).filter(([, v]) => v).map(([k]) => k);
    startTransition(async () => {
      const res = await respondToInvitation(invitationId, decision, fields, phone || undefined);
      if (!res.ok) {
        toast.error(res.error ?? "Could not respond.");
        return;
      }
      toast.success(decision === "approve" ? "The clinic can now contact you." : "Done.");
      router.push("/app/inbox");
      router.refresh();
    });
  }

  function stop() {
    startTransition(async () => {
      await stopSharing(invitationId);
      toast.success("Stopped sharing. The clinic no longer has access.");
      router.refresh();
    });
  }

  if (status === "approved") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">You approved this invitation. The clinic can see the fields you shared.</p>
        <Button variant="outline" onClick={stop} disabled={pending}>Stop sharing</Button>
      </div>
    );
  }
  if (status !== "pending") {
    return <p className="text-sm text-muted-foreground">This invitation is {status}.</p>;
  }

  return (
    <div>
      <h3 className="text-sm font-semibold">If you approve, they will see:</h3>
      <div className="mt-2 space-y-2">
        {SHARE_FIELDS.map((f) => (
          <label key={f.key} className="flex items-center gap-3 text-sm">
            <Checkbox checked={shared[f.key]} onCheckedChange={(v) => setShared((s) => ({ ...s, [f.key]: Boolean(v) }))} />
            <span>{f.label}</span>
            {f.sensitive ? <Badge variant="muted">Sensitive 🔒</Badge> : null}
          </label>
        ))}
      </div>
      {shared.phone ? <Input className="mt-3" placeholder="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} /> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={() => respond("approve")} disabled={pending}>Approve &amp; share</Button>
        <Button variant="outline" onClick={() => respond("decline")} disabled={pending}>Not interested</Button>
        <Button variant="ghost" onClick={() => respond("mute")} disabled={pending}>Don&apos;t show invites from this clinic</Button>
      </div>
    </div>
  );
}
