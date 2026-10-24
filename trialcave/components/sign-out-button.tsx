"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";

import { signOut } from "@/app/actions";
import { cn } from "@/lib/utils";

/**
 * Sign out. `compact` shows only the icon below the xl breakpoint (the label
 * stays available to screen readers) so a crowded header still fits.
 */
export function SignOutButton({ tone = "dark", compact = false }: { tone?: "dark" | "light"; compact?: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      title="Sign out"
      onClick={() =>
        startTransition(async () => {
          await signOut();
        })
      }
      className={cn(
        "inline-flex min-h-12 items-center gap-2 whitespace-nowrap rounded-xl border-2 px-4 text-[0.98rem] font-bold transition-colors disabled:opacity-60",
        compact && "max-xl:min-w-12 max-xl:justify-center max-xl:px-0",
        tone === "light" ? "border-white/55 text-white hover:border-white hover:bg-white/10" : "border-[#b9c3c1] text-tc-ink hover:border-tc-ink",
      )}
    >
      <LogOut className="size-[18px]" aria-hidden />
      <span className={cn(compact && "max-xl:sr-only")}>{pending ? "Signing out…" : "Sign out"}</span>
    </button>
  );
}
