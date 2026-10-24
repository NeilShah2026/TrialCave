import { config } from "dotenv";
config({ path: ".env.local" });

import { createAdminClient } from "@/lib/supabase/admin";
import { translateText } from "@/lib/ai/translate";
import { hasAnthropic } from "@/lib/env";

/**
 * Pre-translate the demo personas' top-match summaries into Spanish so the demo
 * doesn't wait on the AI (B12.2). Safe to re-run (translations are cached).
 */
async function main() {
  if (!hasAnthropic()) {
    console.log("No ANTHROPIC_API_KEY — skipping pre-translation.");
    return;
  }
  const admin = createAdminClient();

  // Demo-study summaries + the personas' top ctgov matches into Spanish.
  const { data: demoStudies } = await admin
    .from("trials")
    .select("plain_summary")
    .eq("source", "clinic")
    .not("plain_summary", "is", null);

  let count = 0;
  for (const t of demoStudies ?? []) {
    if (t.plain_summary) {
      await translateText(t.plain_summary, "es");
      count++;
    }
  }

  // Maria's top matches.
  const { data: maria } = await admin.from("patients").select("id").eq("display_name", "Maria Gonzalez").maybeSingle();
  if (maria) {
    const { data: top } = await admin
      .from("match_results")
      .select("trials!inner(plain_summary)")
      .eq("patient_id", maria.id)
      .in("status", ["strong", "possible"])
      .limit(10);
    for (const row of top ?? []) {
      const s = (row.trials as unknown as { plain_summary: string | null }).plain_summary;
      if (s) {
        await translateText(s, "es");
        count++;
      }
    }
  }

  console.log(`Pre-translated ${count} summaries into Spanish (cached).`);
}

main().catch((e) => {
  console.error("ai-precompute failed:", e);
  process.exit(1);
});
