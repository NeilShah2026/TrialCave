import Link from "next/link";

import { PageBody, PageHero } from "@/components/page-hero";
import { SiteHeader } from "@/components/site-header";
import { CONSENT_VERSION } from "@/lib/env";
import { cn } from "@/lib/utils";

export const LEGAL_DOCS = [
  { href: "/legal/privacy", label: "Privacy Notice" },
  { href: "/legal/terms", label: "Terms of Service" },
  { href: "/legal/donor-agreement", label: "Data Donor Agreement" },
  { href: "/legal/clinic-agreement", label: "Clinic Agreement" },
  { href: "/legal/research-partner-agreement", label: "Research Partner Agreement" },
];

export interface LegalSection {
  id: string;
  title: string;
  body: React.ReactNode;
}

/** Readable prose styling for legal section bodies. */
const PROSE = cn(
  "mt-3 space-y-4 text-[1.05rem] leading-relaxed text-tc-ink-2",
  "[&_strong]:font-bold [&_strong]:text-tc-ink",
  "[&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6",
  "[&_li]:pl-1 [&_li]:marker:text-tc-primary",
  "[&_a]:font-bold [&_a]:text-tc-primary-ink [&_a]:underline [&_a]:underline-offset-4",
  "[&_table]:text-[1rem] [&_th]:font-bold [&_th]:text-tc-ink [&_td]:align-top",
);

/** Shared layout for /legal/* (C4): version line, contents, sections, doc nav. */
export function LegalLayout({
  title,
  summary,
  current,
  sections,
}: {
  title: string;
  summary: string;
  current: string;
  sections: LegalSection[];
}) {
  return (
    <main className="flex-1">
      <SiteHeader />
      <PageHero
        tone="mist"
        width="narrow"
        back={{ href: "/legal", label: "All legal documents" }}
        title={title}
        lede={`Version ${CONSENT_VERSION}. Demo text for the Hackachusetts 2026 build. Not reviewed by a lawyer.`}
      />
      <PageBody width="narrow">
        <div className="grid gap-10 md:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="md:sticky md:top-24 md:self-start">
            <nav aria-label="Legal documents" className="space-y-1">
              <p className="mb-3 text-[1rem] font-bold text-tc-muted">Legal</p>
              {LEGAL_DOCS.map((d) => (
                <Link
                  key={d.href}
                  href={d.href}
                  aria-current={d.href === current ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center rounded-xl px-3 py-2 text-[1rem]",
                    d.href === current
                      ? "bg-tc-primary-soft font-bold text-tc-primary-ink"
                      : "font-semibold text-tc-ink-2 hover:bg-tc-mist hover:text-tc-ink",
                  )}
                >
                  {d.label}
                </Link>
              ))}
            </nav>
          </aside>

          <article className="min-w-0 max-w-[720px]">
            <p className="rounded-2xl bg-tc-primary-soft px-5 py-4 text-[1.1rem] font-semibold leading-relaxed text-tc-ink">
              {summary}
            </p>

            <nav aria-label="On this page" className="mt-8 rounded-2xl border-2 border-tc-border p-5">
              <p className="text-[1.15rem] font-bold">On this page</p>
              <ol className="mt-3 list-decimal space-y-2 pl-6 text-[1.05rem] text-tc-ink-2 marker:text-tc-muted">
                {sections.map((s) => (
                  <li key={s.id} className="pl-1">
                    <a
                      href={`#${s.id}`}
                      className="font-semibold text-tc-primary-ink underline-offset-4 hover:underline"
                    >
                      {s.title}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>

            {sections.map((s, i) => (
              <section key={s.id} id={s.id} className="mt-10 scroll-mt-24">
                <h2 className="text-[1.35rem] font-extrabold tracking-[-0.01em] text-tc-ink">
                  {i + 1}. {s.title}
                </h2>
                <div className={PROSE}>{s.body}</div>
              </section>
            ))}

            <p className="mt-12 border-t border-tc-border pt-5 text-[0.95rem] text-tc-muted">
              Questions about this document? Email privacy@trialcave.example (demo address). TrialCave
              does not provide medical advice. The study team always makes the final eligibility decision.
            </p>
          </article>
        </div>
      </PageBody>
    </main>
  );
}
