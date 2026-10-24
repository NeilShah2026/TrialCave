import Link from "next/link";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ChangeRow } from "@/lib/patient";

const STATUS_RANK: Record<string, number> = { strong: 3, possible: 2, needs_info: 1, ineligible: 0 };

/** "What changed" banner on the dashboard (B9.7): unseen changes grouped by trigger. */
export function ChangesBanner({ changes }: { changes: ChangeRow[] }) {
  if (changes.length === 0) return null;

  // Group by trigger label, newest first.
  const byTrigger = new Map<string, ChangeRow[]>();
  for (const c of changes) {
    if (!byTrigger.has(c.triggerLabel)) byTrigger.set(c.triggerLabel, []);
    byTrigger.get(c.triggerLabel)!.push(c);
  }

  return (
    <div className="flex flex-wrap items-start justify-between gap-4 rounded-[24px] bg-tc-primary-soft px-6 py-5 text-tc-ink" role="status">
      <div className="flex gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-tc-primary-ink">
          <Sparkles className="size-5" aria-hidden />
        </span>
        <div className="space-y-3">
          {[...byTrigger.entries()].slice(0, 3).map(([label, rows]) => {
            const newStrong = rows.filter((r) => r.toStatus === "strong" && r.fromStatus !== "strong").length;
            const dropped = rows.filter((r) => r.toStatus === null || (r.toStatus === "ineligible" && r.fromStatus !== "ineligible")).length;
            const movedUp = rows.filter(
              (r) => r.toStatus && r.fromStatus && STATUS_RANK[r.toStatus] > STATUS_RANK[r.fromStatus],
            ).length;
            const parts = [
              newStrong ? `${newStrong} new strong match${newStrong === 1 ? "" : "es"}` : "",
              movedUp ? `${movedUp} moved up` : "",
              dropped ? `${dropped} no longer fit` : "",
            ].filter(Boolean);
            return (
              <div key={label}>
                <p className="text-[1.05rem] font-bold">{label} updated your matches.</p>
                <p className="text-[1rem] text-tc-ink-2">
                  {parts.length ? parts.join(" · ") : `${rows.length} trial${rows.length === 1 ? "" : "s"} changed`}
                </p>
              </div>
            );
          })}
        </div>
      </div>
      <Button asChild>
        <Link href="/app/changes">See what changed</Link>
      </Button>
    </div>
  );
}
