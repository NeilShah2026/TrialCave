"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { CRITERION_ICON } from "@/lib/match-status";
import type { CriterionResult } from "@/lib/matching/types";
import { answerQuestion, applyToStudy } from "../actions";

export interface DetailCriterion extends CriterionResult {
  evidenceLabel: string | null;
}

const SHARE_FIELDS: { key: string; label: string; defaultOn: boolean; sensitive?: boolean }[] = [
  { key: "first_name", label: "First name", defaultOn: true },
  { key: "email", label: "Email", defaultOn: true },
  { key: "age", label: "Age", defaultOn: true },
  { key: "sex", label: "Sex", defaultOn: true },
  { key: "town", label: "Town", defaultOn: true },
  { key: "condition_summary", label: "Condition summary", defaultOn: true },
  { key: "labs", label: "Lab results used by this study", defaultOn: true },
  { key: "last_name", label: "Last name", defaultOn: false },
  { key: "phone", label: "Phone", defaultOn: false },
  { key: "medications", label: "Medications used by this study", defaultOn: false },
  { key: "wearable_summary", label: "Wearable summary", defaultOn: false },
  { key: "reproductive_health", label: "Pregnancy/breastfeeding answers", defaultOn: false, sensitive: true },
];

function CriterionRow({ trialId, c }: { trialId: string; c: DetailCriterion }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function answer(a: "yes" | "no" | "unsure") {
    startTransition(async () => {
      const res = await answerQuestion(trialId, c.criterionId, a);
      if (res.ok) {
        toast.success("Updated.");
        router.refresh();
      }
    });
  }

  const showQuestion = c.status === "unknown" && c.patientQuestion && c.source !== "ai";

  return (
    <div className="flex gap-3 py-2">
      <span className="mt-0.5 shrink-0" aria-hidden>{CRITERION_ICON[c.status]}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {c.kind === "exclusion" && c.status === "pass" ? "Doesn't apply: " : ""}
          {c.plainText}
        </p>
        {c.reason ? <p className="text-sm text-muted-foreground">{c.reason}</p> : null}
        {c.source === "data" && c.evidenceLabel ? (
          <Badge variant="muted" className="mt-1">Your record · {c.evidenceLabel}</Badge>
        ) : c.source === "answer" ? (
          <Badge variant="muted" className="mt-1">Your answer</Badge>
        ) : c.source === "ai" ? (
          <Badge variant="secondary" className="mt-1">AI estimate</Badge>
        ) : null}

        {showQuestion ? (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-sm">{c.patientQuestion}</span>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => answer("yes")}>Yes</Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => answer("no")}>No</Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => answer("unsure")}>Not sure</Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function MatchDetailClient({
  trialId,
  isClinicStudy,
  inclusion,
  exclusion,
  logistics,
}: {
  trialId: string;
  isClinicStudy: boolean;
  inclusion: DetailCriterion[];
  exclusion: DetailCriterion[];
  logistics: DetailCriterion[];
}) {
  const router = useRouter();
  const [applyOpen, setApplyOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [shared, setShared] = useState<Record<string, boolean>>(
    Object.fromEntries(SHARE_FIELDS.map((f) => [f.key, f.defaultOn])),
  );
  const [phone, setPhone] = useState("");

  function submitApply() {
    const fields = Object.entries(shared).filter(([, v]) => v).map(([k]) => k);
    startTransition(async () => {
      const res = await applyToStudy(trialId, fields, phone || undefined);
      if (!res.ok) {
        toast.error(res.error ?? "Could not apply.");
        return;
      }
      toast.success("Sent to the study team. They'll contact you directly.");
      setApplyOpen(false);
      router.refresh();
    });
  }

  return (
    <div>
      <Card className="mt-4">
        <CardContent className="pt-6">
          <h2 className="text-lg font-semibold">Requirements</h2>
          <div className="mt-2 divide-y divide-border">
            {inclusion.map((c) => <CriterionRow key={c.criterionId} trialId={trialId} c={c} />)}
          </div>

          {exclusion.length > 0 ? (
            <>
              <h2 className="mt-6 text-lg font-semibold">Reasons you can&apos;t join</h2>
              <div className="mt-2 divide-y divide-border">
                {exclusion.map((c) => <CriterionRow key={c.criterionId} trialId={trialId} c={c} />)}
              </div>
            </>
          ) : null}

          {logistics.length > 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              The study team will check {logistics.length} more item{logistics.length > 1 ? "s" : ""}.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {isClinicStudy ? (
        <div className="mt-6">
          {!applyOpen ? (
            <Button onClick={() => setApplyOpen(true)}>Apply</Button>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <h2 className="text-lg font-semibold">Choose what to share</h2>
                <p className="text-sm text-muted-foreground">
                  The study team sees only what you pick. You can stop sharing anytime.
                </p>
                <div className="mt-3 space-y-2">
                  {SHARE_FIELDS.map((f) => (
                    <label key={f.key} className="flex items-center gap-3 text-sm">
                      <Checkbox checked={shared[f.key]} onCheckedChange={(v) => setShared((s) => ({ ...s, [f.key]: Boolean(v) }))} />
                      <span>{f.label}</span>
                      {f.sensitive ? <Badge variant="muted">Sensitive 🔒</Badge> : null}
                    </label>
                  ))}
                </div>
                {shared.phone ? (
                  <div className="mt-3">
                    <Input placeholder="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                ) : null}
                <div className="mt-4 flex gap-2">
                  <Button onClick={submitApply} disabled={pending}>
                    {pending ? "Sending…" : "Send application"}
                  </Button>
                  <Button variant="ghost" onClick={() => setApplyOpen(false)} disabled={pending}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : null}
    </div>
  );
}
