import type { Lang } from "@/lib/usePrefs";

const DATE_LOCALE_BY_LANG: Record<Lang, string> = {
  en: "en-US",
  es: "es-AR",
  fr: "fr-FR",
  it: "it-IT",
};

export function getDateLocale(lang?: Lang | null) {
  if (!lang) return DATE_LOCALE_BY_LANG.en;
  return DATE_LOCALE_BY_LANG[lang] ?? DATE_LOCALE_BY_LANG.en;
}
