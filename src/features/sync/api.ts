import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { command } from "../journal/api";

/** M24 sharing client; the session token never reaches the interface. */
export interface SyncAccount {
  server: string | null;
  signedIn: boolean;
  accountId: string | null;
  username: string | null;
  displayName: string | null;
  device: string | null;
}
export interface SyncLink {
  campaignId: string;
  server: string;
  remoteId: string;
  accountId: string;
  role: "owner" | "player" | "reader";
  cursor: string;
  syncedAt: string | null;
  /** Continuous synchronization was switched on for this campaign. */
  auto: boolean;
  paused: boolean;
  lastError: string | null;
  /** The server says this account has no access to the campaign any more. */
  accessLost: boolean;
}
export type SharedKind =
  "page" | "session" | "relationship" | "party" | "sheetSection" | "image";
/** Shared read-only; never replicated privately and never created on another computer. */
export const projectionKinds: SharedKind[] = ["sheetSection", "image"];
/** none: only on this device · private: this account's devices · shared: the members. */
export type SyncScope = "none" | "private" | "shared";
export interface SyncItem {
  kind: SharedKind;
  itemId: string;
  title: string;
  shared: boolean;
  scope: SyncScope;
  status:
    | "private"
    | "new"
    | "pending"
    | "synced"
    | "conflict"
    | "blocked"
    | "revoking";
}
export interface SyncReport {
  received: number;
  removed: number;
  updated: number;
  materialized: number;
  pushed: number;
  deleted: number;
  conflicts: number;
  blocked: number;
  resynchronized: boolean;
}
export type SyncState =
  | "off"
  | "paused"
  | "syncing"
  | "saved"
  | "pending"
  | "offline"
  | "conflict"
  | "attention";
/** Visible save state of one campaign; counts never include item text. */
export interface SyncStatus {
  campaignId: string;
  state: SyncState;
  pending: number;
  conflicts: number;
  blocked: number;
  lastSyncedAt: string | null;
  message: string | null;
  retryInSeconds: number | null;
}
export interface RemoteCampaign {
  id: string;
  name: string;
  role: "owner" | "player" | "reader";
}
export interface SyncConflict {
  kind: SharedKind;
  itemId: string;
  title: string;
  remoteRevision: number;
  local: Record<string, unknown> | null;
  remote: Record<string, unknown> | null;
}
export interface RemoteItem {
  kind: SharedKind;
  itemId: string;
  authorId: string;
  authorName: string;
  revision: number;
  payload: Record<string, unknown>;
  updatedAt: string;
  mine: boolean;
}
/** One active member of a shared campaign; `revision` guards role changes and removals. */
export interface SyncMember {
  accountId: string;
  displayName: string;
  role: "owner" | "player" | "reader";
  revision: number;
  joinedAt: string;
}
export interface SyncInvite {
  code: string;
  role: string;
  expiresAt: string;
}

