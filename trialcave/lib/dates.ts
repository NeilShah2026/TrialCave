import { subDays, subMonths, subYears, format } from "date-fns";

export interface RelativeAgo {
  years?: number;
  months?: number;
  days?: number;
}

/** Returns a Date `ago` before `from` (defaults to now). */
export function dateAgo(ago: RelativeAgo, from: Date = new Date()): Date {
  let d = from;
  if (ago.years) d = subYears(d, ago.years);
  if (ago.months) d = subMonths(d, ago.months);
  if (ago.days) d = subDays(d, ago.days);
  return d;
}

/** ISO date (YYYY-MM-DD) for a relative-ago spec. */
export function isoDateAgo(ago: RelativeAgo, from: Date = new Date()): string {
  return format(dateAgo(ago, from), "yyyy-MM-dd");
}

/** ISO date for N days ago. */
export function isoDaysAgo(days: number, from: Date = new Date()): string {
  return format(subDays(from, days), "yyyy-MM-dd");
}

/** Birth date for a given whole-year age (approx; sets to today minus N years). */
export function birthDateForAge(ageYears: number, from: Date = new Date()): string {
  return format(subYears(from, ageYears), "yyyy-MM-dd");
}
