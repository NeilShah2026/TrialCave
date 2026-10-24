import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/** Status pills (design v3): rounded, bold, soft background. */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-[0.85rem] font-bold leading-tight",
  {
    variants: {
      variant: {
        default: "bg-tc-primary text-white",
        secondary: "bg-tc-secondary-soft text-tc-secondary",
        outline: "border-2 border-tc-border text-tc-ink",
        success: "bg-tc-success-soft text-tc-success-ink",
        warning: "bg-tc-warning-soft text-tc-warning-ink",
        danger: "bg-tc-danger-soft text-tc-danger-ink",
        muted: "bg-tc-mist text-tc-ink-2",
        teal: "bg-tc-primary-soft text-tc-primary-ink",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
