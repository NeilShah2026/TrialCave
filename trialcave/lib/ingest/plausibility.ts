/**
 * Plausibility check for numeric values (B10.5). A value outside the vocabulary
 * field's plausible range is flagged and becomes a display-only fact. Pure.
 */

import { getVocabField } from "@/lib/matching/vocabulary";

export function isPlausible(field: string, value: number): boolean {
  const vocab = getVocabField(field);
  if (!vocab?.plausible) return true;
  return value >= vocab.plausible.min && value <= vocab.plausible.max;
}
