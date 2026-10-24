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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[1.45rem] font-extrabold tracking-tight">Who can join</h2>
        <button
          type="button"
          onClick={() => setShowOriginal((v) => !v)}
          aria-pressed={showOriginal}
          className="min-h-11 rounded-lg text-[1rem] font-bold text-tc-primary-ink hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-tc-primary-soft"
        >
          {showOriginal ? "Show plain language" : "Show original trial text"}
        </button>
      </div>

      <ul className="mt-3">
        {inclusion.map((c) => (
          <li key={c.id} className="flex gap-3 border-t border-tc-border py-3 text-[1.05rem] text-tc-ink first:border-t-0">
            <Badge variant="success" className="mt-0.5 shrink-0">
              Needed
            </Badge>
            <span>{showOriginal ? c.originalText : c.plainText}</span>
          </li>
        ))}
        {inclusion.length === 0 ? (
          <li className="py-3 text-[1rem] text-tc-ink-2">No inclusion criteria listed.</li>
        ) : null}
      </ul>

      {exclusion.length > 0 ? (
        <>
          <h2 className="mt-8 text-[1.45rem] font-extrabold tracking-tight">Who can&apos;t join</h2>
          <ul className="mt-3">
            {exclusion.map((c) => (
              <li key={c.id} className="flex gap-3 border-t border-tc-border py-3 text-[1.05rem] text-tc-ink first:border-t-0">
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
