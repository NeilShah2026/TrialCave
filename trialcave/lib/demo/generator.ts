/**
 * Deterministic synthetic patient generator (B13.3).
 *
 * 200 background patients, is_synthetic=true, user_id=null. Uses a seeded RNG so
 * output is identical every run (idempotent seed, B0 rule 9). All facts are
 * confirmed, source='demo'. Names are internal only, never shown to clinics or
 * researchers.
 */

import seedrandom from "seedrandom";

import { TOWNS, GREATER_BOSTON_TOWNS } from "@/lib/geo/towns";
import type { Language } from "@/lib/types";

export interface SyntheticFact {
  field: string;
  value: number | boolean;
  unit: string | null;
  observedDaysAgo: number;
}

export interface SyntheticWearableDay {
  dayOffset: number; // days ago
  steps: number;
  restingHr: number;
  hrvMs: number;
  sleepHours: number;
  avgGlucose: number | null;
  timeInRange: number | null;
}

export interface SyntheticPatient {
  displayName: string;
  sex: "female" | "male";
  ageYears: number;
  town: string;
  lat: number;
  lon: number;
  travelRadiusMiles: number;
  preferredLanguage: Language;
  isDonor: boolean;
  facts: SyntheticFact[];
  connectedSources: string[];
  wearableDays: SyntheticWearableDay[];
  researchConsents: { dataType: string; researchType: string; allowed: boolean }[];
  contactPrefs: { allowInvitations: boolean; conditionCategories: string[] };
  group: "t2d" | "prediabetes" | "none";
}

const FIRST_NAMES = [
  "Alex", "Sam", "Jordan", "Taylor", "Casey", "Riley", "Morgan", "Jamie",
  "Avery", "Quinn", "Drew", "Reese", "Skyler", "Cameron", "Devin", "Hayden",
  "Rowan", "Emerson", "Finley", "Sawyer",
];
const LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
  "Davis", "Rodriguez", "Martinez", "Nguyen", "Silva", "Pierre", "Chen",
  "Santos", "Lopez", "Ferreira", "Tran", "Oliveira", "Costa",
];

type RNG = () => number;

