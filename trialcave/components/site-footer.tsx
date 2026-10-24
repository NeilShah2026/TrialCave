import Link from "next/link";

import { Brand } from "@/components/brand";

const COLS = [
  {
    title: "For patients",
    links: [
      { href: "/trials", label: "Find a trial" },
      { href: "/signup", label: "Check my eligibility" },
      { href: "/#donate", label: "Data donation" },
      { href: "/app/privacy", label: "Your privacy controls" },
      { href: "/login", label: "Log in" },
    ],
  },
  {
    title: "For clinics",
    links: [
      { href: "/signup?path=clinic", label: "List a study" },
      { href: "/signup?path=researcher", label: "Research partners" },
      { href: "/login", label: "Clinic log in" },
      { href: "/legal/clinic-agreement", label: "Clinic agreement" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/legal/privacy", label: "Privacy notice" },
      { href: "/legal/terms", label: "Terms" },
      { href: "/legal/donor-agreement", label: "Donor agreement" },
      { href: "/legal/research-partner-agreement", label: "Research partner agreement" },
    ],
  },
];

/**
 * Footer on every page (B0 rule 5), design v3: help first, then link columns,
 * then the medical-advice disclaimer.
 */
export function SiteFooter() {
  return (
    <footer className="mt-auto bg-tc-ink px-[clamp(20px,4vw,72px)] pb-12 pt-[clamp(48px,8vh,88px)] text-[#d5dae4] print:hidden" id="help">
      <div className="mx-auto max-w-[1320px]">
        <div className="grid items-center gap-8 border-b border-[#39445e] pb-12 md:grid-cols-[1fr_auto]">
          <div>
            <h2 className="text-[clamp(1.6rem,2.6vw,2.35rem)] font-extrabold tracking-[-0.02em] text-white">Need help?</h2>
            <p className="mt-2 max-w-[32em] text-[1.05rem]">
              Questions about a study, your records, or your account? Our team can help, in English,
              Spanish, Portuguese or Haitian Creole.
            </p>
          </div>
          <div className="flex flex-wrap gap-3.5">
            <a href="mailto:support@trialcave.example" className="inline-flex min-h-[3.4rem] items-center rounded-[14px] bg-white px-7 text-[1.05rem] font-bold text-tc-ink hover:bg-tc-mint">
              Contact support
            </a>
            <Link href="/how-it-works" className="inline-flex min-h-[3.4rem] items-center rounded-[14px] border-2 border-[#6b7690] px-7 text-[1.05rem] font-bold text-white hover:border-white">
              Read how it works
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-10 py-11 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="col-span-2 md:col-span-1">
            <Brand tone="light" />
          </div>
          {COLS.map((c) => (
            <nav key={c.title} aria-label={c.title}>
              <h3 className="mb-2.5 text-[1rem] font-bold text-white">{c.title}</h3>
              <ul>
                {c.links.map((l) => (
                  <li key={l.href + l.label}>
                    <Link href={l.href} className="inline-flex min-h-10 items-center text-[1.05rem] text-[#d5dae4] hover:text-white hover:underline">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <p className="max-w-[60em] text-[0.95rem] text-[#aab2c3]">
          We never sell personal data. TrialCave does not provide medical advice. Final eligibility is
          always decided by the study team. Talk with your doctor before joining a study. TrialCave
          lists studies from ClinicalTrials.gov.
        </p>
      </div>
    </footer>
  );
}
