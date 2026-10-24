/**
 * Cross-trial missing-info list (B9.8). Pure, unit-tested.
 */

import type { CriterionResult, MatchStatus } from "@/lib/matching/types";
import { getVocabField, vocabLabel } from "@/lib/matching/vocabulary";

export interface MissingItem {
  field: string;
  label: string;
  action: "question" | "add_lab" | "add_record";
  question: string | null;
  trialCount: number;
  bestStatus: MatchStatus;
}

export interface MatchRowForMissing {
  status: MatchStatus;
  details: CriterionResult[];
}

const STATUS_RANK: Record<MatchStatus, number> = {
  strong: 0,
  possible: 1,
  needs_info: 2,
  ineligible: 3,
};

export function getMissingInfo(rows: MatchRowForMissing[]): MissingItem[] {
  // Only strong/possible/needs_info trials (B9.8 step 1).
  const relevant = rows.filter(
    (r) => r.status === "strong" || r.status === "possible" || r.status === "needs_info",
  );

  const byField = new Map<
    string,
    { trials: Set<number>; bestStatus: MatchStatus; question: string | null }
  >();

  relevant.forEach((row, idx) => {
    for (const d of row.details) {
      if (d.status !== "unknown" || !d.field) continue;
      const existing = byField.get(d.field);
      if (existing) {
        existing.trials.add(idx);
        if (STATUS_RANK[row.status] < STATUS_RANK[existing.bestStatus]) {
          existing.bestStatus = row.status;
        }
        if (!existing.question && d.patientQuestion) existing.question = d.patientQuestion;
      } else {
        byField.set(d.field, {
          trials: new Set([idx]),
          bestStatus: row.status,
          question: d.patientQuestion,
        });
      }
    }
  });

  const items: MissingItem[] = [];
  for (const [field, info] of byField) {
    const vocab = getVocabField(field);
    let action: MissingItem["action"];
    if (vocab?.type === "bool" && info.question) action = "question";
    else if (vocab?.category === "lab") action = "add_lab";
    else action = "add_record";

    items.push({
      field,
      label: vocabLabel(field),
      action,
      question: info.question,
      trialCount: info.trials.size,
      bestStatus: info.bestStatus,
    });
  }

  // Sort: best status first, then trialCount desc.
  items.sort((a, b) => {
    if (STATUS_RANK[a.bestStatus] !== STATUS_RANK[b.bestStatus]) {
      return STATUS_RANK[a.bestStatus] - STATUS_RANK[b.bestStatus];
    }
    return b.trialCount - a.trialCount;
  });

  return items;
}
