import Link from "next/link";

import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth";
import { ROLE_HOME } from "@/lib/types";

/** Header for public pages. Signed-in users get a link back to their area. */
export async function PublicHeader() {
  const user = await getSessionUser().catch(() => null);

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-2 px-4 py-4">
        <Brand />
        <nav aria-label="Main" className="flex flex-wrap items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/trials">Find a trial</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/how-it-works">How it works</Link>
          </Button>
          {user ? (
            <Button asChild size="sm">
              <Link href={ROLE_HOME[user.role]}>My account</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="outline" size="sm">
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/signup">Sign up</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