function makeNormal(rng: RNG) {
  return (mean: number, sd: number) => {
    // Box-Muller
    const u1 = rng() || 1e-9;
    const u2 = rng();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + z * sd;
  };
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

function pick<T>(rng: RNG, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function chance(rng: RNG, p: number): boolean {
  return rng() < p;
}

function uniform(rng: RNG, lo: number, hi: number): number {
  return lo + rng() * (hi - lo);
}

const LANGS: Array<{ lang: Language; p: number }> = [
  { lang: "en", p: 0.75 },
  { lang: "es", p: 0.15 },
  { lang: "pt", p: 0.06 },
  { lang: "ht", p: 0.04 },
];

function pickLanguage(rng: RNG): Language {
  const r = rng();
  let acc = 0;
  for (const { lang, p } of LANGS) {
    acc += p;
    if (r < acc) return lang;
  }
  return "en";
}

export function generateSyntheticPatients(
  count = 200,
  seed = "trialcave-2026",
): SyntheticPatient[] {
  const rng = seedrandom(seed) as unknown as RNG;
  const normal = makeNormal(rng);
  const patients: SyntheticPatient[] = [];

  for (let i = 0; i < count; i++) {
    // Group: 60% t2d, 25% prediabetes, 15% none
    const gr = rng();
    const group: SyntheticPatient["group"] =
      gr < 0.6 ? "t2d" : gr < 0.85 ? "prediabetes" : "none";

    const sex: "female" | "male" = chance(rng, 0.5) ? "female" : "male";
    const ageYears =
      group === "t2d"
        ? Math.floor(uniform(rng, 40, 80))
        : group === "prediabetes"
          ? Math.floor(uniform(rng, 30, 70))
          : Math.floor(uniform(rng, 25, 70));

    // Town: 80% weighted to Greater Boston
    const town = chance(rng, 0.8) ? pick(rng, GREATER_BOSTON_TOWNS) : pick(rng, TOWNS);

    const bmi =
      group === "t2d"
        ? clamp(normal(32, 5), 19, 50)
        : group === "prediabetes"
          ? clamp(normal(29, 4), 19, 50)
          : clamp(normal(25, 3.5), 19, 50);

    const hba1c =
      group === "t2d"
        ? clamp(normal(7.9, 1.2), 6.5, 12)
        : group === "prediabetes"
          ? uniform(rng, 5.7, 6.4)
          : clamp(normal(5.2, 0.25), 4.6, 5.6);

    const fastingGlucose = 28.7 * hba1c - 46.7 + normal(0, 10);

    const egfr =
      group === "t2d"
        ? clamp(normal(75, 20), 15, 120)
        : clamp(normal(90, 15), 45, 120);

    const durationYears = group === "t2d" ? uniform(rng, 1, 20) : 0;

    const facts: SyntheticFact[] = [];
    const push = (field: string, value: number | boolean, unit: string | null, daysAgo: number) =>
      facts.push({ field, value, unit, observedDaysAgo: Math.round(daysAgo) });

    const recent = uniform(rng, 30, 300);

    // Diagnoses
    push("dx:type2_diabetes", group === "t2d", null, group === "t2d" ? durationYears * 365 : recent);
    push("dx:prediabetes", group === "prediabetes", null, recent);
    push("dx:type1_diabetes", false, null, recent);

    // Labs/vitals
    push("hba1c_pct", round1(hba1c), "%", recent);
    push("fasting_glucose_mgdl", Math.round(clamp(fastingGlucose, 40, 600)), "mg/dL", recent);
    push("bmi", round1(bmi), "kg/m²", recent);
    push("egfr", Math.round(egfr), "mL/min/1.73m²", recent);

    const ckd = egfr < 60;
    push("dx:ckd", ckd, null, recent);
    push("dx:dialysis", egfr < 15, null, recent);

    // Medications
    if (group === "t2d") {
      push("med:metformin", egfr >= 30 && chance(rng, 0.8), null, recent);
      const insulinP = durationYears > 10 ? 0.4 : 0.25;
      push("med:insulin", chance(rng, insulinP), null, recent);
      push("med:glp1", chance(rng, 0.3), null, recent);
      push("med:sglt2", chance(rng, 0.2), null, recent);
      push("med:statin", chance(rng, 0.6), null, recent);
    } else {
      push("med:statin", chance(rng, 0.25), null, recent);
    }

    // Events — known for only some patients (else unset)
    if (chance(rng, 0.7)) push("event:mi_6mo", chance(rng, 0.03), null, recent);
    if (chance(rng, 0.7)) push("event:stroke_6mo", chance(rng, 0.02), null, recent);

    // Pregnancy — female, age < 45, known for 80%
    if (sex === "female" && ageYears < 45 && chance(rng, 0.8)) {
      push("pregnant_or_breastfeeding", chance(rng, 0.03), null, recent);
    }

    push("current_smoker", chance(rng, 0.12), null, recent);

    // Retinopathy for t2d
    if (group === "t2d") {
      const retP = durationYears > 10 ? 0.35 : 0.1;
      push("dx:retinopathy", chance(rng, retP), null, recent);
    }

    // Wearable
    const hasWearable = chance(rng, 0.55);
    const connectedSources: string[] = [];
    if (hasWearable) connectedSources.push(chance(rng, 0.5) ? "apple_health" : "fitbit");
    const cgmP = group === "t2d" ? 0.3 : group === "prediabetes" ? 0.05 : 0;
    const hasCgm = chance(rng, cgmP);
    if (hasCgm) connectedSources.push("dexcom");

    const wearableDays: SyntheticWearableDay[] = [];
    if (hasWearable) {
      const stepsBase = group === "t2d" ? 5500 : group === "prediabetes" ? 7000 : 8500;
      for (let d = 0; d < 90; d++) {
        const steps = Math.round(stepsBase * uniform(rng, 0.75, 1.25));
        const restingHr = Math.round(uniform(rng, 60, 82));
        const hrvMs = Math.round(uniform(rng, 25, 60));
        const sleepHours = round1(uniform(rng, 5.5, 8.0));
        let avgGlucose: number | null = null;
        let timeInRange: number | null = null;
        if (hasCgm) {
          avgGlucose = Math.round(28.7 * hba1c - 46.7 + normal(0, 12));
          timeInRange = Math.round(clamp(100 - (hba1c - 6) * 14 + normal(0, 8), 10, 98));
        }
        wearableDays.push({ dayOffset: d, steps, restingHr, hrvMs, sleepHours, avgGlucose, timeInRange });
      }
    }

    // Donor + consents
    const isDonor = chance(rng, 0.7);
    const researchConsents: SyntheticPatient["researchConsents"] = [];
    if (isDonor) {
      const dataTypes = ["wearables", "labs", "imaging", "history"];
      for (const dt of dataTypes) {
        const imagingAllowed = dt === "imaging" ? chance(rng, 0.5) : true;
        researchConsents.push({ dataType: dt, researchType: "academic", allowed: imagingAllowed && chance(rng, 0.9) });
        researchConsents.push({ dataType: dt, researchType: "pharma", allowed: imagingAllowed && chance(rng, 0.7) });
        researchConsents.push({ dataType: dt, researchType: "ai", allowed: imagingAllowed && chance(rng, 0.4) });
        researchConsents.push({ dataType: dt, researchType: "device", allowed: imagingAllowed && chance(rng, 0.6) });
      }
    }

    // Contact prefs
    const allowInvitations = chance(rng, 0.65);
    const conditionCategories = ["diabetes_metabolic"];
    if (chance(rng, 0.3)) conditionCategories.push("kidney");
    if (chance(rng, 0.3)) conditionCategories.push("cardiology");

    const travelRadiusMiles = pick(rng, [10, 20, 30, 50]);

    patients.push({
      displayName: `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`,
      sex,
      ageYears,
      town: town.name,
      lat: town.lat,
      lon: town.lon,
      travelRadiusMiles,
      preferredLanguage: pickLanguage(rng),
      isDonor,
      facts,
      connectedSources,
      wearableDays,
      researchConsents,
      contactPrefs: { allowInvitations, conditionCategories },
      group,
    });
  }

  return patients;
}
