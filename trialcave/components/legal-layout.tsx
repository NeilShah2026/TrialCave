import Link from "next/link";

import { PublicHeader } from "@/components/public-header";
import { CONSENT_VERSION } from "@/lib/env";

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
      <PublicHeader />
      <div className="mx-auto grid max-w-[1100px] gap-8 px-4 py-10 md:grid-cols-[220px_1fr]">
        <aside className="md:sticky md:top-6 md:self-start">
          <nav aria-label="Legal documents" className="space-y-1 text-sm">
            <p className="mb-2 font-semibold">Legal</p>
            {LEGAL_DOCS.map((d) => (
              <Link
                key={d.href}
                href={d.href}
                aria-current={d.href === current ? "page" : undefined}
                className={
                  d.href === current
                    ? "block rounded-md bg-tc-primary-soft px-2 py-1 font-medium text-tc-primary"
                    : "block rounded-md px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                }
              >
                {d.label}
              </Link>
            ))}
          </nav>
        </aside>

        <article className="max-w-[720px] text-sm leading-relaxed">
          <h1 className="text-3xl font-semibold">{title}</h1>
          <p className="mt-2 text-muted-foreground">
            Version {CONSENT_VERSION}. Demo text for the Hackachusetts 2026 build. Not reviewed by a lawyer.
          </p>
          <p className="mt-4 rounded-xl bg-tc-primary-soft p-4 text-foreground">{summary}</p>

          <nav aria-label="On this page" className="mt-6 rounded-xl border border-border p-4">
            <p className="font-semibold">On this page</p>
            <ol className="mt-2 list-inside list-decimal space-y-1 text-muted-foreground">
              {sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="hover:text-primary hover:underline">{s.title}</a>
                </li>
              ))}
            </ol>
          </nav>

          {sections.map((s, i) => (
            <section key={s.id} id={s.id} className="mt-8 scroll-mt-6">
              <h2 className="text-lg font-semibold">
                {i + 1}. {s.title}
              </h2>
              <div className="mt-2 space-y-2 text-muted-foreground [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
                {s.body}
              </div>
            </section>
          ))}

          <p className="mt-10 border-t border-border pt-4 text-xs text-muted-foreground">
            Questions about this document? Email privacy@trialcave.example (demo address). TrialCave
            does not provide medical advice. The study team always makes the final eligibility decision.
          </p>
        </article>
      </div>
    </main>
  );
}
