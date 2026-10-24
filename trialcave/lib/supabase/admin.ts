import "server-only";

import { createClient } from "@supabase/supabase-js";

import { serviceRoleKey, supabaseUrl } from "@/lib/env";

/**
 * Service-role Supabase client. Bypasses RLS, so it must only be used in
 * server code after an explicit authorization check from lib/auth.ts (B0 rule 1).
 * Never import this from a file that can run in the browser.
 */
export function createAdminClient() {
  return createClient(supabaseUrl(), serviceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
