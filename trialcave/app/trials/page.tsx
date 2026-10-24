import Link from "next/link";
import { format } from "date-fns";

import { PublicHeader } from "@/components/public-header";
import { TrialCard } from "@/components/trial-card";
import { Button } from "@/components/ui/button";
import { searchTrials } from "@/lib/trials";
import { DEMO_MODE } from "@/lib/env";
import { TrialFilters } from "./trial-filters";

export const dynamic = "force-dynamic";

export default async function TrialsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; page?: string; demo?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const pageSize = 20;

  let result;
  try {
    result = await searchTrials({
      query: sp.q,
      category: sp.category,
      page,
      pageSize,
      includeDemo: DEMO_MODE ? sp.demo !== "false" : false,
    });
  } catch {
    result = { items: [], total: 0, lastSync: null };
  }

  const totalPages = Math.max(1, Math.ceil(result.total / pageSize));

  return (
    <main className="flex-1">
      <PublicHeader />
      <div className="mx-auto max-w-[1100px] px-4 py-8">
        <h1 className="text-2xl font-semibold">Find a trial</h1>
        <p className="mt-1 text-muted-foreground">
          Recruiting studies with Massachusetts sites, any condition.
        </p>

        <div className="mt-6">
          <TrialFilters />
        </div>

        <p className="mt-4 text-sm text-muted-foreground">
          {result.total > 0
            ? `Showing ${result.items.length} of ${result.total} recruiting trials`
            : "No trials match your search"}
          {result.lastSync
            ? ` · Updated ${format(new Date(result.lastSync), "MMM d, yyyy")}`
            : ""}
        </p>

        {result.items.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">
            Nothing here yet. Try a different search, or load trials with
            <code className="mx-1">npm run db:sync-trials</code>.
          </div>
        ) : (
          <div className="mt-6 grid gap-4">
            {result.items.map((t) => (
              <TrialCard key={t.id} trial={t} />
            ))}
          </div>
        )}

        {totalPages > 1 ? (
          <div className="mt-8 flex items-center justify-center gap-3">
            {page > 1 ? (
              <Button asChild variant="outline" size="sm">
                <Link href={buildPageHref(sp, page - 1)}>Previous</Link>
              </Button>
            ) : null}
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            {page < totalPages ? (
              <Button asChild variant="outline" size="sm">
                <Link href={buildPageHref(sp, page + 1)}>Next</Link>
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </main>
  );
}

function buildPageHref(
  sp: { q?: string; category?: string; demo?: string },
  page: number,
): string {
  const params = new URLSearchParams();
  if (sp.q) params.set("q", sp.q);
  if (sp.category) params.set("category", sp.category);
  if (sp.demo) params.set("demo", sp.demo);
  params.set("page", String(page));
  return `/trials?${params.toString()}`;
}
