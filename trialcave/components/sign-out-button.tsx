"use client";

import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { signOut } from "@/app/actions";

export function SignOutButton() {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await signOut();
        })
      }
    >
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
