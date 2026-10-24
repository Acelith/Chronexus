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
}
export interface Overview {
  profile: Profile;
  sources: Source[];
  added: number;
  changed: number;
  removed: number;
}
export const campaignAi = {
  get: (campaignId: string) =>
    command<Overview>("get_campaign_ai", { campaignId }),
  save: (campaignId: string, profile: Profile) =>
    command<Profile>("save_campaign_ai", { campaignId, profile }),
  refresh: (campaignId: string) =>
    command<Overview>("refresh_campaign_ai", { campaignId }),
};
