import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "flex min-h-[3.1rem] w-full rounded-[14px] border-2 border-input bg-white px-4 py-2 text-[1.05rem] text-tc-ink transition-[border-color,box-shadow] file:border-0 file:bg-transparent file:font-semibold placeholder:text-[#7a8292] focus-visible:border-tc-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-tc-primary-soft disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
