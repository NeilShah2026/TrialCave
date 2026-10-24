"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import type { Criterion } from "@/lib/trials";

/**
 * Plain-language eligibility checklist grouped into inclusion ("Who can join")
 * and exclusion ("Who can't join"), with a per-section original-text toggle.
 * This is the public (not-signed-in) view: no pass/fail, just the criteria.
 */
export function CriteriaList({ criteria }: { criteria: Criterion[] }) {
  const [showOriginal, setShowOriginal] = useState(false);
  const inclusion = criteria.filter((c) => c.kind === "inclusion");
  const exclusion = criteria.filter((c) => c.kind === "exclusion");

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Who can join</h2>
        <button
          type="button"
          onClick={() => setShowOriginal((v) => !v)}
          className="text-sm text-primary hover:underline"
        >
          {showOriginal ? "Show plain language" : "Show original trial text"}
        </button>
      </div>

      <ul className="mt-3 space-y-2">
        {inclusion.map((c) => (
          <li key={c.id} className="flex gap-2 text-sm">
            <Badge variant="success" className="mt-0.5 shrink-0">
              Needed
            </Badge>
            <span>{showOriginal ? c.originalText : c.plainText}</span>
          </li>
        ))}
        {inclusion.length === 0 ? (
          <li className="text-sm text-muted-foreground">No inclusion criteria listed.</li>
        ) : null}
      </ul>

      {exclusion.length > 0 ? (
        <>
          <h2 className="mt-6 text-lg font-semibold">Who can&apos;t join</h2>
          <ul className="mt-3 space-y-2">
            {exclusion.map((c) => (
              <li key={c.id} className="flex gap-2 text-sm">
                <Badge variant="danger" className="mt-0.5 shrink-0">
                  Rules out
                </Badge>
                <span>{showOriginal ? c.originalText : c.plainText}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
