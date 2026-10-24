import Link from "next/link";

import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";

export function PublicHeader() {
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-[1100px] items-center justify-between px-4 py-4">
        <Brand />
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/trials">Find a trial</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/how-it-works">How it works</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/login">Log in</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
