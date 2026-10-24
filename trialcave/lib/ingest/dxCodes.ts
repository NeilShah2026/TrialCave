/**
 * Map a diagnosis/event (ICD-10 + name) to a vocabulary field (B10.5).
 * ICD-10 prefix wins, then name keywords. Events with a 6-month window check
 * the fact date. Pure, unit-tested.
 */

import { differenceInDays, parseISO } from "date-fns";

interface DxRule {
  field: string;
  icd10Prefixes: string[];
  keywords: string[];
  /** If set, only maps when the fact date is within N days of today. */
  withinDays?: number;
}

const DX_RULES: DxRule[] = [
  { field: "dx:type2_diabetes", icd10Prefixes: ["E11"], keywords: ["type 2 diabetes", "type ii diabetes", "t2dm", "dm2"] },
  { field: "dx:type1_diabetes", icd10Prefixes: ["E10"], keywords: ["type 1 diabetes", "t1dm"] },
  { field: "dx:prediabetes", icd10Prefixes: ["R73.03", "R73.01", "R73.09"], keywords: ["prediabetes", "impaired fasting glucose"] },
  { field: "dx:ckd", icd10Prefixes: ["N18"], keywords: ["chronic kidney disease", "ckd"] },
  { field: "dx:dialysis", icd10Prefixes: ["Z99.2", "N18.6"], keywords: ["dialysis", "esrd", "end-stage renal"] },
  { field: "dx:heart_failure", icd10Prefixes: ["I50"], keywords: ["heart failure", "chf", "hfref", "hfpef"] },
  { field: "dx:hypertension", icd10Prefixes: ["I10", "I11", "I12", "I13", "I15", "I16"], keywords: ["hypertension", "htn"] },
  { field: "dx:retinopathy", icd10Prefixes: ["E11.31", "E11.32", "E11.33", "E11.34", "E11.35", "E10.31", "E10.32", "E10.33", "E10.34", "E10.35", "H36"], keywords: ["retinopathy"] },
  { field: "dx:liver_disease", icd10Prefixes: ["K70", "K71", "K72", "K73", "K74", "K75", "K76", "K77"], keywords: ["cirrhosis", "fatty liver", "nafld", "masld", "hepatitis"] },
  { field: "dx:pancreatitis_history", icd10Prefixes: ["K85", "K86.0", "K86.1"], keywords: ["pancreatitis"] },
  { field: "event:mi_6mo", icd10Prefixes: ["I21", "I22"], keywords: ["myocardial infarction", "heart attack", "stemi", "nstemi"], withinDays: 183 },
  { field: "event:stroke_6mo", icd10Prefixes: ["I63"], keywords: ["stroke", "cva"], withinDays: 183 },
  { field: "event:bariatric_surgery", icd10Prefixes: ["Z98.84"], keywords: ["gastric bypass", "sleeve gastrectomy", "bariatric"] },
];

export interface DxMatch {
  field: string;
  /** For event fields: whether the date fell inside the window. */
  withinWindow: boolean;
}

export function dxFieldFor(
  icd10: string | null,
  name: string,
  factDate: string | null,
  today: Date = new Date(),
): DxMatch | null {
  const code = (icd10 ?? "").toUpperCase().trim();
  const lower = name.toLowerCase();

  for (const rule of DX_RULES) {
    const codeMatch = code && rule.icd10Prefixes.some((p) => code.startsWith(p.toUpperCase()));
    const nameMatch = rule.keywords.some((k) => lower.includes(k));
    if (!codeMatch && !nameMatch) continue;

    if (rule.withinDays) {
      // Event fields: only map to true when the date is inside the window.
      if (!factDate) return { field: rule.field, withinWindow: false };
      const days = differenceInDays(today, parseISO(factDate));
      return { field: rule.field, withinWindow: days >= 0 && days <= rule.withinDays };
    }
    return { field: rule.field, withinWindow: true };
  }
  return null;
}
