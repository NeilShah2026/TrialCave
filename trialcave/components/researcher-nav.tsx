import { Brand } from "@/components/brand";
import { NavLinks, type NavLink } from "@/components/nav-links";
import { SignOutButton } from "@/components/sign-out-button";

const LINKS: NavLink[] = [{ href: "/enclave", label: "Projects" }];

export function ResearcherNav({ email, orgName }: { email: string; orgName?: string }) {
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div className="flex items-center gap-3">
          <Brand href="/enclave" />
          {orgName ? <span className="text-sm text-muted-foreground">{orgName}</span> : null}
        </div>
        <NavLinks links={LINKS} label="Researcher" />
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted-foreground lg:inline">{email}</span>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
