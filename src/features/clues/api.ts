import { command } from "../journal/api";

export type ClueKind = "question" | "lead" | "suspicion" | "rumour";
export type Certainty = "confirmed" | "suspected" | "disproven" | "unknown";
export type ClueStatus = "open" | "resolved" | "disproven";
export interface ClueSource {
  kind: "session" | "page";
  id: string;
  blockId: string | null;
}
export interface ClueInput {
  kind: ClueKind;
  title: string;
  details: string;
  certainty: Certainty;
  status: ClueStatus;
  sources: ClueSource[];
  pageIds: string[];
  resolutionSessionId: string | null;
}
export interface Clue extends ClueInput {
  id: string;
  campaignId: string;
  revision: number;
  updatedAt: string;
}
export const clueApi = {
  list: (campaignId: string) => command<Clue[]>("list_clues", { campaignId }),
  save: (campaignId: string, input: ClueInput, clue?: Clue) =>
    command<Clue>("save_clue", {
      campaignId,
      id: clue?.id ?? null,
      revision: clue?.revision ?? null,
      input,
    }),
  delete: (campaignId: string, clue: Clue) =>
    command<void>("delete_clue", {
      campaignId,
      id: clue.id,
      revision: clue.revision,
    }),
};
