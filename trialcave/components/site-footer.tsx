import Link from "next/link";

const LINKS = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/trials", label: "Find a trial" },
  { href: "/legal/terms", label: "Terms" },
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/donor-agreement", label: "Donor Agreement" },
  { href: "/legal/clinic-agreement", label: "Clinic Agreement" },
  { href: "/legal/research-partner-agreement", label: "Research Partner Agreement" },
];

/**
 * Footer shown on every page (B0 rule 5). The medical-advice disclaimer is
 * required everywhere.
 */
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-card px-4 py-6 text-sm text-muted-foreground print:hidden">
      <div className="mx-auto flex max-w-[1100px] flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <p className="max-w-md">
          TrialCave does not provide medical advice. Final eligibility is always
          decided by the study team.
        </p>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-4 gap-y-2">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-primary hover:underline">
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
