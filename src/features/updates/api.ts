import { Channel } from "@tauri-apps/api/core";
import { command } from "../journal/api";
export interface UpdateSettings {
  endpoint: string;
}
export interface UpdateOverview {
  settings: UpdateSettings;
  currentVersion: string;
  backupDirectory: string;
}
export interface UpdateOffer {
  id: string;
  version: string;
  notes: string;
}
export interface UpdateProgress {
  phase: string;
  downloaded: number;
  total: number | null;
  backupPath: string | null;
}
export const updatesApi = {
  overview: () => command<UpdateOverview>("get_update_settings"),
  save: (settings: UpdateSettings) =>
    command<UpdateSettings>("save_update_settings", { settings }),
  check: () => command<UpdateOffer | null>("check_app_update"),
  download: (id: string, progress: (value: UpdateProgress) => void) => {
    const events = new Channel<UpdateProgress>();
    events.onmessage = progress;
    return command<void>("download_app_update", { id, events });
  },
  install: (id: string, progress: (value: UpdateProgress) => void) => {
    const events = new Channel<UpdateProgress>();
    events.onmessage = progress;
    return command<string>("install_app_update", { id, events });
  },
  cancel: () => command<void>("cancel_app_update"),
};
