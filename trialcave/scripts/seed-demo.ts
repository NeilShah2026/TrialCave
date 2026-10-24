import { config } from "dotenv";
config({ path: ".env.local" });

import { seedDemo } from "@/lib/demo/seed";

async function main() {
  console.log("Seeding TrialCave demo data…");
  const result = await seedDemo();
  console.log("Done.");
  console.log(
    `  auth users: ${result.authUsers}\n` +
      `  clinics:    ${result.clinics}\n` +
      `  studies:    ${result.studies}\n` +
      `  patients:   ${result.patients}`,
  );
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
