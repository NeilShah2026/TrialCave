"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";

import { signOut } from "@/app/actions";
import { cn } from "@/lib/utils";

export function SignOutButton({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await signOut();
        })
      }
      className={cn(
        "inline-flex min-h-12 items-center gap-2 whitespace-nowrap rounded-xl border-2 px-4 text-[0.98rem] font-bold transition-colors disabled:opacity-60",
        tone === "light" ? "border-white/55 text-white hover:border-white hover:bg-white/10" : "border-[#b9c3c1] text-tc-ink hover:border-tc-ink",
      )}
    >
      <LogOut className="size-[18px]" aria-hidden />
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
