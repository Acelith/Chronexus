import { command } from "../journal/api";
import type { Settings, Source } from "./api";
export interface Stamp {
  key: string;
  hash: string;
}
export interface Profile {
  settings: Settings;
  edition: string;
  context: number;
  maxTokens: number;
  includeKinds: string[];
  excludedIds: string[];
  ruleKeys: string[];
  indexedAt: string | null;
  manifest: Stamp[];
  /** Where questions run: this computer or the campaign's sharing server (M25.10). */
  execution: "local" | "server";
  /** Model chosen among those the campaign's server allows. */
  serverModel: string;
}
export interface Overview {
  profile: Profile;
  sources: Source[];
  added: number;
  changed: number;
  removed: number;
  sourceError?: string;
}
export const campaignAi = {
  get: (campaignId: string) =>
    command<Overview>("get_campaign_ai", { campaignId }),
  save: (campaignId: string, profile: Profile) =>
    command<Profile>("save_campaign_ai", { campaignId, profile }),
  refresh: (campaignId: string) =>
    command<Overview>("refresh_campaign_ai", { campaignId }),
};

export interface ServerAiModel {
  name: string;
  pinnedDigest: string | null;
  available: boolean;
}
export interface ServerAiView {
  server: string;
  status: {
    runtimeReachable: boolean;
    cloudDisabled: boolean;
    models: ServerAiModel[];
    running: number;
    waiting: number;
    perUserHour: number;
    timeoutSeconds: number;
    maxQuestionChars: number;
  };
}
export interface ServerCitation {
  key: string;
  kind: string;
  itemId: string;
  revision: number;
  authorName: string;
  title: string;
}
export interface ServerAiAnswer {
  server: string;
  answer: {
    answer: string;
    verified: boolean;
    citations: ServerCitation[];
    model: string;
    digest: string;
    sourcesConsidered: number;
    excludedSources: number;
    runtimeUsed: boolean;
    elapsedMs: number;
  };
}
/** The campaign server's optional AI: contacted only by these explicit actions. */
export const serverAi = {
  status: (campaignId: string) =>
    command<ServerAiView>("server_ai_status", { campaignId }),
  ask: (campaignId: string, question: string, locale: string | null) =>
    command<ServerAiAnswer>("ask_server_ai", { campaignId, question, locale }),
  setExecution: (
    campaignId: string,
    execution: "local" | "server",
    serverModel: string,
  ) =>
    command<Profile>("set_campaign_ai_execution", {
      campaignId,
      execution,
      serverModel,
    }),
};
