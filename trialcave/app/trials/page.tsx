import Link from "next/link";
import { format } from "date-fns";

import { SiteHeader } from "@/components/site-header";
import { PageBody, PageHero } from "@/components/page-hero";
import { TrialCard } from "@/components/trial-card";
import { Button } from "@/components/ui/button";
import { searchTrials } from "@/lib/trials";
import { DEMO_MODE } from "@/lib/env";
import { TOWNS, TOWN_NAMES } from "@/lib/geo/towns";
import { TrialFilters } from "./trial-filters";

export const dynamic = "force-dynamic";
export const metadata = { title: "Find a trial" };

type SP = { q?: string; category?: string; page?: string; demo?: string; town?: string };

export default async function TrialsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const pageSize = 20;
  const townInput = (sp.town ?? "").trim().toLowerCase();
  const town = townInput ? TOWNS.find((t) => t.name.toLowerCase() === townInput) : undefined;

  let result;
  try {
    result = await searchTrials({
      query: sp.q?.trim() || undefined,
      category: sp.category,
      page,
      pageSize,
      includeDemo: DEMO_MODE ? sp.demo !== "false" : false,
      origin: town ? { lat: town.lat, lon: town.lon } : null,
    });
  } catch {
    result = { items: [], total: 0, lastSync: null };
  }

  const totalPages = Math.max(1, Math.ceil(result.total / pageSize));

  return (
    <main className="flex-1">
      <SiteHeader />
      <PageHero
        title="Find a trial"
        lede="Recruiting studies with Massachusetts sites, any condition. No account needed to look."
      >
        <TrialFilters towns={TOWN_NAMES} />
      </PageHero>
      <PageBody>
        <p className="text-[1rem] text-tc-ink-2" role="status">
          {result.total > 0
            ? `Showing ${result.items.length} of ${result.total.toLocaleString("en-US")} recruiting studies`
            : "No studies match your search"}
          {town ? `, with distances from ${town.name}` : sp.town ? `. We don't have "${sp.town}" yet, so distances are hidden` : ""}
          {result.lastSync ? ` · Updated ${format(new Date(result.lastSync), "MMM d, yyyy")}` : ""}
        </p>

        {result.items.length === 0 ? (
          <div className="mt-6 rounded-[24px] bg-white p-10 text-center shadow-card">
            <p className="text-[1.2rem] font-bold">Nothing here yet</p>
            <p className="mt-1 text-tc-ink-2">Try a shorter search, or pick a different area.</p>
            <Button asChild variant="outline" className="mt-5">
              <Link href="/trials">Clear search</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {result.items.map((t) => (
              <TrialCard key={t.id} trial={t} />
            ))}
          </div>
        )}

        {totalPages > 1 ? (
          <nav aria-label="Pages" className="mt-10 flex items-center justify-center gap-3">
            {page > 1 ? (
              <Button asChild variant="outline">
                <Link href={buildPageHref(sp, page - 1)}>Previous</Link>
              </Button>
            ) : null}
            <span className="text-[1rem] text-tc-ink-2">
              Page {page} of {totalPages}
            </span>
            {page < totalPages ? (
              <Button asChild variant="outline">
                <Link href={buildPageHref(sp, page + 1)}>Next</Link>
              </Button>
            ) : null}
          </nav>
        ) : null}

        <div className="mt-12 flex flex-wrap items-center justify-between gap-6 rounded-[26px] bg-tc-night p-7 text-white on-dark sm:p-9">
          <div className="max-w-[38rem]">
            <h2 className="text-[1.6rem] font-extrabold">Not sure if you qualify?</h2>
            <p className="mt-1 text-tc-night-text">
              Upload a visit summary or a photo of your records. We check every study, one requirement at a time.
            </p>
          </div>
          <Button asChild variant="mint" size="lg">
            <Link href="/signup">Check my eligibility</Link>
          </Button>
        </div>
      </PageBody>
    </main>
  );
}

function buildPageHref(sp: SP, page: number): string {
  const params = new URLSearchParams();
  if (sp.q) params.set("q", sp.q);
  if (sp.category) params.set("category", sp.category);
  if (sp.town) params.set("town", sp.town);
  if (sp.demo) params.set("demo", sp.demo);
  params.set("page", String(page));
  return `/trials?${params.toString()}`;
}
