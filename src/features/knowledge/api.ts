import { localizeLabels } from "../../i18n/store";
import { command, type JournalDocument } from "../journal/api";

export const pageKinds = localizeLabels({
  npc: "Character",
  place: "Place",
  faction: "Faction",
  quest: "Quest",
  item: "Item",
  event: "Event",
  lore: "Knowledge",
  note: "Note",
} as const);
export type PageKind = keyof typeof pageKinds;
export interface PageMetadata {
  title: string;
  kind: PageKind;
  status: "stub" | "active";
  aliases: string[];
}
export interface KnowledgePage extends PageMetadata {
  id: string;
  campaignId: string;
  document: JournalDocument;
  revision: number;
  updatedAt: string;
}
export interface Backlink {
  sourceKind: "session" | "page";
  sourceId: string;
  sourceTitle: string;
  sequence: number | null;
  blockId: string;
  preview: string;
}
export const knowledgeApi = {
  pages: (campaignId: string) =>
    command<KnowledgePage[]>("list_pages", { campaignId }),
  create: (campaignId: string, metadata: PageMetadata) =>
    command<KnowledgePage>("create_page", { campaignId, ...metadata }),
  update: (
    campaignId: string,
    id: string,
    input: PageMetadata,
    expected: PageMetadata,
  ) =>
    command<KnowledgePage>("update_page", { campaignId, id, input, expected }),
  save: (page: KnowledgePage, revision: number, document: JournalDocument) =>
    command<KnowledgePage>("save_page_document", {
      campaignId: page.campaignId,
      id: page.id,
      revision,
      document,
    }),
  backlinks: (campaignId: string, id: string) =>
    command<Backlink[]>("get_backlinks", { campaignId, id }),
  recover: (campaignId: string, id: string, title: string) =>
    command<KnowledgePage>("recover_page", { campaignId, id, title }),
};
