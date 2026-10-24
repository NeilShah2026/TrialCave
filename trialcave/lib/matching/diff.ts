/**
 * Compute "what changed" between two match runs (B9.7). Pure, unit-tested.
 */

import type { CriterionResult, CriterionStatus, MatchStatus } from "@/lib/matching/types";

export interface MatchSnapshot {
  status: MatchStatus;
  score: number;
  details: CriterionResult[];
}

export interface ChangedCriterion {
  criterionId: string;
  plainText: string;
  from: CriterionStatus | null;
  to: CriterionStatus;
  reason: string;
}

export interface MatchChange {
  trialId: string;
  fromStatus: MatchStatus | null; // null = newly appeared
  toStatus: MatchStatus | null; // null = no longer listed
  fromScore: number | null;
  toScore: number | null;
  changedCriteria: ChangedCriterion[];
}

const STATUS_ORDER: Record<MatchStatus, number> = {
  strong: 3,
  possible: 2,
  needs_info: 1,
  ineligible: 0,
};

/** True if `to` ranks better than `from` (moved up). */
export function movedUp(from: MatchStatus | null, to: MatchStatus | null): boolean {
  if (to === null) return false;
  if (from === null) return STATUS_ORDER[to] >= STATUS_ORDER.needs_info;
  return STATUS_ORDER[to] > STATUS_ORDER[from];
}

function criteriaDiff(
  oldDetails: CriterionResult[] | null,
  newDetails: CriterionResult[],
): ChangedCriterion[] {
  const oldById = new Map((oldDetails ?? []).map((c) => [c.criterionId, c]));
  const changed: ChangedCriterion[] = [];
  for (const nc of newDetails) {
    const oc = oldById.get(nc.criterionId);
    if (!oc || oc.status !== nc.status) {
      changed.push({
        criterionId: nc.criterionId,
        plainText: nc.plainText,
        from: oc ? oc.status : null,
        to: nc.status,
        reason: nc.reason,
      });
    }
  }
  return changed;
}

/**
 * Compares two maps of trialId → snapshot. Records a change when status differs,
 * or a trial appears or disappears. Score-only changes within the same status
 * are NOT recorded (too noisy, B9.7).
 */
export function diffMatches(
  oldMap: Map<string, MatchSnapshot>,
  newMap: Map<string, MatchSnapshot>,
): MatchChange[] {
  const changes: MatchChange[] = [];

  // Appeared or changed.
  for (const [trialId, next] of newMap) {
    const prev = oldMap.get(trialId);
    if (!prev) {
      changes.push({
        trialId,
        fromStatus: null,
        toStatus: next.status,
        fromScore: null,
        toScore: next.score,
        changedCriteria: criteriaDiff(null, next.details),
      });
    } else if (prev.status !== next.status) {
      changes.push({
        trialId,
        fromStatus: prev.status,
        toStatus: next.status,
        fromScore: prev.score,
        toScore: next.score,
        changedCriteria: criteriaDiff(prev.details, next.details),
      });
    }
  }

  // Disappeared (prefiltered out).
  for (const [trialId, prev] of oldMap) {
    if (!newMap.has(trialId)) {
      changes.push({
        trialId,
        fromStatus: prev.status,
        toStatus: null,
        fromScore: prev.score,
        toScore: null,
        changedCriteria: [],
      });
    }
  }

  return changes;
}
