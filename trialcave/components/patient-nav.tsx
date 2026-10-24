import Link from "next/link";

import { Brand } from "@/components/brand";
import { SignOutButton } from "@/components/sign-out-button";

const LINKS = [
  { href: "/app", label: "Dashboard" },
  { href: "/app/matches", label: "Matches" },
  { href: "/app/inbox", label: "Inbox" },
  { href: "/app/records", label: "Records" },
  { href: "/app/profile", label: "Profile" },
  { href: "/app/donor", label: "Data Donor" },
];

export function PatientNav({ email }: { email: string }) {
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-2 px-4 py-3">
        <Brand href="/app" />
        <nav className="flex flex-wrap items-center gap-1">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-md px-3 py-1.5 text-sm text-foreground hover:bg-muted"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="hidden sm:inline">{email}</span>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
