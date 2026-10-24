import Link from "next/link";
import { Vault } from "lucide-react";

import { cn } from "@/lib/utils";

/** TrialCave wordmark: Vault icon + "TrialCave" (design v3). */
export function Brand({
  href = "/",
  className,
  tone = "dark",
}: {
  href?: string;
  className?: string;
  /** "dark" = ink text on light backgrounds; "light" = white text on night. */
  tone?: "dark" | "light";
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2.5 rounded-lg text-[1.35rem] font-extrabold tracking-[-0.01em]",
        tone === "light" ? "text-white" : "text-tc-ink",
        className,
      )}
    >
      <Vault className={cn("size-[30px]", tone === "light" ? "text-tc-mint" : "text-tc-primary")} strokeWidth={2} aria-hidden />
      <span>TrialCave</span>
    </Link>
  );
}
