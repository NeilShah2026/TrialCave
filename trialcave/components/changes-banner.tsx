"use client";

import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import type { ChangeRow } from "@/lib/patient";

const STATUS_RANK: Record<string, number> = { strong: 3, possible: 2, needs_info: 1, ineligible: 0 };

export function ChangesBanner({ changes }: { changes: ChangeRow[] }) {
  if (changes.length === 0) return null;

  // Group by trigger label.
  const byTrigger = new Map<string, ChangeRow[]>();
  for (const c of changes) {
    if (!byTrigger.has(c.triggerLabel)) byTrigger.set(c.triggerLabel, []);
    byTrigger.get(c.triggerLabel)!.push(c);
  }

  return (
    <Card className="border-primary bg-tc-primary-soft">
      <CardContent className="pt-6">
        {[...byTrigger.entries()].map(([label, rows]) => {
          const newStrong = rows.filter((r) => r.toStatus === "strong" && r.fromStatus !== "strong").length;
          const dropped = rows.filter((r) => r.toStatus === null || r.toStatus === "ineligible").length;
          const movedUp = rows.filter(
            (r) => r.toStatus && r.fromStatus && STATUS_RANK[r.toStatus] > STATUS_RANK[r.fromStatus],
          ).length;
          return (
            <div key={label}>
              <p className="font-medium">{label} updated your profile.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {newStrong} new strong match{newStrong === 1 ? "" : "es"} · {dropped} no longer fit · {movedUp} moved up
              </p>
            </div>
          );
        })}
        <Link href="/app/changes" className="mt-3 inline-block text-sm text-primary hover:underline">
          See what changed
        </Link>
      </CardContent>
    </Card>
  );
}
