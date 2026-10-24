/**
 * Stage 1 pre-filter (B9.3). Pure, unit-tested. A trial is skipped (no
 * match_results row) if any hard filter fails.
 */

import { haversineMiles, roundMiles } from "@/lib/geo/distance";
import type { TrialLocation } from "@/lib/ctgov/normalize";

export interface PrefilterPatient {
  ageYears: number;
  sex: "female" | "male";
  lat: number;
  lon: number;
  travelRadiusMiles: number;
}

export interface PrefilterTrial {
  source: "ctgov" | "clinic";
  overallStatus: string;
  studyStatus: string;
  minAgeYears: number | null;
  maxAgeYears: number | null;
  sex: "ALL" | "FEMALE" | "MALE";
  locations: TrialLocation[];
}

export interface PrefilterResult {
  keep: boolean;
  /** Distance to nearest located site in miles, or null if no coordinates. */
  distanceMiles: number | null;
}

export function prefilterTrial(
  patient: PrefilterPatient,
  trial: PrefilterTrial,
): PrefilterResult {
  // Recruiting / active.
  if (trial.source === "ctgov" && trial.overallStatus !== "RECRUITING") {
    return { keep: false, distanceMiles: null };
  }
  if (trial.source === "clinic" && trial.studyStatus !== "active") {
    return { keep: false, distanceMiles: null };
  }

  // Age.
  if (trial.minAgeYears !== null && patient.ageYears < trial.minAgeYears) {
    return { keep: false, distanceMiles: null };
  }
  if (trial.maxAgeYears !== null && patient.ageYears > trial.maxAgeYears) {
    return { keep: false, distanceMiles: null };
  }

  // Sex.
  if (trial.sex === "FEMALE" && patient.sex !== "female") {
    return { keep: false, distanceMiles: null };
  }
  if (trial.sex === "MALE" && patient.sex !== "male") {
    return { keep: false, distanceMiles: null };
  }

  // Distance: nearest located site. Keep within 2× radius (B9.3). Trials with no
  // coordinates are kept with distance null.
  const located = trial.locations.filter((l) => l.lat != null && l.lon != null);
  if (located.length > 0) {
    let nearest = Number.POSITIVE_INFINITY;
    for (const l of located) {
      const m = haversineMiles(patient.lat, patient.lon, l.lat as number, l.lon as number);
      if (m < nearest) nearest = m;
    }
    if (nearest > patient.travelRadiusMiles * 2) {
      return { keep: false, distanceMiles: roundMiles(nearest) };
    }
    return { keep: true, distanceMiles: roundMiles(nearest) };
  }

  return { keep: true, distanceMiles: null };
}
