/**
 * Unit conversions for lab/vital values (B10.5). Pure, unit-tested.
 * Converts a raw value+unit for a vocabulary field to the field's canonical unit.
 * Returns null if the unit is unrecognized for that field.
 */

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

export interface ConvertResult {
  value: number;
  unit: string;
}

/**
 * Convert to the vocabulary unit. `rawUnit` may be null/empty (assume canonical).
 */
export function convertToCanonical(
  field: string,
  value: number,
  rawUnit: string | null,
): ConvertResult | null {
  const u = (rawUnit ?? "").trim().toLowerCase();

  switch (field) {
    case "hba1c_pct":
      if (u === "" || u === "%") return { value: round1(value), unit: "%" };
      if (u === "mmol/mol") return { value: round1(value / 10.929 + 2.15), unit: "%" };
      return null;

    case "fasting_glucose_mgdl":
      if (u === "" || u === "mg/dl") return { value: round1(value), unit: "mg/dL" };
      if (u === "mmol/l") return { value: round1(value * 18), unit: "mg/dL" };
      return null;

    case "ldl_mgdl":
      if (u === "" || u === "mg/dl") return { value: round1(value), unit: "mg/dL" };
      if (u === "mmol/l") return { value: round1(value * 38.67), unit: "mg/dL" };
      return null;

    case "triglycerides_mgdl":
      if (u === "" || u === "mg/dl") return { value: round1(value), unit: "mg/dL" };
      if (u === "mmol/l") return { value: round1(value * 88.57), unit: "mg/dL" };
      return null;

    case "weight_kg":
      if (u === "" || u === "kg") return { value: round1(value), unit: "kg" };
      if (u === "lb" || u === "lbs") return { value: round1(value * 0.4536), unit: "kg" };
      return null;

    case "egfr":
      return { value: round1(value), unit: "mL/min/1.73m²" };
    case "alt_ul":
      return { value: round1(value), unit: "U/L" };
    case "bmi":
      return { value: round1(value), unit: "kg/m²" };
    case "systolic_bp":
    case "diastolic_bp":
      return { value: Math.round(value), unit: "mmHg" };

    default:
      return null;
  }
}
