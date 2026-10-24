import Link from "next/link";

/**
 * Footer shown on every page (B0 rule 5). The medical-advice disclaimer is
 * required everywhere.
 */
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-card px-4 py-6 text-sm text-muted-foreground">
      <div className="mx-auto flex max-w-[1100px] flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl">
          TrialCave does not provide medical advice. Final eligibility is always
          decided by the study team.
        </p>
        <nav className="flex flex-wrap gap-4">
          <Link href="/legal/terms" className="hover:text-primary">
            Terms
          </Link>
          <Link href="/legal/privacy" className="hover:text-primary">
            Privacy
          </Link>
          <Link href="/how-it-works" className="hover:text-primary">
            How it works
          </Link>
        </nav>
      </div>
    </footer>
  );
}
