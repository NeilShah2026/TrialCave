import Link from "next/link";
import { SearchX } from "lucide-react";

import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="flex-1">
      <header className="mx-auto flex max-w-[1100px] items-center px-4 py-5">
        <Brand />
      </header>
      <section className="mx-auto max-w-lg px-4 py-16 text-center">
        <SearchX className="mx-auto size-10 text-muted-foreground" aria-hidden />
        <h1 className="mt-4 text-2xl font-semibold">We couldn&apos;t find that page</h1>
        <p className="mt-2 text-muted-foreground">
          The link may be old, or the item may have been removed.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link href="/">Go to the home page</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/trials">Find a trial</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
