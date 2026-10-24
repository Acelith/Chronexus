import { Channel } from "@tauri-apps/api/core";
import { command } from "../journal/api";
import type { Stamp, Profile } from "./campaignApi";
export interface TrainingJob {
  id: string;
  campaignId: string;
  status: string;
  createdAt: string;
  model: string;
  digest: string;
  baseDigest: string;
  weightDigest: string;
  manifest: Stamp[];
  policyHash: string;
  adapter: string;
  adapterHash: string;
  config: string;
  configHash: string;
  metrics: Record<string, unknown>;
  error: string;
}
export interface TrainingOverview {
  jobs: TrainingJob[];
  datasetHash: string;
  sources: number;
  blocked: number;
  added: number;
  changed: number;
  removed: number;
  backendInstalled: boolean;
}
export interface TrainingProgress {
  phase: string;
  message?: string;
  step?: number;
  steps?: number;
  loss?: number;
}
export const trainingApi = {
  get: (campaignId: string) =>
    command<TrainingOverview>("get_training_overview", { campaignId }),
  start: (
    campaignId: string,
    id: string,
    datasetHash: string,
    onProgress: (event: TrainingProgress) => void,
  ) => {
    const events = new Channel<TrainingProgress>();
    events.onmessage = onProgress;
    return command<TrainingJob>("start_campaign_training", {
      campaignId,
      id,
      datasetHash,
      events,
    });
  },
  activate: (campaignId: string, id: string) =>
    command<Profile>("activate_campaign_training", { campaignId, id }),
};
