"use client";

import { createBrowserClient } from "@supabase/ssr";

import { supabaseAnonKey, supabaseUrl } from "@/lib/env";

/**
 * Browser Supabase client. Used only for the signed-in user's own rows, which
 * are protected by RLS (B0 rule 1). All cross-party access goes through server
 * code with the admin client.
 */
export function createClient() {
  return createBrowserClient(supabaseUrl(), supabaseAnonKey());
}
