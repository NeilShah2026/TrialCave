import { Brand } from "@/components/brand";
import { NavLinks, type NavLink } from "@/components/nav-links";
import { SignOutButton } from "@/components/sign-out-button";

const LINKS: NavLink[] = [
  { href: "/app", label: "Dashboard", exact: true },
  { href: "/app/matches", label: "Matches" },
  { href: "/app/inbox", label: "Inbox" },
  { href: "/app/records", label: "Records" },
  { href: "/app/profile", label: "Profile" },
  { href: "/app/donor", label: "Data Donor" },
  { href: "/app/settings", label: "Settings" },
  { href: "/app/privacy", label: "Privacy" },
];

export function PatientNav({ email }: { email: string }) {
  return (
    <header className="border-b border-border bg-card print:hidden">
      <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-2 px-4 py-3">
        <Brand href="/app" />
        <NavLinks links={LINKS} label="Patient" />
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="hidden lg:inline">{email}</span>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
