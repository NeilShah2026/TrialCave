import { Brand } from "@/components/brand";
import { SignOutButton } from "@/components/sign-out-button";

/**
 * Minimal signed-in header (used by the admin area). Role areas with several
 * pages use PatientNav / ClinicNav / ResearcherNav instead.
 */
export function AppHeader({ email, homeHref = "/" }: { email: string; homeHref?: string }) {
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-[1100px] items-center justify-between px-4 py-4">
        <Brand href={homeHref} />
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="hidden sm:inline">{email}</span>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
