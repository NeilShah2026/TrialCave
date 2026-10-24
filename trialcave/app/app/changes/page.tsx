import Link from "next/link";
import { format } from "date-fns";

import { PatientNav } from "@/components/patient-nav";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getMyPatient, getSessionUser } from "@/lib/auth";
import { loadAllChanges } from "@/lib/patient";
import { createAdminClient } from "@/lib/supabase/admin";
import { STATUS_LABEL } from "@/lib/match-status";
import type { MatchStatus } from "@/lib/matching/types";

export const dynamic = "force-dynamic";

function statusText(s: MatchStatus | null): string {
  return s ? STATUS_LABEL[s] : "No longer listed";
}

export default async function ChangesPage() {
  const user = await getSessionUser();
  const patient = await getMyPatient();
  const changes = await loadAllChanges(patient.id);

  // Mark all as seen on open (B9.7).
  const admin = createAdminClient();
  await admin
    .from("match_changes")
    .update({ seen_at: new Date().toISOString() })
    .eq("patient_id", patient.id)
    .is("seen_at", null);

  // Group by trigger label (keep order).
  const groups = new Map<string, typeof changes>();
  for (const c of changes) {
    const key = `${c.triggerLabel}__${c.createdAt.slice(0, 10)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c);
  }

  return (
    <main className="flex-1">
      <PatientNav email={user?.email ?? ""} />
      <div className="mx-auto max-w-[800px] px-4 py-8">
        <h1 className="text-2xl font-semibold">What changed</h1>
        {changes.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">
            No changes yet. Add a record or answer a question to see your matches update.
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {[...groups.values()].map((rows, i) => (
              <div key={i}>
                <p className="font-medium">{rows[0].triggerLabel}</p>
                <p className="text-xs text-muted-foreground">{format(new Date(rows[0].createdAt), "MMM d, yyyy")}</p>
                <div className="mt-2 space-y-2">
                  {rows.map((c) => (
                    <Card key={c.id}>
                      <CardContent className="py-4">
                        <Link href={`/app/matches/${c.trialId}`} className="font-medium hover:underline">
                          {c.trialTitle}
                        </Link>
                        <p className="mt-1 text-sm">
                          <Badge variant="muted">{statusText(c.fromStatus)}</Badge>
                          {" → "}
                          <Badge variant="muted">{statusText(c.toStatus)}</Badge>
                        </p>
                        {c.changedCriteria.slice(0, 4).map((cc) => (
                          <p key={cc.criterionId} className="mt-1 text-sm text-muted-foreground">
                            {cc.plainText}: {cc.from ?? "—"} → {cc.to} — {cc.reason}
                          </p>
                        ))}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
