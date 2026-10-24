"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Lock, Printer } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CriterionIcon } from "@/components/criterion-icon";
import { SHARE_FIELDS, shareFieldLabel } from "@/lib/share-fields";
import type { CriterionResult } from "@/lib/matching/types";
import { answerQuestion, applyToStudy, withdrawApplication } from "../actions";

export interface DetailCriterion extends CriterionResult {
  evidenceLabel: string | null;
}

export interface ApplicationState {
  status: string;
  sharedFields: string[];
}

const LAB_CATEGORIES = new Set(["lab", "vital"]);

function CriterionRow({
  trialId,
  c,
  showQuestion,
}: {
  trialId: string;
  c: DetailCriterion;
  showQuestion: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function answer(a: "yes" | "no" | "unsure") {
    startTransition(async () => {
      try {
        const res = await answerQuestion(trialId, c.criterionId, a);
        if (!res.ok) {
          toast.error(res.error ?? "Couldn't save your answer.");
          return;
        }
        toast.success(a === "unsure" ? "Noted. The study team can check this with you." : "Saved. Your match is updated.");
        router.refresh();
      } catch {
        toast.error("Couldn't save your answer. Check your connection and try again.");
      }
    });
  }

  const prefix =
    c.kind === "exclusion" ? (c.status === "pass" ? "Doesn't apply: " : c.status === "fail" ? "This rules you out: " : "") : "";
  const isLabUnknown = c.status === "unknown" && c.field && LAB_CATEGORIES.has(c.category) && !c.patientQuestion;

  return (
    <div className="flex gap-3 py-3">
      <CriterionIcon status={c.status} kind={c.kind} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {prefix}
          {c.plainText}
        </p>
        {c.reason ? <p className="text-sm text-muted-foreground">{c.reason}</p> : null}
        <div className="mt-1 flex flex-wrap gap-1">
          {c.source === "data" && c.evidenceLabel ? (
            <Badge variant="muted">Your record · {c.evidenceLabel}</Badge>
          ) : c.source === "data" ? (
            <Badge variant="muted">Your profile</Badge>
          ) : c.source === "answer" ? (
            <Badge variant="muted">Your answer</Badge>
          ) : c.source === "ai" ? (
            <Badge variant="secondary">AI estimate</Badge>
          ) : null}
        </div>

        {showQuestion && c.patientQuestion ? (
          <div className="mt-2 flex flex-wrap items-center gap-2" role="group" aria-label={c.patientQuestion}>
            <span className="text-sm">{c.patientQuestion}</span>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => answer("yes")}>Yes</Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => answer("no")}>No</Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => answer("unsure")}>Not sure</Button>
          </div>
        ) : null}
        {isLabUnknown ? (
          <Button asChild size="sm" variant="outline" className="mt-2">
            <Link href="/app/profile?tab=labs">Add lab result</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function ApplyPanel({
  trialId,
  clinicName,
  application,
}: {
  trialId: string;
  clinicName: string;
  application: ApplicationState | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [shared, setShared] = useState<Record<string, boolean>>(
    Object.fromEntries(SHARE_FIELDS.map((f) => [f.key, f.defaultOn])),
  );
  const [phone, setPhone] = useState("");
  const chosen = SHARE_FIELDS.filter((f) => shared[f.key]);
  const hasContact = shared.email || shared.phone;

  function submit() {
    startTransition(async () => {
      try {
        const res = await applyToStudy(trialId, chosen.map((f) => f.key), phone || undefined);
        if (!res.ok) {
          toast.error(res.error ?? "Could not apply.");
          return;
        }
        toast.success(`Sent to ${clinicName}. They'll contact you directly.`);
        setOpen(false);
        router.refresh();
      } catch {
        toast.error("Could not apply. Check your connection and try again.");
      }
    });
  }

  function withdraw() {
    startTransition(async () => {
      try {
        const res = await withdrawApplication(trialId);
        if (!res.ok) {
          toast.error(res.error ?? "Couldn't withdraw.");
          return;
        }
        toast.success("Application withdrawn. The study team no longer sees your details.");
        router.refresh();
      } catch {
        toast.error("Couldn't withdraw. Try again.");
      }
    });
  }

  if (application && application.status !== "withdrawn") {
    const statusText: Record<string, string> = {
      submitted: "Sent. Waiting for the study team.",
      under_review: "The study team is reviewing your application.",
      contacted: "The study team says they've contacted you.",
      not_a_fit: "The study team decided this study isn't a fit right now.",
    };
    return (
      <Card>
        <CardContent className="pt-6">
          <h2 className="text-lg font-semibold">Your application</h2>
          <p className="mt-1 text-sm">{statusText[application.status] ?? application.status}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Shared: {application.sharedFields.map(shareFieldLabel).join(", ") || "nothing"}
          </p>
          <Button variant="outline" className="mt-3" onClick={withdraw} disabled={pending}>
            {pending ? "Withdrawing…" : "Withdraw application"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => setOpen(true)}>Apply</Button>
        {application?.status === "withdrawn" ? (
          <span className="text-sm text-muted-foreground">You withdrew an earlier application. You can apply again.</span>
        ) : null}
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="text-lg font-semibold">Choose what to share with {clinicName}</h2>
        <p className="text-sm text-muted-foreground">
          The study team sees only what you pick. You can withdraw anytime.
        </p>
        <fieldset className="mt-3 space-y-2">
          <legend className="sr-only">Fields to share</legend>
          {SHARE_FIELDS.map((f) => (
            <label key={f.key} className="flex items-center gap-3 text-sm">
              <Checkbox
                checked={Boolean(shared[f.key])}
                onCheckedChange={(v) => setShared((s) => ({ ...s, [f.key]: Boolean(v) }))}
              />
              <span>{f.label}</span>
              {f.sensitive ? (
                <Badge variant="muted" className="gap-1"><Lock className="size-3" aria-hidden /> Sensitive</Badge>
              ) : null}
            </label>
          ))}
        </fieldset>
        {shared.phone ? (
          <div className="mt-3 max-w-xs space-y-1.5">
            <Label htmlFor="apply-phone">Phone number</Label>
            <Input id="apply-phone" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        ) : null}
        <div className="mt-4 rounded-md bg-muted/50 p-3 text-sm">
          <p className="font-medium">{clinicName} will see:</p>
          <p className="text-muted-foreground">{chosen.length ? chosen.map((f) => f.label).join(", ") : "Nothing yet"}</p>
          {!hasContact ? <p className="mt-1 text-tc-danger">Pick email or phone so they can reach you.</p> : null}
        </div>
        <div className="mt-4 flex gap-2">
          <Button onClick={submit} disabled={pending || !hasContact}>
            {pending ? "Sending…" : "Send application"}
          </Button>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function MatchDetailClient({
  trialId,
  isClinicStudy,
  clinicName,
  application,
  inclusion,
  exclusion,
  logistics,
  maxQuestions,
}: {
  trialId: string;
  isClinicStudy: boolean;
  clinicName: string;
  application: ApplicationState | null;
  inclusion: DetailCriterion[];
  exclusion: DetailCriterion[];
  logistics: DetailCriterion[];
  maxQuestions: number;
}) {
  const [showTeam, setShowTeam] = useState(false);

  // Show up to maxQuestions yes/no questions; vocabulary questions first since
  // one answer helps every trial.
  const askable = [...inclusion, ...exclusion]
    .filter((c) => c.status === "unknown" && c.patientQuestion && c.source !== "ai")
    .sort((a, b) => Number(Boolean(b.field)) - Number(Boolean(a.field)))
    .slice(0, maxQuestions);
  const askIds = new Set(askable.map((c) => c.criterionId));

  // Remaining unknowns without a question go in "The study team will check these".
  const teamChecks = [
    ...[...inclusion, ...exclusion].filter(
      (c) => c.status === "unknown" && !askIds.has(c.criterionId) && !(c.field && LAB_CATEGORIES.has(c.category)),
    ),
    ...logistics,
  ];
  const teamIds = new Set(teamChecks.map((c) => c.criterionId));
  const visibleInclusion = inclusion.filter((c) => !teamIds.has(c.criterionId));
  const visibleExclusion = exclusion.filter((c) => !teamIds.has(c.criterionId));

  return (
    <div>
      <Card className="mt-4">
        <CardContent className="pt-6">
          <h2 className="text-lg font-semibold">Requirements</h2>
          {visibleInclusion.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No requirements we can check from your profile.</p>
          ) : (
            <div className="mt-1 divide-y divide-border">
              {visibleInclusion.map((c) => (
                <CriterionRow key={c.criterionId} trialId={trialId} c={c} showQuestion={askIds.has(c.criterionId)} />
              ))}
            </div>
          )}

          {visibleExclusion.length > 0 ? (
            <>
              <h2 className="mt-6 text-lg font-semibold">Things that would rule you out</h2>
              <div className="mt-1 divide-y divide-border">
                {visibleExclusion.map((c) => (
                  <CriterionRow key={c.criterionId} trialId={trialId} c={c} showQuestion={askIds.has(c.criterionId)} />
                ))}
              </div>
            </>
          ) : null}

          {teamChecks.length > 0 ? (
            <div className="mt-4 border-t border-border pt-3">
              <button
                type="button"
                onClick={() => setShowTeam((s) => !s)}
                aria-expanded={showTeam}
                className="flex items-center gap-1 rounded text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <ChevronDown className={`size-4 transition-transform ${showTeam ? "rotate-180" : ""}`} aria-hidden />
                The study team will check these ({teamChecks.length})
              </button>
              {showTeam ? (
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {teamChecks.map((c) => (
                    <li key={c.criterionId} className="flex gap-2">
                      <CriterionIcon status={c.status} kind={c.kind} className="[&_svg]:size-4" />
                      <span>{c.kind === "exclusion" ? "Rules out: " : ""}{c.plainText}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="mt-6 flex flex-wrap items-start gap-3">
        {isClinicStudy ? (
          <div className="w-full">
            <ApplyPanel trialId={trialId} clinicName={clinicName} application={application} />
          </div>
        ) : null}
        <Button asChild variant="outline">
          <Link href={`/app/matches/${trialId}/summary`}>
            <Printer aria-hidden /> Pre-screen summary
          </Link>
        </Button>
      </div>
    </div>
  );
}
