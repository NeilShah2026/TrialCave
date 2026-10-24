import { config } from "dotenv";
config({ path: ".env.local" });

import { runMatchesForAllPatients } from "@/lib/matching/run";

async function main() {
  console.log("Precomputing matches for all patients…");
  const started = Date.now();
  const count = await runMatchesForAllPatients();
  console.log(`Done. Matched ${count} patients in ${((Date.now() - started) / 1000).toFixed(1)}s.`);
}

main().catch((e) => {
  console.error("Precompute failed:", e);
  process.exit(1);
});