export const syncApi = {
  account: () => command<SyncAccount>("sync_account"),
  setServer: (server: string) =>
    command<SyncAccount>("sync_set_server", { server }),
  signIn: (username: string, password: string, device: string) =>
    command<SyncAccount>("sync_sign_in", { username, password, device }),
  redeem: (
    code: string,
    username: string,
    displayName: string,
    password: string,
    device: string,
  ) =>
    command<SyncAccount>("sync_redeem_invite", {
      code,
      username,
      displayName,
      password,
      device,
    }),
  signOut: () => command<SyncAccount>("sync_sign_out"),
  link: (campaignId: string) =>
    command<SyncLink | null>("sync_link", { campaignId }),
  connect: (campaignId: string, inviteCode: string | null) =>
    command<SyncLink>("sync_connect_campaign", { campaignId, inviteCode }),
  unlink: (campaignId: string) => command<void>("sync_unlink", { campaignId }),
  invite: (campaignId: string, role: "player" | "reader") =>
    command<SyncInvite>("sync_invite", { campaignId, role }),
  members: (campaignId: string) =>
    command<SyncMember[]>("sync_members", { campaignId }),
  changeMember: (
    campaignId: string,
    accountId: string,
    role: "player" | "reader",
    revision: number,
  ) =>
    command<SyncMember[]>("sync_change_member", {
      campaignId,
      accountId,
      role,
      revision,
    }),
  removeMember: (campaignId: string, accountId: string, revision: number) =>
    command<SyncMember[]>("sync_remove_member", {
      campaignId,
      accountId,
      revision,
    }),
  /** A player or reader leaves; what others shared is cleared here, own items stay. */
  leave: (campaignId: string) =>
    command<SyncLink>("sync_leave_campaign", { campaignId }),
  items: (campaignId: string) =>
    command<SyncItem[]>("sync_items", { campaignId }),
  setScope: (
    campaignId: string,
    kind: SharedKind,
    itemId: string,
    scope: SyncScope,
  ) =>
    command<SyncItem[]>("sync_set_scope", {
      campaignId,
      kind,
      itemId,
      scope,
    }),
  replicateAll: (campaignId: string) =>
    command<SyncItem[]>("sync_replicate_all", { campaignId }),
  setAuto: (campaignId: string, enabled: boolean, paused: boolean) =>
    command<SyncLink>("sync_set_auto", { campaignId, enabled, paused }),
  status: (campaignId: string) =>
    command<SyncStatus>("sync_status", { campaignId }),
  remoteCampaigns: () => command<RemoteCampaign[]>("sync_remote_campaigns"),
  /** Deletes the server copy of everything this account synchronized; local items stay. */
  /** The original of an image another player shared, fetched on request for display only. */
  remoteImage: (campaignId: string, itemId: string) =>
    command<string>("sync_remote_image", { campaignId, itemId }),
  eraseServerCopy: (campaignId: string) =>
    command<SyncLink>("sync_erase_server_copy", { campaignId }),
  /** Owner only: deletes the campaign on the server; local items stay. */
  deleteServerCampaign: (campaignId: string, confirmName: string) =>
    command<void>("sync_delete_server_campaign", { campaignId, confirmName }),
  deleteAccount: (password: string, deleteOwnedCampaigns: boolean) =>
    command<SyncAccount>("sync_delete_account", {
      password,
      deleteOwnedCampaigns,
    }),
  attach: (remoteId: string) =>
    command<{ id: string; name: string }>("sync_attach_campaign", {
      remoteId,
    }),
  now: (campaignId: string) => command<SyncReport>("sync_now", { campaignId }),
  conflicts: (campaignId: string) =>
    command<SyncConflict[]>("sync_conflicts", { campaignId }),
  resolve: (
    campaignId: string,
    kind: SharedKind,
    itemId: string,
    keep: "local" | "remote",
  ) =>
    command<SyncConflict[]>("sync_resolve", {
      campaignId,
      kind,
      itemId,
      keep,
    }),
  remote: (campaignId: string) =>
    command<RemoteItem[]>("sync_remote_items", { campaignId }),
};

/** Plain text of a shared item, for read-only display; never rendered as HTML. */
export function sharedText(payload: Record<string, unknown> | null): string {
  if (!payload) return "";
  const parts: string[] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      if (typeof record.text === "string") parts.push(record.text);
      const props = record.props as Record<string, unknown> | undefined;
      if (record.type === "pageMention" && typeof props?.label === "string")
        parts.push(props.label);
      visit(record.content);
      visit(record.children);
    }
  };
  const document = payload.document as Record<string, unknown> | undefined;
  visit(document?.blocks);
  if (typeof payload.caption === "string") parts.push(payload.caption);
  if (Array.isArray(payload.fields)) {
    for (const field of payload.fields as Record<string, unknown>[]) {
      if (typeof field.label === "string" && typeof field.value === "string")
        parts.push(`${field.label}: ${field.value}.`);
    }
  }
  for (const key of ["evidence", "notes", "playerName", "role"]) {
    if (typeof payload[key] === "string" && payload[key])
      parts.push(String(payload[key]));
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/** Subscribes to save-state changes pushed by the backend; a no-op outside the app. */
export function watchSyncStatus(handler: (status: SyncStatus) => void) {
  if (!isTauri()) return () => {};
  const stop = listen<SyncStatus>("chronexus:sync-status", (event) =>
    handler(event.payload),
  );
  return () => {
    void stop.then((unlisten) => unlisten()).catch(() => {});
  };
}

/** The campaign's save state: read once from the archive (no network), then kept live. */
export function useSyncStatus(campaignId: string | null) {
  const [known, setKnown] = useState<{
    campaignId: string;
    status: SyncStatus;
  } | null>(null);
  useEffect(() => {
    if (!campaignId) return;
    let active = true;
    const keep = (status: SyncStatus) => {
      if (active && status.campaignId === campaignId)
        setKnown({ campaignId, status });
    };
    syncApi
      .status(campaignId)
      .then(keep)
      .catch(() => {
        // Not linked (or the archive is busy): there is nothing to show.
      });
    const stop = watchSyncStatus(keep);
    return () => {
      active = false;
      stop();
    };
  }, [campaignId]);
  // A state read for another campaign is never shown.
  return known && known.campaignId === campaignId ? known.status : null;
}
