import { command } from "../journal/api";

export type WikiProvider = "wikidot" | "open5e";
export interface WikiChoice {
  provider: WikiProvider;
  /** False while Wikidot is only the default and nothing was saved. */
  explicit: boolean;
}
export interface ProviderCache {
  entries: number;
  bytes: number;
  aiSources: number;
}
export interface CacheSummary {
  open5e: ProviderCache;
  wikidot: ProviderCache;
}
export const providerNames: Record<WikiProvider, string> = {
  wikidot: "Wikidot D&D 5e",
  open5e: "Open5e",
};
/** Broadcast so open wiki views follow a provider change or a cache clear. */
export const WIKI_CHANGED = "chronexus:wiki-changed";
export function announceWikiChange() {
  window.dispatchEvent(new Event(WIKI_CHANGED));
}
export const wikiProviderApi = {
  get: () => command<WikiChoice>("get_wiki_provider"),
  save: (provider: WikiProvider) =>
    command<WikiChoice>("save_wiki_provider", { provider }),
  summary: () => command<CacheSummary>("wiki_cache_summary"),
  clear: (provider: WikiProvider | "all") =>
    command<CacheSummary>("clear_wiki_cache", { provider }),
};
