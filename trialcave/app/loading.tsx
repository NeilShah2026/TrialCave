import { Loader2 } from "lucide-react";

/** Loading state for every route (B0 rule 6). */
export default function Loading() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-24" aria-busy="true">
      <div role="status" className="flex flex-col items-center gap-4 text-center">
        <Loader2 className="size-12 animate-spin text-tc-primary" aria-hidden />
        <p className="text-[1.1rem] font-semibold text-tc-ink-2" aria-hidden>
          Loading…
        </p>
        <span className="sr-only">Loading the page</span>
      </div>
    </main>
  );
}
