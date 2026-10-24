/** Human labels for condition categories, shared by UI. */
export const CATEGORY_LABELS: Record<string, string> = {
  diabetes_metabolic: "Diabetes & metabolic",
  cardiology: "Heart & cardiology",
  kidney: "Kidney",
  oncology: "Cancer",
  neurology: "Brain & nervous system",
  other: "Other",
};

export function categoryLabel(key: string): string {
  return CATEGORY_LABELS[key] ?? "Other";
}

export const CATEGORY_OPTIONS = [
  { value: "all", label: "All conditions" },
  ...Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
];
