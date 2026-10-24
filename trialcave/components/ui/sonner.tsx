"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster(props: React.ComponentProps<typeof SonnerToaster>) {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            "rounded-2xl border border-border bg-card text-foreground shadow-sm",
        },
      }}
      {...props}
    />
  );
}
