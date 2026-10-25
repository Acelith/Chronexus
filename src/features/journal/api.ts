import { tr, translateError } from "../../i18n/store";
import { invoke, isTauri } from "@tauri-apps/api/core";

export interface Campaign {
  id: string;
  name: string;
}
export interface JournalDocument {
  importedFrom?: "logseq";
  version: 1;
  blocks: unknown[];
}
export interface Session {
  id: string;
  campaignId: string;
  sequence: number;
  title: string;
  playedOn: string | null;
  document: JournalDocument;
  revision: number;
  updatedAt: string;
}

export async function command<T>(
  name: string,
  payload?: Record<string, unknown>,
): Promise<T> {
  if (!isTauri())
    throw new Error(
      tr("Start Chronexus as a desktop app to access your local archive."),
    );
  try {
    return await invoke<T>(name, payload);
  } catch (error) {
    throw new Error(
      typeof error === "string"
        ? error
        : tr(
            "Archive not available. Check space and permissions, then try again.",
          ),
      { cause: error },
    );
  }
}

export const api = {
  campaigns: () => command<Campaign[]>("list_campaigns"),
  createCampaign: (name: string) =>
    command<Campaign>("create_campaign", { name }),
  renameCampaign: (id: string, name: string) =>
    command<Campaign>("rename_campaign", { id, name }),
  sessions: (campaignId: string) =>
    command<Session[]>("list_sessions", { campaignId }),
  createSession: (
    campaignId: string,
    sequence: number,
    title: string,
    playedOn: string | null,
  ) =>
    command<Session>("create_session", {
      campaignId,
      sequence,
      title,
      playedOn,
    }),
  save: (session: Session, revision: number, document: JournalDocument) =>
    command<Session>("save_document", {
      campaignId: session.campaignId,
      id: session.id,
      revision,
      document,
    }),
};

export function errorMessage(error: unknown): string {
  return error instanceof Error
    ? translateError(error.message)
    : tr("Operation failed. Try again.");
}
