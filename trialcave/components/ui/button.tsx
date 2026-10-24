import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Buttons (design v3): bold, 14px radius, generous height, and a label that
 * says exactly what happens.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[14px] border-2 border-transparent text-[1rem] font-bold leading-tight transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-[1.15em] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-tc-primary text-white hover:bg-tc-primary-ink",
        secondary: "bg-tc-secondary text-white hover:bg-[#3f4f94]",
        destructive: "bg-tc-danger-ink text-white hover:bg-[#843829]",
        outline: "border-[#b9c3c1] bg-white text-tc-ink hover:border-tc-ink",
        ghost: "text-tc-ink hover:bg-tc-mist",
        link: "text-tc-primary-ink underline-offset-4 hover:underline",
        mint: "bg-tc-mint text-tc-night hover:bg-[#b5efe8]",
        light: "bg-white text-tc-ink hover:bg-tc-mint",
        sand: "bg-tc-accent text-tc-ink hover:bg-[#f3e9d8]",
        night: "bg-tc-night text-white hover:bg-tc-night-2",
        "ghost-light": "border-white/55 bg-transparent text-white hover:border-white hover:bg-white/10",
      },
      size: {
        default: "min-h-[3.1rem] px-6",
        sm: "min-h-[2.65rem] rounded-xl px-4 text-[0.95rem]",
        lg: "min-h-[3.5rem] px-7 text-[1.1rem]",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
