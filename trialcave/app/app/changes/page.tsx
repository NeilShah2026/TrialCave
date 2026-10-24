import Link from "next/link";
import { format } from "date-fns";
import { ArrowRight } from "lucide-react";

import { PatientNav } from "@/components/patient-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getMyPatient, getSessionUser } from "@/lib/auth";
import { loadAllChanges } from "@/lib/patient";
import { STATUS_LABEL, STATUS_VARIANT } from "@/lib/match-status";
import type { MatchStatus } from "@/lib/matching/types";
import { MarkSeen } from "./mark-seen";

export const dynamic = "force-dynamic";
export const metadata = { title: "What changed" };

const CRITERION_WORD: Record<string, string> = {
  pass: "met",
  fail: "not met",
  unknown: "unknown",
  na: "checked by the study team",
};

function StatusChip({ s }: { s: MatchStatus | null }) {
  if (!s) return <Badge variant="muted">Not listed</Badge>;
  return <Badge variant={STATUS_VARIANT[s]}>{STATUS_LABEL[s]}</Badge>;
}

export default async function ChangesPage() {
  const user = await getSessionUser();
  const patient = await getMyPatient();
  const changes = await loadAllChanges(patient.id);
  const unseenIds = changes.filter((c) => !c.seenAt).map((c) => c.id);

  // Group by trigger + day (keep newest-first order).
  const groups = new Map<string, typeof changes>();
  for (const c of changes) {
    const key = `${c.triggerLabel}__${format(new Date(c.createdAt), "yyyy-MM-dd")}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c);
  }

  return (
    <main className="flex-1">
      <PatientNav email={user?.email ?? ""} />
      {unseenIds.length ? <MarkSeen ids={unseenIds} /> : null}
      <div className="mx-auto max-w-[800px] px-4 py-8">
        <h1 className="text-2xl font-semibold">What changed</h1>
        <p className="mt-1 text-muted-foreground">Every time your profile changes, we re-check every trial and show what moved.</p>
        {changes.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-border bg-card p-8 text-center text-muted-foreground">
            <p>No changes yet. Add a record or answer a question to see your matches update.</p>
            <Button asChild size="sm" className="mt-3"><Link href="/app/records">Add a record</Link></Button>
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {[...groups.values()].map((rows) => (
              <section key={rows[0].id} aria-label={rows[0].triggerLabel}>
                <h2 className="font-medium">
                  {rows[0].triggerLabel}
                  {rows.some((r) => !r.seenAt) ? <Badge className="ml-2" variant="default">New</Badge> : null}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(rows[0].createdAt), "MMM d, yyyy")} · {rows.length} trial{rows.length === 1 ? "" : "s"} changed
                </p>
                <div className="mt-2 space-y-2">
                  {rows.slice(0, 25).map((c) => (
                    <Card key={c.id}>
                      <CardContent className="py-4">
                        <Link href={`/app/matches/${c.trialId}`} className="font-medium hover:underline">
                          {c.trialTitle}
                        </Link>
                        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                          <StatusChip s={c.fromStatus} />
                          <ArrowRight className="size-4 text-muted-foreground" aria-label="changed to" />
                          <StatusChip s={c.toStatus} />
                        </p>
                        {c.changedCriteria.slice(0, 4).map((cc) => (
                          <p key={cc.criterionId} className="mt-1 text-sm text-muted-foreground">
                            <span className="text-foreground">{cc.plainText}</span>:{" "}
                            {cc.from ? `${CRITERION_WORD[cc.from] ?? cc.from} → ` : ""}
                            {CRITERION_WORD[cc.to] ?? cc.to}
                            {cc.reason ? `. ${cc.reason}` : ""}
                          </p>
                        ))}
                      </CardContent>
                    </Card>
                  ))}
                  {rows.length > 25 ? (
                    <p className="text-sm text-muted-foreground">And {rows.length - 25} more. See them all in your matches.</p>
                  ) : null}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
