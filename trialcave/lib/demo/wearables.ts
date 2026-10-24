/**
 * Deterministic sample device data for demo connectors (B14.3 mock connectors).
 * Seeded by patient id + source so reconnecting gives the same data (B0 rule 9).
 * No location or route data, ever (B0 rule 11).
 */
import seedrandom from "seedrandom";
import { format, subDays } from "date-fns";

export interface WearableDayRow {
  day: string;
  steps: number | null;
  resting_hr: number | null;
  hrv_ms: number | null;
  sleep_hours: number | null;
  avg_glucose_mgdl: number | null;
  time_in_range_pct: number | null;
}

export function generateWearableDays(seed: string, opts: { cgm: boolean; days?: number }): WearableDayRow[] {
  const rng = seedrandom(seed);
  const days = opts.days ?? 90;
  const stepsBase = 4500 + Math.floor(rng() * 4500);
  const hrBase = 60 + Math.floor(rng() * 16);
  const glucoseBase = 120 + Math.floor(rng() * 60);
  const today = new Date();
  const rows: WearableDayRow[] = [];
  for (let d = 0; d < days; d++) {
    const jitter = () => 0.8 + rng() * 0.4;
    rows.push({
      day: format(subDays(today, d), "yyyy-MM-dd"),
      steps: opts.cgm ? null : Math.round(stepsBase * jitter()),
      resting_hr: opts.cgm ? null : Math.round(hrBase + (rng() - 0.5) * 8),
      hrv_ms: opts.cgm ? null : Math.round(30 + rng() * 30),
      sleep_hours: opts.cgm ? null : Math.round((5.5 + rng() * 2.5) * 10) / 10,
      avg_glucose_mgdl: opts.cgm ? Math.round(glucoseBase * jitter()) : null,
      time_in_range_pct: opts.cgm ? Math.round(Math.min(98, Math.max(20, 100 - (glucoseBase - 100) * 0.6 + (rng() - 0.5) * 16))) : null,
    });
  }
  return rows;
}
