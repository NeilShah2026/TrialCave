import { Loader2 } from "lucide-react";

/** Loading state for every route (B0 rule 6). */
export default function Loading() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-24" aria-busy="true">
      <div role="status" className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" aria-hidden />
        <span>Loading…</span>
      </div>
    </main>
  );
}
