import { Channel } from "@tauri-apps/api/core";
import { command } from "../journal/api";
import type { SearchResult } from "../search/SearchPanel";
export interface Settings {
  enabled: boolean;
  model: string;
  digest: string;
  specialization: string;
}
export interface Model {
  name: string;
  digest: string;
  quantization: string;
  weightDigest: string | null;
  dndSpecialized: boolean;
  residentBytes: number;
  gpuBytes: number;
}
export interface Runtime {
  version: string;
  cloudDisabled: boolean;
  models: Model[];
}
export interface Source {
  key: string;
  kind: SearchResult["kind"] | "wiki";
  sourceId: string;
  blockId: string | null;
  title: string;
  revision: number;
  text: string;
  hash: string;
  edition: string | null;
}
export interface Turn {
  id: string;
  campaignId: string;
  question: string;
  mode: string;
  edition: string | null;
  model: string;
  digest: string;
  status: string;
  answer: string;
  sources: Source[];
  metrics: Record<string, unknown>;
  error: string;
  createdAt: string;
}
export interface Rule {
  key: string;
  title: string;
  document: string;
}
export interface Event {
  requestId: string;
  phase: string;
  text: string;
}
export const assistantApi = {
  settings: (campaignId?: string) =>
    command<Settings>("get_ai_settings", { campaignId }),
  probe: () => command<Runtime>("probe_local_ai"),
  configure: (
    enabled: boolean,
    model: string,
    multilingualConsent: boolean,
    campaignId?: string,
  ) =>
    command<Settings>("configure_local_ai", {
      enabled,
      model,
      multilingualConsent,
      campaignId,
    }),
  history: (campaignId: string, offset = 0) =>
    command<Turn[]>("list_ai_history", { campaignId, offset }),
  rules: (edition: string) =>
    command<Rule[]>("list_ai_rule_sources", { edition }),
  ask: (
    request: {
      id: string;
      campaignId: string;
      question: string;
      mode: string;
      edition: string | null;
      ruleKeys: string[];
      /** Interface locale: the assistant answers in this language. */
      locale: string;
    },
    onEvent: (e: Event) => void,
  ) => {
    const events = new Channel<Event>();
    events.onmessage = onEvent;
    return command<Turn>("ask_local_ai", { request, events });
  },
  cancel: (id: string) => command<void>("cancel_local_ai", { id }),
  remove: (campaignId: string, id: string) =>
    command<void>("delete_ai_turn", { campaignId, id }),
  source: (campaignId: string, turnId: string, key: string) =>
    command<{ available: boolean; changed: boolean; title: string }>(
      "check_ai_source",
      { campaignId, turnId, key },
    ),
};
