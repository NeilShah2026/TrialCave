"use client";

import { useEffect } from "react";

import { markChangesSeen } from "../matches/actions";

/** Marks the shown changes as seen once the page has rendered (B9.7). */
export function MarkSeen({ ids }: { ids: string[] }) {
  useEffect(() => {
    markChangesSeen(ids).catch(() => {
      // Non-critical: the banner just stays until next time.
    });
  }, [ids]);
  return null;
}
