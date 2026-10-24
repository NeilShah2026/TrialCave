export type Language = "en" | "es" | "pt" | "ht";

export const LANGUAGES: { code: Language; label: string; nativeLabel: string }[] = [
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "es", label: "Spanish", nativeLabel: "Español" },
  { code: "pt", label: "Portuguese", nativeLabel: "Português" },
  { code: "ht", label: "Haitian Creole", nativeLabel: "Kreyòl ayisyen" },
];

export const LANGUAGE_NAME: Record<Language, string> = {
  en: "English",
  es: "Spanish",
  pt: "Portuguese",
  ht: "Haitian Creole",
};

export function isLanguage(x: string): x is Language {
  return x === "en" || x === "es" || x === "pt" || x === "ht";
}
