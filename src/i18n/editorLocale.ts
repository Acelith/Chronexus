import {
  ar,
  de,
  en,
  es,
  fr,
  it,
  ja,
  ko,
  pt,
  zh,
} from "@blocknote/core/locales";
import { getPreferences } from "./store";
const dictionaries = {
  it,
  en,
  de,
  fr,
  es,
  "pt-BR": pt,
  ja,
  ko,
  "zh-Hans": zh,
  ar,
};
export function editorDictionary() {
  const locale = getPreferences().locale;
  return dictionaries[locale as keyof typeof dictionaries] ?? en;
}
