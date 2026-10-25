import { Channel } from "@tauri-apps/api/core";
import { command } from "../journal/api";

export interface ModelState {
  role: "primary" | "secondary";
  name: string;
  label: string;
  downloadBytes: number;
  state: "absent" | "ready" | "unqualified" | "unknown";
}
export interface SetupStatus {
  supportedPlatform: boolean;
  managedInstalled: boolean;
  managedRunning: boolean;
  runtimeDir: string;
  modelsDir: string;
  runtime: "stopped" | "ready" | "cloud" | "unknown";
  runtimeVersion: string | null;
  models: ModelState[];
  gpus: { name: string; memoryMib: number }[];
  freeBytes: number | null;
  runtimeDownloadBytes: number;
  runtimeInstallBytes: number;
}
export interface SetupProgress {
  phase: string;
  done: number;
  total: number | null;
  detail: string | null;
}
function channel(progress: (p: SetupProgress) => void) {
  const events = new Channel<SetupProgress>();
  events.onmessage = progress;
  return events;
}
/** M22: every call follows an explicit click; nothing here runs at launch. */
export const aiSetupApi = {
  status: () => command<SetupStatus>("ai_setup_status"),
  installRuntime: (progress: (p: SetupProgress) => void) =>
    command<void>("ai_install_runtime", {
      accept: true,
      events: channel(progress),
    }),
  start: () => command<string>("ai_start_runtime"),
  stop: () => command<void>("ai_stop_runtime"),
  pull: (role: ModelState["role"], progress: (p: SetupProgress) => void) =>
    command<ModelState>("ai_pull_model", {
      role,
      accept: true,
      events: channel(progress),
    }),
  cancel: () => command<void>("ai_cancel_setup"),
  removeRuntime: () => command<void>("ai_remove_runtime", { accept: true }),
};
export const OLLAMA_SOURCE =
  "https://github.com/ollama/ollama/releases/download/v0.40.10/ollama-windows-amd64.zip";
