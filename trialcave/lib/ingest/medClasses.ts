/**
 * Map a medication name to one or more vocabulary medication fields (B10.5).
 * Combination pills map to every class they contain. Pure, unit-tested.
 */

const CLASS_NAMES: Record<string, string[]> = {
  "med:metformin": ["metformin", "glucophage", "glumetza", "fortamet", "riomet"],
  "med:insulin": [
    "insulin", "glargine", "lantus", "basaglar", "toujeo", "semglee", "detemir",
    "levemir", "degludec", "tresiba", "lispro", "humalog", "admelog", "lyumjev",
    "aspart", "novolog", "fiasp", "glulisine", "apidra", "nph", "humulin", "novolin",
  ],
  "med:glp1": [
    "semaglutide", "ozempic", "wegovy", "rybelsus", "tirzepatide", "mounjaro",
    "zepbound", "liraglutide", "victoza", "saxenda", "dulaglutide", "trulicity",
    "exenatide", "byetta", "bydureon", "lixisenatide",
  ],
  "med:sglt2": [
    "empagliflozin", "jardiance", "dapagliflozin", "farxiga", "canagliflozin",
    "invokana", "ertugliflozin", "steglatro", "bexagliflozin", "sotagliflozin",
  ],
  "med:sulfonylurea": ["glipizide", "glucotrol", "glyburide", "glimepiride", "amaryl"],
  "med:dpp4": [
    "sitagliptin", "januvia", "linagliptin", "tradjenta", "saxagliptin", "onglyza",
    "alogliptin", "nesina",
  ],
  "med:statin": [
    "atorvastatin", "lipitor", "rosuvastatin", "crestor", "simvastatin", "zocor",
    "pravastatin", "lovastatin", "pitavastatin",
  ],
};

// Combination pills → the classes they contain.
const COMBINATIONS: Record<string, string[]> = {
  janumet: ["med:dpp4", "med:metformin"], // sitagliptin + metformin
  synjardy: ["med:sglt2", "med:metformin"], // empagliflozin + metformin
  xigduo: ["med:sglt2", "med:metformin"], // dapagliflozin + metformin
  kombiglyze: ["med:dpp4", "med:metformin"], // saxagliptin + metformin
  jentadueto: ["med:dpp4", "med:metformin"], // linagliptin + metformin
  glyxambi: ["med:sglt2", "med:dpp4"], // empagliflozin + linagliptin
  invokamet: ["med:sglt2", "med:metformin"], // canagliflozin + metformin
  trijardy: ["med:sglt2", "med:dpp4", "med:metformin"],
};

export function medFieldsFor(name: string): string[] {
  const lower = name.toLowerCase();
  const fields = new Set<string>();

  for (const [combo, classes] of Object.entries(COMBINATIONS)) {
    if (lower.includes(combo)) classes.forEach((c) => fields.add(c));
  }
  for (const [field, names] of Object.entries(CLASS_NAMES)) {
    if (names.some((n) => lower.includes(n))) fields.add(field);
  }
  return [...fields];
}
