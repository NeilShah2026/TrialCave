/**
 * Score and rank a trial from its criterion results (B9.5). Pure, unit-tested.
 */

import type { CriterionResult, MatchStatus } from "@/lib/matching/types";

export interface ScoreResult {
  status: MatchStatus;
  score: number;
  passCount: number;
  failCount: number;
  unknownCount: number;
}

export function scoreTrial(results: CriterionResult[]): ScoreResult {
  let pass = 0;
  let fail = 0;
  let unknown = 0;
  for (const r of results) {
    if (r.status === "na") continue;
    if (r.status === "pass") pass++;
    else if (r.status === "fail") fail++;
    else if (r.status === "unknown") unknown++;
  }

  // Any fail → ineligible. Score = pass / (pass + fail + unknown).
  if (fail > 0) {
    const denom = pass + fail + unknown;
    return {
      status: "ineligible",
      score: denom === 0 ? 0 : pass / denom,
      passCount: pass,
      failCount: fail,
      unknownCount: unknown,
    };
  }

  // Otherwise score = pass / (pass + unknown).
  const denom = pass + unknown;
  if (denom === 0) {
    return { status: "needs_info", score: 0, passCount: pass, failCount: fail, unknownCount: unknown };
  }
  const score = pass / denom;
  let status: MatchStatus;
  if (score >= 0.8) status = "strong";
  else if (score >= 0.5) status = "possible";
  else status = "needs_info";

  return { status, score, passCount: pass, failCount: fail, unknownCount: unknown };
}

const STATUS_RANK: Record<MatchStatus, number> = {
  strong: 0,
  possible: 1,
  needs_info: 2,
  ineligible: 3,
};

/** Rank: status, then score desc, then fewer unknowns, then distance (B9.5). */
export function compareMatches(
  a: { status: MatchStatus; score: number; unknownCount: number; distanceMiles: number | null },
  b: { status: MatchStatus; score: number; unknownCount: number; distanceMiles: number | null },
): number {
  if (STATUS_RANK[a.status] !== STATUS_RANK[b.status]) {
    return STATUS_RANK[a.status] - STATUS_RANK[b.status];
  }
  if (b.score !== a.score) return b.score - a.score;
  if (a.unknownCount !== b.unknownCount) return a.unknownCount - b.unknownCount;
  const da = a.distanceMiles ?? Number.POSITIVE_INFINITY;
  const db = b.distanceMiles ?? Number.POSITIVE_INFINITY;
  return da - db;
}
