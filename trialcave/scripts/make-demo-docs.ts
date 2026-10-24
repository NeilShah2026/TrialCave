import { config } from "dotenv";
config({ path: ".env.local" });

import { mkdir, writeFile } from "node:fs/promises";
import { subDays } from "date-fns";

import { renderDemoPdf } from "@/lib/demo/documents";

async function main() {
  await mkdir("public/demo/docs", { recursive: true });
  const maria = await renderDemoPdf("maria-visit-summary", subDays(new Date(), 4));
  const james = await renderDemoPdf("james-lab-report", subDays(new Date(), 10));
  await writeFile("public/demo/docs/maria-visit-summary.pdf", maria);
  await writeFile("public/demo/docs/james-lab-report.pdf", james);
  console.log("Wrote demo PDFs to public/demo/docs/");
}

main().catch((e) => {
  console.error("make-demo-docs failed:", e);
  process.exit(1);
});
