import "server-only";

import { runMatchesForAllPatients } from "@/lib/matching/run";

/**
 * Re-match after a clinic saves/edits a study. The simplest correct approach is
 * to re-run all patients (silent); for the demo scale (~200 patients) this is
 * fast enough, and it keeps a single matching code path (B9.6).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function runMatchesForTrialLib(trialId: string): Promise<void> {
  await runMatchesForAllPatients();
}
