"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster(props: React.ComponentProps<typeof SonnerToaster>) {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            "!rounded-2xl !border-0 !bg-tc-night !text-white !shadow-[0_20px_40px_-16px_rgba(13,38,36,.6)] !font-sans !text-[1rem] !font-semibold",
          description: "!text-tc-night-text",
          success: "[&_[data-icon]]:!text-tc-mint",
          error: "[&_[data-icon]]:!text-[#f2a593]",
        },
      }}
      {...props}
    />
  );
}
