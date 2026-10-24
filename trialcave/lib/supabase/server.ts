import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { supabaseAnonKey, supabaseUrl } from "@/lib/env";

/**
 * Server Supabase client bound to the request's cookies. Runs under the signed-in
 * user's session with RLS enforced. In Next 16 `cookies()` is async.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component where cookies can't be set. The
          // session is refreshed in proxy.ts, so this is safe to ignore.
        }
      },
    },
  });
}
