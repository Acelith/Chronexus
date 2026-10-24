export const locales = [
  { id: "it", name: "Italiano", intl: "it-CH", dir: "ltr" },
  { id: "en", name: "English", intl: "en-GB", dir: "ltr" },
  { id: "de", name: "Deutsch", intl: "de-CH", dir: "ltr" },
  { id: "fr", name: "Français", intl: "fr-CH", dir: "ltr" },
  { id: "es", name: "Español", intl: "es-ES", dir: "ltr" },
  { id: "pt-BR", name: "Português (Brasil)", intl: "pt-BR", dir: "ltr" },
  { id: "ja", name: "日本語", intl: "ja-JP", dir: "ltr" },
  { id: "ko", name: "한국어", intl: "ko-KR", dir: "ltr" },
  { id: "zh-Hans", name: "简体中文", intl: "zh-CN", dir: "ltr" },
  { id: "ar", name: "العربية", intl: "ar", dir: "rtl" },
  {
    id: "lmo-CH",
    name: "Ticines · dialetto ticinese",
    intl: "it-CH",
    dir: "ltr",
  },
  { id: "tlh", name: "tlhIngan Hol · Klingon", intl: "en-GB", dir: "ltr" },
  { id: "art-x-rihan", name: "Rihannsu · Romulano", intl: "en-GB", dir: "ltr" },
] as const;
export type Locale = (typeof locales)[number]["id"];
export type Script = "standard" | "braille" | "morse" | "galactic";
export interface Preferences {
  version: 1;
  locale: Locale;
  script: Script;
  showOriginal: boolean;
}
export const defaultPreferences: Preferences = {
  version: 1,
  locale: "it",
  script: "standard",
  showOriginal: true,
};
export const localeInfo = (locale: Locale) =>
  locales.find((item) => item.id === locale)!;
export function validPreferences(value: unknown): value is Preferences {
  if (!value || typeof value !== "object") return false;
  const p = value as Preferences;
  return (
    p.version === 1 &&
    locales.some((l) => l.id === p.locale) &&
    ["standard", "braille", "morse", "galactic"].includes(p.script) &&
    typeof p.showOriginal === "boolean"
  );
}
