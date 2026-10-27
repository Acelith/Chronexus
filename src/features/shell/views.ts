import type { PlayerView } from "../player/api";

/** Workspace shown in the main area of the app shell. */
export type View =
  | "overview"
  | "journal"
  | "codex"
  | "graph"
  | "clues"
  | "wiki"
  | "party"
  | "assistant"
  | "settings"
  | "sharing"
  | "dice"
  | "preferences"
  | PlayerView;
