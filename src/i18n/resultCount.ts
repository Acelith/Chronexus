import { locales, localeInfo } from "./locales";
import { getPreferences, number } from "./store";
type Forms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };
// Small, explicit count messages; variants belong to catalogs, never campaign records.
const forms: Record<string, Forms> = {
  it: { one: "{0} risultato", other: "{0} risultati" },
  en: { one: "{0} result", other: "{0} results" },
  de: { one: "{0} Ergebnis", other: "{0} Ergebnisse" },
  fr: { one: "{0} résultat", other: "{0} résultats" },
  es: { one: "{0} resultado", other: "{0} resultados" },
  "pt-BR": { one: "{0} resultado", other: "{0} resultados" },
  ja: { other: "検索結果 {0} 件" },
  ko: { other: "결과 {0}개" },
  "zh-Hans": { other: "{0} 条结果" },
  ar: {
    zero: "لا نتائج",
    one: "نتيجة واحدة",
    two: "نتيجتان",
    few: "{0} نتائج",
    many: "{0} نتيجة",
    other: "{0} نتيجة",
  },
  "lmo-CH": { other: "{0} risultaa" },
};
const rules = new Map(locales.map((l) => [l.id, new Intl.PluralRules(l.intl)]));
export function resultCount(count: number) {
  const locale = getPreferences().locale,
    catalog = forms[locale] ?? forms.it;
  const message = catalog[rules.get(locale)!.select(count)] ?? catalog.other;
  const rendered = number(count);
  return message.replace(
    "{0}",
    localeInfo(locale).dir === "rtl" ? `\u2068${rendered}\u2069` : rendered,
  );
}
