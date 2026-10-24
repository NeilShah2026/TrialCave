import { CheckCircle2, HelpCircle, MinusCircle, XCircle } from "lucide-react";

import type { CriterionStatus } from "@/lib/matching/types";
import { cn } from "@/lib/utils";

/**
 * Criterion status icon (B14.1) with a screen-reader label, so status is never
 * conveyed by color or emoji alone. For exclusions, "pass" means the rule
 * doesn't apply to the patient.
 */
export function CriterionIcon({
  status,
  kind = "inclusion",
  className,
}: {
  status: CriterionStatus;
  kind?: "inclusion" | "exclusion";
  className?: string;
}) {
  const label =
    status === "pass"
      ? kind === "exclusion"
        ? "Doesn't apply to you"
        : "Meets this requirement"
      : status === "fail"
        ? kind === "exclusion"
          ? "This rules you out"
          : "Doesn't meet this requirement"
        : status === "unknown"
          ? "Not known yet"
          : "The study team will check";

  const Icon = status === "pass" ? CheckCircle2 : status === "fail" ? XCircle : status === "unknown" ? HelpCircle : MinusCircle;
  const color =
    status === "pass" ? "text-tc-success" : status === "fail" ? "text-tc-danger" : status === "unknown" ? "text-tc-warning" : "text-tc-muted";

  return (
    <span className={cn("inline-flex shrink-0", className)}>
      <Icon className={cn("size-6", color)} strokeWidth={2.25} aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}
