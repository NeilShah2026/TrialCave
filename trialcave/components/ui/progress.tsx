import * as React from "react";

import { cn } from "@/lib/utils";

export function Progress({
  value,
  className,
  ...rest
}: {
  value: number;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "children">) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={cn("h-2.5 w-full overflow-hidden rounded-full bg-tc-primary-soft", className)}
      {...rest}
    >
      <div className="h-full rounded-full bg-tc-primary transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}
