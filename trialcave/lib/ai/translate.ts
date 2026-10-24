import "server-only";

import { createHash } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";

import { createAdminClient } from "@/lib/supabase/admin";
import { anthropicApiKey, ANTHROPIC_FAST_MODEL, hasAnthropic } from "@/lib/env";
import { LANGUAGE_NAME, type Language } from "@/lib/i18n/languages";

/**
 * Cached translation (B12.2). English is the official text and returned as-is.
 * Other languages are looked up in the `translations` cache by sha256(text);
 * misses call the fast model and are stored. On error, falls back to English.
 */

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: anthropicApiKey() });
  return client;
}

export async function translateText(text: string, lang: Language): Promise<{ text: string; machine: boolean }> {
  if (lang === "en" || !text.trim()) return { text, machine: false };

  const admin = createAdminClient();
  const hash = sha256(text);

  const { data: cached } = await admin
    .from("translations")
    .select("text")
    .eq("source_sha256", hash)
    .eq("lang", lang)
    .maybeSingle();
  if (cached) return { text: cached.text, machine: true };

  if (!hasAnthropic()) return { text, machine: false };

  try {
    const message = await getClient().messages.create({
      model: ANTHROPIC_FAST_MODEL,
      max_tokens: 1024,
      system: `Translate the user's text into ${LANGUAGE_NAME[lang]} at a 6th-grade reading level. Keep numbers, units, drug names and trial names unchanged. Return only the translation.`,
      messages: [{ role: "user", content: text }],
    });
    const block = message.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    const translated = block?.text?.trim() ?? text;
    await admin.from("translations").upsert(
      { source_sha256: hash, lang, text: translated, model: ANTHROPIC_FAST_MODEL },
      { onConflict: "source_sha256,lang" },
    );
    return { text: translated, machine: true };
  } catch {
    return { text, machine: false };
  }
}

/** Translate several strings; returns a map keyed by the original text. */
export async function translateMany(texts: string[], lang: Language): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(texts.filter((t) => t.trim()))];
  for (const t of unique) {
    const { text } = await translateText(t, lang);
    out.set(t, text);
  }
  return out;
}
