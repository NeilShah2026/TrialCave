import Link from "next/link";

import { Brand } from "@/components/brand";
import { SignOutButton } from "@/components/sign-out-button";

export function ResearcherNav({ email, orgName }: { email: string; orgName?: string }) {
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div className="flex items-center gap-3">
          <Brand href="/enclave" />
          {orgName ? <span className="text-sm text-muted-foreground">{orgName}</span> : null}
        </div>
        <div className="flex items-center gap-3">
          <Link href="/enclave" className="rounded-md px-3 py-1.5 text-sm hover:bg-muted">Projects</Link>
          <span className="hidden text-sm text-muted-foreground sm:inline">{email}</span>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
