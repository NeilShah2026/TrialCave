/**
 * Centralised environment access.
 *
 * Only NEXT_PUBLIC_* values are safe to read in the browser; everything else is
 * server-only. Server-only getters throw if called without a value so that a
 * misconfigured deploy fails loudly instead of silently misbehaving. During the
 * demo the app is designed to boot even with blank Supabase/Anthropic keys, so
 * we expose presence checks (hasSupabase, hasAnthropic) rather than forcing the
 * values at import time.
 */

export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function hasSupabase(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export function hasAnthropic(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/** Server-only: throws if the service role key isn't configured. */
export function serviceRoleKey(): string {
  return required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// Getters read process.env live. In Next.js NEXT_PUBLIC_* are inlined at build
// time; in CLI scripts (tsx) they're populated by dotenv at runtime, after this
// module is imported, so we must not capture them at module-load time.
export function supabaseUrl(): string {
  return required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function supabaseAnonKey(): string {
  return required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function anthropicApiKey(): string {
  return required("ANTHROPIC_API_KEY", process.env.ANTHROPIC_API_KEY);
}

export const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5";
export const ANTHROPIC_FAST_MODEL =
  process.env.ANTHROPIC_FAST_MODEL ?? "claude-haiku-5-5";

export const CONSENT_VERSION = process.env.CONSENT_VERSION ?? "2026-10-24";

// Platform numeric rules with safe defaults (B3).
function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const DONOR_SHARE = num("DONOR_SHARE", 0.5);
export const K_ANONYMITY_MIN = num("K_ANONYMITY_MIN", 10);
export const OUTREACH_MIN_SCORE = num("OUTREACH_MIN_SCORE", 0.6);
export const OUTREACH_COUNT_FLOOR = num("OUTREACH_COUNT_FLOOR", 5);
export const MAX_QUESTIONS_PER_TRIAL = num("MAX_QUESTIONS_PER_TRIAL", 5);
export const INVITATION_EXPIRY_DAYS = num("INVITATION_EXPIRY_DAYS", 30);
export const MAX_UPLOAD_MB = num("MAX_UPLOAD_MB", 10);

export const SUPPORTED_LANGUAGES = (
  process.env.SUPPORTED_LANGUAGES ?? "en,es,pt,ht"
).split(",").map((s) => s.trim()) as Array<"en" | "es" | "pt" | "ht">;
