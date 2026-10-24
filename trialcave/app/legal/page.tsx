import Link from "next/link";
import { ChevronRight, FileText } from "lucide-react";

import { PageBody, PageHero } from "@/components/page-hero";
import { SiteHeader } from "@/components/site-header";
import { LEGAL_DOCS } from "@/components/legal-layout";

export const metadata = { title: "Legal" };

const BLURBS: Record<string, string> = {
  "/legal/privacy": "What we collect, how it's used, and your rights.",
  "/legal/terms": "The rules for using TrialCave.",
  "/legal/donor-agreement": "How donating data, the Enclave, and paychecks work.",
  "/legal/clinic-agreement": "What research clinics agree to.",
  "/legal/research-partner-agreement": "What research partners agree to.",
};

export default function LegalIndexPage() {
  return (
    <main className="flex-1">
      <SiteHeader />
      <PageHero
        tone="mist"
        width="narrow"
        title="Legal"
        lede="Plain-language demo versions. Not reviewed by a lawyer."
      />
      <PageBody width="narrow">
        <ul className="grid gap-4 sm:grid-cols-2">
          {LEGAL_DOCS.map((d) => (
            <li key={d.href}>
              <Link
                href={d.href}
                className="group flex h-full items-start gap-4 rounded-[24px] border-2 border-transparent bg-white p-6 shadow-card transition-colors hover:border-tc-primary focus-visible:border-tc-primary"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-tc-primary-soft text-tc-primary-ink">
                  <FileText className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[1.15rem] font-bold text-tc-ink">{d.label}</span>
                  <span className="mt-1 block text-[1rem] text-tc-ink-2">{BLURBS[d.href]}</span>
                </span>
                <ChevronRight className="mt-2.5 size-5 shrink-0 text-tc-primary-ink transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </PageBody>
    </main>
  );
}
