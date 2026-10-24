import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Lightweight rate limiting by counting recent rows (B15) — no extra table.
 * Returns true if the action is allowed, false if the limit is exceeded.
 */
export async function withinRateLimit(opts: {
  table: string;
  column: string;
  value: string;
  windowMs: number;
  max: number;
}): Promise<boolean> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - opts.windowMs).toISOString();
  const { count } = await admin
    .from(opts.table)
    .select("id", { count: "exact", head: true })
    .eq(opts.column, opts.value)
    .gte("created_at", since);
  return (count ?? 0) < opts.max;
}

export const RATE_LIMITS = {
  uploadPerHour: 20,
  aiCheckPerHour: 10,
};
