import Link from "next/link";
import { format } from "date-fns";
import { ArrowRight } from "lucide-react";

import { PatientNav } from "@/components/patient-nav";
import { PageBody, PageHero } from "@/components/page-hero";
import { PILL_VARIANT } from "@/components/match-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getMyPatient, getSessionUser } from "@/lib/auth";
import { loadAllChanges } from "@/lib/patient";
import { STATUS_LABEL } from "@/lib/match-status";
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
  return <Badge variant={PILL_VARIANT[s]}>{STATUS_LABEL[s]}</Badge>;
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
      <PageHero
        title="What changed"
        lede="Every time your profile changes, we re-check every trial and show what moved."
        width="narrow"
      />
      <PageBody width="narrow">
        {changes.length === 0 ? (
          <Card>
            <CardContent className="pt-8 text-center sm:pt-8">
              <p className="text-[1.05rem] text-tc-ink-2">No changes yet. Add a record or answer a question to see your matches update.</p>
              <Button asChild className="mt-4"><Link href="/app/records">Add a record</Link></Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-10">
            {[...groups.values()].map((rows) => (
              <section key={rows[0].id} aria-label={rows[0].triggerLabel}>
                <h2 className="flex flex-wrap items-center gap-2 text-[1.45rem] font-extrabold tracking-tight">
                  {rows[0].triggerLabel}
                  {rows.some((r) => !r.seenAt) ? <Badge variant="default">New</Badge> : null}
                </h2>
                <p className="mt-1 text-[0.95rem] text-tc-muted">
                  {format(new Date(rows[0].createdAt), "MMM d, yyyy")} · {rows.length} trial{rows.length === 1 ? "" : "s"} changed
                </p>
                <div className="mt-4 space-y-3">
                  {rows.slice(0, 25).map((c) => (
                    <Card key={c.id}>
                      <CardContent className="pt-6">
                        <Link href={`/app/matches/${c.trialId}`} className="text-[1.15rem] font-bold text-tc-ink hover:text-tc-primary-ink hover:underline">
                          {c.trialTitle}
                        </Link>
                        <p className="mt-3 flex flex-wrap items-center gap-2">
                          <StatusChip s={c.fromStatus} />
                          <ArrowRight className="size-5 text-tc-muted" aria-label="changed to" />
                          <StatusChip s={c.toStatus} />
                        </p>
                        {c.changedCriteria.length > 0 ? (
                          <ul className="mt-3">
                            {c.changedCriteria.slice(0, 4).map((cc) => (
                              <li key={cc.criterionId} className="border-t border-tc-border py-2 text-[1rem] text-tc-ink-2">
                                <span className="font-bold text-tc-ink">{cc.plainText}</span>:{" "}
                                {cc.from ? `${CRITERION_WORD[cc.from] ?? cc.from} → ` : ""}
                                {CRITERION_WORD[cc.to] ?? cc.to}
                                {cc.reason ? `. ${cc.reason}` : ""}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </CardContent>
                    </Card>
                  ))}
                  {rows.length > 25 ? (
                    <p className="text-[1rem] text-tc-ink-2">And {rows.length - 25} more. See them all in your matches.</p>
                  ) : null}
                </div>
              </section>
            ))}
          </div>
        )}
      </PageBody>
    </main>
  );
}
