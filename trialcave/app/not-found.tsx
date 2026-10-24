import Link from "next/link";
import { SearchX } from "lucide-react";

import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="flex-1">
      <SiteHeader />
      <section className="px-[clamp(16px,4vw,72px)] py-[clamp(48px,10vh,120px)]">
        <div className="mx-auto max-w-[560px] rounded-[24px] bg-white p-8 text-center shadow-card sm:p-10">
          <span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-tc-primary-soft text-tc-primary-ink">
            <SearchX className="size-8" aria-hidden />
          </span>
          <h1 className="mt-6 text-[clamp(1.8rem,3vw,2.4rem)] font-extrabold tracking-[-0.02em]">
            We couldn&apos;t find that page
          </h1>
          <p className="mt-3 text-[1.1rem] text-tc-ink-2">
            The link may be old, or the item may have been removed.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/">Go to the home page</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/trials">Find a trial</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
