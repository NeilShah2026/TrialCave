import { Brand } from "@/components/brand";
import { SignOutButton } from "@/components/sign-out-button";

/**
 * Minimal signed-in header used across role areas. Role-specific nav is added in
 * later phases.
 */
export function AppHeader({ email }: { email: string }) {
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-[1100px] items-center justify-between px-4 py-4">
        <Brand href="/" />
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="hidden sm:inline">{email}</span>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
