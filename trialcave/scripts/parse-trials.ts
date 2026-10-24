import { config } from "dotenv";
config({ path: ".env.local" });

import { parsePendingTrials } from "@/lib/ctgov/parse";
import { hasAnthropic } from "@/lib/env";

async function main() {
  if (!hasAnthropic()) {
    console.log("No ANTHROPIC_API_KEY set — skipping trial parsing.");
    console.log("ctgov trials will display with raw eligibility text; demo studies have hand-written criteria.");
    return;
  }

  // Optional limit via CLI arg: `npm run db:parse-trials -- 25`
  const limitArg = process.argv[2];
  const limit = limitArg ? Number(limitArg) : undefined;

  console.log(`Parsing pending trials${limit ? ` (limit ${limit})` : ""}…`);
  const progress = await parsePendingTrials({ limit, concurrency: 4 });
  console.log("Done.");
  console.log(`  parsed: ${progress.parsed}\n  failed: ${progress.failed}\n  total:  ${progress.total}`);
}

main().catch((e) => {
  console.error("Parse failed:", e);
  process.exit(1);
});
