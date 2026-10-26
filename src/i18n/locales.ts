export const locales = [
  { id: "en", name: "English", intl: "en-GB", dir: "ltr" },
  { id: "it", name: "Italiano", intl: "it-CH", dir: "ltr" },
  { id: "de", name: "Deutsch", intl: "de-CH", dir: "ltr" },
  { id: "fr", name: "Français", intl: "fr-CH", dir: "ltr" },
  { id: "es", name: "Español", intl: "es-ES", dir: "ltr" },
  { id: "pt-BR", name: "Português (Brasil)", intl: "pt-BR", dir: "ltr" },
  { id: "ja", name: "日本語", intl: "ja-JP", dir: "ltr" },
  { id: "ko", name: "한국어", intl: "ko-KR", dir: "ltr" },
  { id: "zh-Hans", name: "简体中文", intl: "zh-CN", dir: "ltr" },
  { id: "ar", name: "العربية", intl: "ar", dir: "rtl" },
] as const;
export type Locale = (typeof locales)[number]["id"];
/** A saved choice: a locale, or "system" to follow the operating system. */
export type LocaleChoice = Locale | "system";
export type Script =
  "standard" | "braille" | "morse" | "galactic" | "espruar" | "dethek";
/** Preferences in effect, with the locale already resolved. */
export interface Preferences {
  version: 2;
  locale: Locale;
  script: Script;
  showOriginal: boolean;
}
/** Preferences as stored, where the locale may still be "system". */
export interface SavedPreferences extends Omit<Preferences, "locale"> {
  locale: LocaleChoice;
}
export const defaultPreferences: Preferences = {
  version: 2,
  locale: "en",
  script: "standard",
  showOriginal: true,
};
export const localeInfo = (locale: Locale) =>
  locales.find((item) => item.id === locale)!;
/** Maps a BCP 47 or POSIX language tag to a bundled locale, if any. */
export function matchLocale(tag: string): Locale | null {
  const [language = "", ...rest] = tag.trim().toLowerCase().split(/[-_.]/);
  if (language === "zh")
    // Only Simplified Chinese is bundled: Traditional falls through.
    return rest.includes("hans") ||
      !rest.some((part) => ["hant", "tw", "hk", "mo"].includes(part))
      ? "zh-Hans"
      : null;
  if (language === "pt") return "pt-BR";
  return locales.find((l) => l.id === language)?.id ?? null;
}
function systemLanguages(): readonly string[] {
  if (typeof navigator === "undefined") return [];
  return navigator.languages?.length
    ? navigator.languages
    : [navigator.language].filter(Boolean);
}
/** The first OS language with a bundled translation, otherwise English. */
export function systemLocale(languages = systemLanguages()): Locale {
  for (const tag of languages) {
    const match = matchLocale(tag);
    if (match) return match;
  }
  return "en";
}
export const resolveLocale = (choice: LocaleChoice): Locale =>
  choice === "system" ? systemLocale() : choice;
export function validPreferences(value: unknown): value is SavedPreferences {
  if (!value || typeof value !== "object") return false;
  const p = value as SavedPreferences;
  return (
    p.version === 2 &&
    (p.locale === "system" || locales.some((l) => l.id === p.locale)) &&
    ["standard", "braille", "morse", "galactic", "espruar", "dethek"].includes(
      p.script,
    ) &&
    typeof p.showOriginal === "boolean"
  );
}
