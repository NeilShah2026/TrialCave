import "server-only";

import { runMatchesForTrial } from "@/lib/matching/run";

/**
 * Re-match all patients against one study after a clinic saves or changes it
 * (B9.6). Batch-loads patient inputs so it takes seconds at demo scale.
 */
export async function runMatchesForTrialLib(trialId: string): Promise<void> {
  await runMatchesForTrial(trialId);
}
