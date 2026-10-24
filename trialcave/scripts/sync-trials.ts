import { config } from "dotenv";
config({ path: ".env.local" });

import { syncTrials } from "@/lib/ctgov/sync";

async function main() {
  const condition = process.env.CTGOV_CONDITION || undefined;
  const location = process.env.CTGOV_LOCATION || "Massachusetts";
  const geoFilter = process.env.CTGOV_FALLBACK_GEO || undefined;
  const maxTrials = Number(process.env.CTGOV_MAX_TRIALS ?? 400);
  const minLocalTrials = Number(process.env.CTGOV_MIN_LOCAL_TRIALS ?? 60);

  console.log(
    `Syncing trials: condition=${condition ?? "(all)"} location=${location} max=${maxTrials}…`,
  );
  const result = await syncTrials({ condition, location, geoFilter, maxTrials, minLocalTrials });
  console.log("Done.");
  console.log(
    `  fetched:       ${result.fetched}\n` +
      `  inserted:      ${result.inserted}\n` +
      `  updated:       ${result.updated}\n` +
      `  total avail:   ${result.totalAvailable}\n` +
      `  geo fallback:  ${result.usedGeoFallback}`,
  );
}

main().catch((e) => {
  console.error("Sync failed:", e);
  process.exit(1);
});
