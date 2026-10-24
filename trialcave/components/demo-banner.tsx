import { DEMO_MODE } from "@/lib/env";

/** Slim banner shown on every page in demo mode (B0 rule 4). */
export function DemoBanner() {
  if (!DEMO_MODE) return null;
  return (
    <div id="demo-banner" role="note" className="relative z-[60] w-full bg-tc-accent px-4 py-1.5 text-center text-[0.9rem] font-bold text-tc-ink print:hidden">
      Demo environment. All patient data is synthetic.
    </div>
  );
}
