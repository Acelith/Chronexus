import { useSyncExternalStore } from "react";
import {
  defaultPreferences,
  localeInfo,
  resolveLocale,
  validPreferences,
  type Preferences,
  type Locale,
  type SavedPreferences,
} from "./locales";
import english from "./catalogs/en.json";
import italian from "./catalogs/it.json";
type Catalog = Record<string, string>;
// English is the source language. Italian stays bundled: it was the source
// until 0.8.0, so saved labels and older backend messages may still use it.
const catalogs: Partial<Record<Locale, Catalog>> = { en: english, it: italian };
const loaders: Partial<Record<Locale, () => Promise<{ default: Catalog }>>> = {
  de: () => import("./catalogs/de.json"),
  fr: () => import("./catalogs/fr.json"),
  es: () => import("./catalogs/es.json"),
  "pt-BR": () => import("./catalogs/pt-BR.json"),
  ja: () => import("./catalogs/ja.json"),
  ko: () => import("./catalogs/ko.json"),
  "zh-Hans": () => import("./catalogs/zh-Hans.json"),
  ar: () => import("./catalogs/ar.json"),
};
const reverse = new Map(
  Object.entries(english).map(([id, text]) => [text.trim(), id]),
);
const legacy = new Map(
  Object.entries(italian).map(([id, text]) => [text.trim(), id]),
);
const idFor = (text: string) => reverse.get(text) ?? legacy.get(text);
let current: Preferences = { ...defaultPreferences };
let saved: SavedPreferences = { ...defaultPreferences };
const listeners = new Set<() => void>();
/** Preferences in effect: the locale is always a bundled one. */
export function getPreferences() {
  return current;
}
export function usePreferences() {
  return useSyncExternalStore(subscribe, getPreferences, getPreferences);
}
/** Preferences as chosen, where the locale may be "system". */
export function getSavedPreferences() {
  return saved;
}
export function useSavedPreferences() {
  return useSyncExternalStore(
    subscribe,
    getSavedPreferences,
    getSavedPreferences,
  );
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export async function loadLocale(locale: Locale) {
  if (catalogs[locale]) return;
  const loader = loaders[locale];
  if (loader) {
    const module = await loader();
    catalogs[locale] = module.default;
  } else catalogs[locale] = {};
}
export function applyPreferences(preferences: SavedPreferences) {
  if (!validPreferences(preferences))
    throw Error("Invalid language preferences.");
  saved = { ...preferences };
  current = { ...preferences, locale: resolveLocale(preferences.locale) };
  const info = localeInfo(current.locale);
  if (typeof document !== "undefined") {
    document.documentElement.lang = info.id;
    document.documentElement.dir = info.dir;
    document.documentElement.dataset.script = current.script;
  }
  listeners.forEach((listener) => listener());
}
export function catalogFor(locale: Locale): Catalog {
  return catalogs[locale] ?? {};
}
export function translationCoverage(locale = current.locale) {
  const catalog = catalogFor(locale);
  const ids = Object.keys(english);
  return {
    translated:
      locale === "en"
        ? ids.length
        : ids.filter(
            (id) => typeof catalog[id] === "string" && catalog[id].length > 0,
          ).length,
    total: ids.length,
  };
}
export function translate(source: string, values: unknown[] = []): string {
  const leading = source.match(/^\s*/)?.[0] ?? "",
    trailing = source.match(/\s*$/)?.[0] ?? "";
  const raw = source.trim();
  const id = idFor(raw);
  const catalog = catalogFor(current.locale);
  let message = id
    ? (catalog[id] ?? english[id as keyof typeof english] ?? raw)
    : raw;
  message = message.replace(/\{(\d+)\}/g, (token, index) => {
    if (Number(index) >= values.length) return token;
    const value = values[Number(index)];
    const rendered =
      typeof value === "number" && !raw.includes(`d{${index}}`)
        ? number(value)
        : String(value ?? "");
    return localeInfo(current.locale).dir === "rtl"
      ? `\u2068${rendered}\u2069`
      : rendered;
  });
  return leading + message + trailing;
}
export const tr = translate;
const numberFormats = new Map<string, Intl.NumberFormat>();
const dateFormats = new Map<string, Intl.DateTimeFormat>();
export function number(value: number, options: Intl.NumberFormatOptions = {}) {
  const locale = localeInfo(current.locale).intl;
  const key = locale + JSON.stringify(options);
  let formatter = numberFormats.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, options);
    numberFormats.set(key, formatter);
  }
  return formatter.format(value);
}
export function date(
  value: Date | string | number,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
) {
  const parsed =
    typeof value === "string" || typeof value === "number"
      ? new Date(value)
      : value;
  if (!Number.isFinite(parsed.getTime())) return tr("Date not given");
  const locale = localeInfo(current.locale).intl;
  const key = locale + JSON.stringify(options);
  let formatter = dateFormats.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    dateFormats.set(key, formatter);
  }
  return formatter.format(parsed);
}
export function plural(
  count: number,
  forms: Partial<Record<Intl.LDMLPluralRule, string>> & { other: string },
) {
  const category = new Intl.PluralRules(localeInfo(current.locale).intl).select(
    count,
  );
  return tr(forms[category] ?? forms.other, [count]);
}
export function localizeLabels<T extends object>(source: T): T {
  return new Proxy(source, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver) as unknown;
      if (typeof value === "string") return tr(value);
      if (value && typeof value === "object") return localizeLabels(value);
      return value;
    },
  });
}
const patterns = [...Object.entries(english), ...Object.entries(italian)]
  .filter(([, text]) => /\{\d+\}/.test(text))
  .map(([, text]) => {
    const indices: number[] = [];
    const escaped = text
      .split(/(\{\d+\})/)
      .map((part) => {
        if (/^\{\d+\}$/.test(part)) {
          indices.push(Number(part.slice(1, -1)));
          return "([\\s\\S]*?)";
        }
        return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      })
      .join("");
    return { source: text, indices, pattern: new RegExp("^" + escaped + "$") };
  });
export function translateError(message: string) {
  if (idFor(message.trim())) return tr(message);
  for (const item of patterns) {
    const match = message.match(item.pattern);
    if (match) {
      const values: unknown[] = [];
      item.indices.forEach((index, i) => {
        values[index] = match[i + 1];
      });
      return tr(item.source, values);
    }
  }
  return message;
}
/** Only diagnostics/status supplied by the app; never use for canonical notes or AI answers. */
export function systemMessage(message: string | null | undefined) {
  return message ? translateError(message) : message;
}
