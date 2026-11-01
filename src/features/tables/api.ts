import { command } from "../journal/api";
import { Channel, invoke, isTauri } from "@tauri-apps/api/core";
import { tr } from "../../i18n/store";
import type {
  BoardView,
  BoardOperation,
  TableSeat,
  LiveEvent,
} from "./server-types";
export interface Table {
  id: string;
  name: string;
  role: "gm" | "player" | "spectator";
  revision: number;
}
export const tablesApi = {
  list: () => command<Table[]>("table_list"),
  join: (code: string) => command<Table>("table_join", { code }),
  board: (tableId: string) => call<BoardView>("table_board", { tableId }),
  seats: (tableId: string) => call<TableSeat[]>("table_seats", { tableId }),
  operate: (tableId: string, operation: BoardOperation) =>
    call<{ revision: number }>("table_operation", { tableId, operation }),
  image: (tableId: string, assetId: string, map: boolean) =>
    call<string>("table_image", { tableId, assetId, map }),
  leave: (tableId: string) => call<void>("table_leave", { tableId }),
  links: (campaignId: string) =>
    command<TableLink[]>("table_links", { campaignId }),
  link: (campaignId: string, tableId: string, enabled: boolean) =>
    call<void>("table_link", { campaignId, tableId, enabled }),
  grant: (
    campaignId: string,
    tableId: string,
    kind: string,
    itemId: string,
    enabled: boolean,
  ) =>
    call<void>("table_grant", { campaignId, tableId, kind, itemId, enabled }),
  stop: (subscription: string) =>
    command<void>("table_live_stop", { subscription }),
  message: (
    subscription: string,
    operationId: string,
    baseRevision: number,
    text: string,
  ) =>
    call<void>("table_live_message", {
      subscription,
      operationId,
      baseRevision,
      text,
    }),
  start: (tableId: string, receive: (frame: LiveFrame) => void) => {
    const onEvent = new Channel<LiveFrame>();
    onEvent.onmessage = receive;
    return command<string>("table_live_start", { tableId, onEvent });
  },
  character: (campaignId: string) =>
    command<ProjectionPreview>("table_character_preview", { campaignId }),
  project: (
    campaignId: string,
    tableId: string,
    tokenId: string,
    baseRevision: number,
    choice: ProjectionChoice,
  ) =>
    call<{ revision: number }>("table_project_character", {
      campaignId,
      tableId,
      tokenId,
      baseRevision,
      choice,
    }),
};
export interface ProjectionPreview {
  id: string;
  revision: number;
  name: string;
  hp: number;
  maxHp: number;
  portraits: { id: string; caption: string }[];
}
export interface ProjectionChoice {
  characterId: string;
  characterRevision: number;
  name: boolean;
  vitals: boolean;
  ac: number | null;
  speed: { value: number; unit: string } | null;
  portrait: string | null;
}
export interface TableLink {
  server: string;
  accountId: string;
  tableId: string;
}
export interface LiveFrame {
  type: string;
  board?: BoardView;
  events?: LiveEvent[];
  online?: number;
  reset?: boolean;
  revision?: number;
  operationId?: string;
}
async function call<T>(
  name: string,
  args: Record<string, unknown>,
): Promise<T> {
  if (!isTauri())
    throw new Error(
      tr("Start Chronexus as a desktop app to access your local archive."),
    );
  try {
    return await invoke<T>(name, args);
  } catch (reason) {
    const status =
      typeof reason === "object" && reason !== null && "status" in reason
        ? Number(reason.status)
        : 503;
    throw Object.assign(
      new Error(
        status === 409
          ? tr("The table changed. Review the current state before retrying.")
          : status === 401 || status === 403 || status === 404
            ? tr("Table access ended. Sign in again or check your invitation.")
            : tr("Table unavailable. Your journal remains available offline."),
      ),
      { status },
    );
  }
}
