import Link from "next/link";
import { Vault } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * TrialCave wordmark: lucide Vault icon in Vault Teal + "TrialCave" (B14.1).
 */
export function Brand({
  href = "/",
  className,
}: {
  href?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn("inline-flex items-center gap-2 font-semibold", className)}
    >
      <Vault className="size-6 text-primary" aria-hidden />
      <span className="text-lg tracking-tight text-foreground">TrialCave</span>
    </Link>
  );
}
