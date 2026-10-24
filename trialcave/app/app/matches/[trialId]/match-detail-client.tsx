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

  const highlighted = showQuestion && Boolean(c.patientQuestion);

  return (
    <div className={`flex gap-3 border-t border-tc-border py-4 first:border-t-0 ${highlighted ? "my-1 rounded-xl border-t-0 bg-tc-primary-soft px-4" : ""}`}>
      <CriterionIcon status={c.status} kind={c.kind} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="text-[1.05rem] font-bold text-tc-ink">
          {prefix}
          {c.plainText}
        </p>
        {c.reason ? <p className="mt-0.5 text-[1rem] text-tc-ink-2">{c.reason}</p> : null}
        <div className="mt-2 flex flex-wrap gap-1.5">
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
          <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label={c.patientQuestion}>
            <span className="w-full text-[1.05rem] font-semibold text-tc-ink">{c.patientQuestion}</span>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => answer("yes")}>Yes</Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => answer("no")}>No</Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => answer("unsure")}>Not sure</Button>
          </div>
        ) : null}
        {isLabUnknown ? (
          <Button asChild size="sm" variant="outline" className="mt-3">
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
        <CardContent className="pt-6 sm:pt-7">
          <h2 className="text-[1.45rem] font-extrabold tracking-tight">Your application</h2>
          <p className="mt-3 rounded-2xl bg-tc-primary-soft px-5 py-4 text-[1.05rem] font-semibold text-tc-primary-ink">
            {statusText[application.status] ?? application.status}
          </p>
          <p className="mt-3 text-[1rem] text-tc-ink-2">
            Shared: {application.sharedFields.map(shareFieldLabel).join(", ") || "nothing"}
          </p>
          <Button variant="outline" className="mt-4" onClick={withdraw} disabled={pending}>
            {pending ? "Withdrawing…" : "Withdraw application"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!open) {
    return (
      <div className="on-dark flex flex-wrap items-center justify-between gap-4 rounded-[26px] bg-tc-night p-7 text-white">
        <div>
          <p className="text-[1.15rem] font-bold">Interested in this study?</p>
          {application?.status === "withdrawn" ? (
            <p className="mt-1 text-[1rem] text-tc-night-text">You withdrew an earlier application. You can apply again.</p>
          ) : null}
        </div>
        <Button variant="mint" size="lg" onClick={() => setOpen(true)}>Apply</Button>
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6 sm:pt-7">
        <h2 className="text-[1.45rem] font-extrabold tracking-tight">Choose what to share with {clinicName}</h2>
        <p className="mt-1 text-[1.05rem] text-tc-ink-2">
          The study team sees only what you pick. You can withdraw anytime.
        </p>
        <fieldset className="mt-4 grid gap-3 sm:grid-cols-2">
          <legend className="sr-only">Fields to share</legend>
          {SHARE_FIELDS.map((f) => (
            <label
              key={f.key}
              className="flex min-h-[3.25rem] cursor-pointer items-center gap-3 rounded-2xl border-2 border-tc-border px-4 py-3 text-[1.05rem] text-tc-ink has-[[data-state=checked]]:border-tc-primary"
            >
              <Checkbox
                checked={Boolean(shared[f.key])}
                onCheckedChange={(v) => setShared((s) => ({ ...s, [f.key]: Boolean(v) }))}
              />
              <span className="font-semibold">{f.label}</span>
              {f.sensitive ? (
                <Badge variant="muted" className="ml-auto"><Lock className="size-3.5" aria-hidden /> Sensitive</Badge>
              ) : null}
            </label>
          ))}
        </fieldset>
        {shared.phone ? (
          <div className="mt-4 max-w-sm space-y-2">
            <Label htmlFor="apply-phone">Phone number</Label>
            <Input id="apply-phone" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        ) : null}
        <div className="mt-5 rounded-2xl bg-tc-mist p-5 text-[1.05rem]">
          <p className="font-bold text-tc-ink">{clinicName} will see:</p>
          <p className="mt-1 text-tc-ink-2">{chosen.length ? chosen.map((f) => f.label).join(", ") : "Nothing yet"}</p>
          {!hasContact ? (
            <p className="mt-3 rounded-xl bg-tc-danger-soft px-4 py-3 font-semibold text-tc-danger-ink" role="alert">
              Pick email or phone so they can reach you.
            </p>
          ) : null}
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button size="lg" onClick={submit} disabled={pending || !hasContact}>
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
      <Card>
        <CardContent className="pt-6 sm:pt-7">
          <h2 className="text-[1.45rem] font-extrabold tracking-tight">Requirements</h2>
          {visibleInclusion.length === 0 ? (
            <p className="mt-3 rounded-2xl bg-tc-mist px-5 py-4 text-[1rem] text-tc-ink-2">No requirements we can check from your profile.</p>
          ) : (
            <div className="mt-2">
              {visibleInclusion.map((c) => (
                <CriterionRow key={c.criterionId} trialId={trialId} c={c} showQuestion={askIds.has(c.criterionId)} />
              ))}
            </div>
          )}

          {visibleExclusion.length > 0 ? (
            <>
              <h2 className="mt-8 text-[1.45rem] font-extrabold tracking-tight">Things that would rule you out</h2>
              <div className="mt-2">
                {visibleExclusion.map((c) => (
                  <CriterionRow key={c.criterionId} trialId={trialId} c={c} showQuestion={askIds.has(c.criterionId)} />
                ))}
              </div>
            </>
          ) : null}

          {teamChecks.length > 0 ? (
            <div className="mt-6 border-t border-tc-border pt-4">
              <button
                type="button"
                onClick={() => setShowTeam((s) => !s)}
                aria-expanded={showTeam}
                className="flex min-h-11 items-center gap-2 rounded-lg text-[1rem] font-bold text-tc-primary-ink hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-tc-primary-soft"
              >
                <ChevronDown className={`size-5 transition-transform ${showTeam ? "rotate-180" : ""}`} aria-hidden />
                The study team will check these ({teamChecks.length})
              </button>
              {showTeam ? (
                <ul className="mt-2 space-y-2 rounded-2xl bg-tc-mist p-4 text-[1rem] text-tc-ink-2">
                  {teamChecks.map((c) => (
                    <li key={c.criterionId} className="flex gap-2">
                      <CriterionIcon status={c.status} kind={c.kind} className="[&_svg]:size-5" />
                      <span>{c.kind === "exclusion" ? "Rules out: " : ""}{c.plainText}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="mt-6 flex flex-wrap items-start gap-4">
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
