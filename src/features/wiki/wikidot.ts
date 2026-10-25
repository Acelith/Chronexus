import { localizeLabels, tr } from "../../i18n/store";
import { command } from "../journal/api";
import { emptyAsset, type AbilityDetails } from "../player/api";

export const wikidotBase = "https://dnd5e.wikidot.com/";
export const wikidotCategories = localizeLabels({
  spells: "Incantesimi",
  feats: "Talenti",
  species: "Specie e lignaggi",
  backgrounds: "Background",
  classes: "Classi e sottoclassi",
  items: "Oggetti magici",
} as const);
export type WikidotCategory = keyof typeof wikidotCategories;
export type Origin = "published" | "ua" | "homebrew" | "unspecified";
export const originLabels: Record<Origin, string> = localizeLabels({
  published: "Pubblicato (secondo la wiki)",
  ua: "Unearthed Arcana (playtest)",
  homebrew: "Homebrew",
  unspecified: "Origine non indicata",
});
export interface IndexRow {
  page: string;
  name: string;
  group: string;
  details: string[];
  origin: Origin;
}
export interface SearchResult {
  category: WikidotCategory;
  url: string;
  fetchedAt: string;
  cached: boolean;
  warning: string | null;
  indexSize: number;
  total: number;
  rows: IndexRow[];
}
export type Block =
  | { kind: "heading"; level: number; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "table"; rows: string[][] };
export interface SpellFields {
  level: string | null;
  school: string | null;
  levelLine: string | null;
  castingTime: string | null;
  range: string | null;
  components: string | null;
  duration: string | null;
  higherLevels: string | null;
  classes: string | null;
  description: string | null;
  ritual: boolean;
  concentration: boolean;
}
export interface Entry {
  page: string;
  url: string;
  category: WikidotCategory;
  title: string;
  source: string | null;
  origin: Origin;
  edition: string;
  license: string;
  blocks: Block[];
  spell: SpellFields | null;
  missing: string[];
  truncated: boolean;
}
export interface Cached<T> {
  payload: T;
  fetchedAt: string;
  cached: boolean;
  warning: string | null;
}
export const missingLabels: Record<string, string> = localizeLabels({
  level: "Livello",
  school: "Scuola",
  castingTime: "Tempo di lancio",
  range: "Gittata",
  components: "Componenti",
  duration: "Durata",
  description: "Descrizione",
});
/** Only the category and public page names reach Wikidot; the query stays local. */
export const wikidotApi = {
  search: (category: WikidotCategory, query: string, refresh = false) =>
    command<SearchResult>("wikidot_search", { category, query, refresh }),
  entry: (page: string, refresh = false) =>
    command<Cached<Entry>>("wikidot_entry", { page, refresh }),
  cancel: () => command<void>("cancel_wikidot"),
};
export function spellFromWikidot(entry: Entry): AbilityDetails {
  const s = entry.spell;
  if (entry.category !== "spells" || !s)
    throw Error(
      tr("Solo gli incantesimi possono essere importati nella scheda."),
    );
  const base = emptyAsset("spell", "dnd5e-2014").details as AbilityDetails;
  const description = [
    s.description ?? "",
    s.higherLevels ? tr("A livelli superiori") + "\n" + s.higherLevels : "",
    s.classes ? tr("Liste di incantesimi") + "\n" + s.classes : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const fields: AbilityDetails = {
    ...base,
    name: entry.title,
    rank: s.level ?? "",
    school: s.school ?? "",
    castingTime: s.castingTime ?? "",
    duration: s.duration ?? "",
    range: s.range ?? "",
    components: s.components ?? "",
    ritual: s.ritual,
    concentration: s.concentration,
    description,
    catalogSource: { path: entry.page, name: entry.title, provider: "wikidot" },
  };
  if (
    [
      fields.castingTime,
      fields.duration,
      fields.range,
      fields.components,
      fields.school,
      fields.rank,
    ].some((v) => v.length > 200) ||
    description.length > 16000 ||
    fields.name.length > 200
  )
    throw Error(
      tr(
        "Voce troppo lunga per l’importazione. Puoi consultarla e creare una voce personalizzata.",
      ),
    );
  return fields;
}
