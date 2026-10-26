import { useCallback, useContext, useEffect, useState } from "react";
import { tr } from "../../i18n/store";
import { OperationContext } from "../../operations";
import { usePendingAction } from "../../usePendingAction";
import {
  sharedText,
  syncApi,
  useSyncStatus,
  type RemoteItem,
  type SharedKind,
  type SyncConflict,
  type SyncInvite,
  type SyncItem,
  type SyncLink,
  type SyncScope,
} from "./api";
import { stateText } from "./SyncStatusBadge";

const kindLabels = (): Record<SharedKind, string> => ({
  page: tr("Codex pages"),
  session: tr("Sessions"),
  relationship: tr("Relationships"),
  party: tr("Party members"),
});
const statusLabels = (): Record<SyncItem["status"], string> => ({
  private: tr("only on this device"),
  new: tr("to send"),
  pending: tr("changed, to send"),
  synced: tr("synchronized"),
  conflict: tr("conflict"),
  blocked: tr("waiting: the pages it refers to must go first"),
  revoking: tr("removal from the server at next synchronization"),
});
const scopeLabels = (): Record<SyncScope, string> => ({
  none: tr("Only on this device"),
  private: tr("Private copy on the server (your devices only)"),
  shared: tr("Shared with the other players"),
});
function itemTitle(kind: SharedKind, payload: Record<string, unknown> | null) {
  if (!payload) return "";
  const text = (key: string) =>
    typeof payload[key] === "string" ? (payload[key] as string) : "";
  if (kind === "session")
    return tr("Session {0}: {1}", [String(payload.sequence), text("title")]);
  if (kind === "relationship") return text("label");
  if (kind === "party") return text("name");
  return text("title");
}

async function read(campaignId: string) {
  const link = await syncApi.link(campaignId);
  if (!link) return { link, items: [], conflicts: [], remote: [] };
  const [items, conflicts, remote] = await Promise.all([
    syncApi.items(campaignId),
    syncApi.conflicts(campaignId),
    syncApi.remote(campaignId),
  ]);
  return { link, items, conflicts, remote };
}

/** What this campaign replicates or shares, what others shared, and open conflicts. */
export default function CampaignSharing({
  campaignId,
  busy,
}: {
  campaignId: string;
  busy: boolean;
}) {
  const run = useContext(OperationContext);
  const [link, setLink] = useState<SyncLink | null | undefined>(undefined);
  const [items, setItems] = useState<SyncItem[]>([]);
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [remote, setRemote] = useState<RemoteItem[]>([]);
  const [code, setCode] = useState("");
  const [invite, setInvite] = useState<SyncInvite | null>(null);
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);
  const [confirmErase, setConfirmErase] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteName, setDeleteName] = useState("");
  const { pending, error, notice, setError, perform } = usePendingAction();
  const status = useSyncStatus(link ? campaignId : null);
  const disabled = busy || pending;
  const reload = useCallback(async () => {
    const state = await read(campaignId);
    setLink(state.link);
    setItems(state.items);
    setConflicts(state.conflicts);
    setRemote(state.remote);
  }, [campaignId]);
  // A finished background pass may have received items or opened a conflict: read again.
  const settled = status?.state;
  const syncedAt = status?.lastSyncedAt;
  useEffect(() => {
    if (settled === "syncing") return;
    let active = true;
    read(campaignId)
      .then((state) => {
        if (!active) return;
        setLink(state.link);
        setItems(state.items);
        setConflicts(state.conflicts);
        setRemote(state.remote);
      })
      .catch((reason: Error) => {
        if (active) setError(reason.message);
      });
    return () => {
      active = false;
    };
  }, [campaignId, setError, settled, syncedAt]);
  const act = (action: () => Promise<string | void>) =>
    perform(action, { blocked: busy, through: run });
  const kinds = kindLabels();
  const statuses = statusLabels();
  const scopes = scopeLabels();
  return (
    <section className="campaign-sharing" aria-label={tr("Sharing")}>
      <h3>{tr("Sharing")}</h3>
      <p>
        {tr(
          "Nothing leaves this device unless you choose it. For each item you decide: only on this device, a private copy on the server for your own devices, or shared with the other players. What other players share stays attributed to them and never becomes a fact of your campaign.",
        )}
      </p>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      <p role="status">{pending ? tr("Synchronizing…") : notice}</p>
      {link === undefined && !error ? (
        <p role="status">{tr("Reading settings…")}</p>
      ) : null}
      {link === null ? (
        <div className="sync-connect">
          <p>
            {tr(
              "This campaign is not linked. Choose the server and sign in from App settings, then create the shared campaign or join one with an invitation code. To download a campaign you already keep on the server, use App settings.",
            )}
          </p>
          <button
            className="primary"
            disabled={disabled}
            onClick={() =>
              void act(async () => {
                await syncApi.connect(campaignId, null);
                await reload();
                return tr("Shared campaign created. Nothing is shared yet.");
              })
            }
          >
            {tr("Create the shared campaign on the server")}
          </button>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void act(async () => {
                await syncApi.connect(campaignId, code);
                setCode("");
                await reload();
                return tr("Joined the shared campaign.");
              });
            }}
          >
            <label>
              {tr("Invitation code")}
              <input
                required
                autoComplete="off"
                value={code}
                disabled={disabled}
                onChange={(e) => setCode(e.target.value)}
              />
            </label>
            <button disabled={disabled || !code.trim()}>
              {tr("Join with invitation")}
            </button>
          </form>
        </div>
      ) : null}
      {link ? (
        <>
          <p>
            {tr("Linked to {0} as {1}. Last synchronization: {2}.", [
              link.server,
              link.role,
              link.syncedAt ?? tr("never"),
            ])}
          </p>
          <section aria-label={tr("Automatic synchronization")}>
            <h4>{tr("Automatic synchronization")}</h4>
            <label className="sync-item">
              <input
                type="checkbox"
                checked={link.auto}
                disabled={disabled}
                onChange={(event) => {
                  // Read before awaiting: a controlled input reverts until the state updates.
                  const enabled = event.target.checked;
                  void act(async () => {
                    setLink(await syncApi.setAuto(campaignId, enabled, false));
                    return enabled
                      ? tr(
                          "Automatic synchronization is on. Chronexus will contact the server for this campaign, also after you restart it, until you turn it off.",
                        )
                      : tr(
                          "Automatic synchronization is off. Nothing is sent until you press Synchronize now.",
                        );
                  });
                }}
              />{" "}
              {tr("Keep this campaign synchronized automatically")}
            </label>
            <p className="muted">
              {tr(
                "Changes are saved on this device first and sent a moment later. Editing never waits for the server. The status always says whether a change is only on this device or also on the server.",
              )}
            </p>
            {link.auto ? (
              <button
                disabled={disabled}
                onClick={() =>
                  void act(async () => {
                    setLink(
                      await syncApi.setAuto(campaignId, true, !link.paused),
                    );
                  })
                }
              >
                {link.paused
                  ? tr("Resume automatic synchronization")
                  : tr("Pause automatic synchronization")}
              </button>
            ) : null}
            {status ? (
              <p className="sync-state" data-state={status.state}>
                {stateText(status)}
                {status.state === "attention" || status.state === "offline"
                  ? null
                  : status.blocked
                    ? ` · ${tr("{0} items wait for the pages they refer to", [status.blocked])}`
                    : null}
              </p>
            ) : null}
          </section>
          <div className="actions">
            <button
              className="primary"
              disabled={disabled}
              onClick={() =>
                void act(async () => {
                  const r = await syncApi.now(campaignId);
                  await reload();
                  return tr(
                    "Synchronized: {0} sent, {1} removed from the server, {2} received, {3} updated here, {4} created here from your other device, {5} withdrawn by others, {6} conflicts, {7} waiting.",
                    [
                      r.pushed,
                      r.deleted,
                      r.received,
                      r.updated,
                      r.materialized,
                      r.removed,
                      r.conflicts,
                      r.blocked,
                    ],
                  );
                })
              }
            >
              {tr("Synchronize now")}
            </button>
            {link.role !== "reader" ? (
              <button
                disabled={disabled}
                onClick={() => setConfirmAll(true)}
                title={tr(
                  "Copies everything to your account on the server, visible only to you",
                )}
              >
                {tr("Keep a private copy of everything")}
              </button>
            ) : null}
            {link.role === "owner" ? (
              <>
                {(["player", "reader"] as const).map((role) => (
                  <button
                    key={role}
                    disabled={disabled}
                    onClick={() =>
                      void act(async () => {
                        setInvite(await syncApi.invite(campaignId, role));
                      })
                    }
                  >
                    {role === "player"
                      ? tr("Invite a player")
                      : tr("Invite a reader")}
                  </button>
                ))}
              </>
            ) : null}
            {link.role !== "reader" ? (
              <button
                disabled={disabled}
                onClick={() => setConfirmErase(true)}
                title={tr(
                  "Deletes what you synchronized to the server; this device keeps everything",
                )}
              >
                {tr("Delete my copy on the server")}
              </button>
            ) : null}
            {link.role === "owner" ? (
              <button
                disabled={disabled}
                onClick={() => setConfirmDelete(true)}
              >
                {tr("Delete the campaign on the server")}
              </button>
            ) : null}
            <button disabled={disabled} onClick={() => setConfirmUnlink(true)}>
              {tr("Unlink this campaign")}
            </button>
          </div>
          {link.accessLost ? (
            <p className="error" role="alert">
              {tr(
                "You no longer have access to this campaign on the server (you were removed, or it was deleted). Copies received from other players were cleared from this device; your own items stay here. If you are invited again, switch automatic synchronization back on.",
              )}
            </p>
          ) : null}
          {invite ? (
            <p className="sync-invite" role="status">
              {tr(
                "Invitation code for a {0}: {1} (valid until {2}). Share it privately; it works once.",
                [invite.role, invite.code, invite.expiresAt],
              )}
            </p>
          ) : null}
          {confirmErase ? (
            <div
              role="alertdialog"
              aria-label={tr("Delete my copy on the server")}
            >
              <p>
                {tr(
                  "This deletes everything you synchronized to this campaign from the server: your private copies and the items you shared. The other players lose the items you shared. Everything stays on this device and nothing is sent again until you choose items. Copies other players already received cannot be taken back.",
                )}
              </p>
              <button
                className="primary"
                disabled={disabled}
                onClick={() =>
                  void act(async () => {
                    setLink(await syncApi.eraseServerCopy(campaignId));
                    setConfirmErase(false);
                    await reload();
                    return tr(
                      "Your copy on the server was deleted. Your items are still on this device.",
                    );
                  })
                }
              >
                {tr("Delete my copy on the server")}
              </button>
              <button
                disabled={disabled}
                onClick={() => setConfirmErase(false)}
              >
                {tr("Cancel")}
              </button>
            </div>
          ) : null}
          {confirmDelete ? (
            <div
              role="alertdialog"
              aria-label={tr("Delete the campaign on the server")}
            >
              <p>
                {tr(
                  "This deletes the shared campaign on the server for everyone: all private and shared copies, uploads and invitations. Each player keeps what is on their own computer. It cannot be undone. Type the exact campaign name to confirm.",
                )}
              </p>
              <label>
                {tr("Campaign name")}
                <input
                  autoComplete="off"
                  value={deleteName}
                  disabled={disabled}
                  onChange={(event) => setDeleteName(event.target.value)}
                />
              </label>
              <button
                className="primary"
                disabled={disabled || !deleteName}
                onClick={() =>
                  void act(async () => {
                    await syncApi.deleteServerCampaign(campaignId, deleteName);
                    setConfirmDelete(false);
                    setDeleteName("");
                    setItems([]);
                    setConflicts([]);
                    setRemote([]);
                    await reload();
                    return tr(
                      "The campaign was deleted on the server and unlinked here. Everything on this device is untouched.",
                    );
                  })
                }
              >
                {tr("Delete on the server")}
              </button>
              <button
                disabled={disabled}
                onClick={() => {
                  setConfirmDelete(false);
                  setDeleteName("");
                }}
              >
                {tr("Cancel")}
              </button>
            </div>
          ) : null}
          {confirmAll ? (
            <div
              role="alertdialog"
              aria-label={tr("Keep a private copy of everything")}
            >
              <p>
                {tr(
                  "Every page, session, relationship and party member of this campaign will be copied to your account on the server so your other computers can download them. They stay private: the other players see nothing unless you share an item. Character sheets, images, AI data and preferences are not included.",
                )}
              </p>
              <button
                className="primary"
                disabled={disabled}
                onClick={() =>
                  void act(async () => {
                    setItems(await syncApi.replicateAll(campaignId));
                    setConfirmAll(false);
                    return tr(
                      "Chosen. The copies are sent at the next synchronization.",
                    );
                  })
                }
              >
                {tr("Copy everything privately")}
              </button>
              <button disabled={disabled} onClick={() => setConfirmAll(false)}>
                {tr("Cancel")}
              </button>
            </div>
          ) : null}
          {confirmUnlink ? (
            <div role="alertdialog" aria-label={tr("Unlink this campaign")}>
              <p>
                {tr(
                  "Unlinking forgets the sharing choices and the copies received from others on this device. Your campaign data stays; nothing is deleted from the server.",
                )}
              </p>
              <button
                disabled={disabled}
                onClick={() =>
                  void act(async () => {
                    await syncApi.unlink(campaignId);
                    setConfirmUnlink(false);
                    setItems([]);
                    setConflicts([]);
                    setRemote([]);
                    await reload();
                    return tr("Campaign unlinked.");
                  })
                }
              >
                {tr("Unlink")}
              </button>
              <button
                disabled={disabled}
                onClick={() => setConfirmUnlink(false)}
              >
                {tr("Cancel")}
              </button>
            </div>
          ) : null}
          {conflicts.length ? (
            <section aria-label={tr("Conflicts")}>
              <h4>{tr("Conflicts")}</h4>
              <p>
                {tr(
                  "These items changed both here and on the server. Nothing was overwritten: choose which version to keep.",
                )}
              </p>
              {conflicts.map((conflict) => (
                <article
                  key={`${conflict.kind}:${conflict.itemId}`}
                  className="sync-conflict"
                >
                  <h5>{conflict.title}</h5>
                  <div className="sync-versions">
                    <div>
                      <strong>{tr("This device")}</strong>
                      <p dir="auto">{sharedText(conflict.local)}</p>
                    </div>
                    <div>
                      <strong>
                        {tr("Server (revision {0})", [conflict.remoteRevision])}
                      </strong>
                      <p dir="auto">
                        {conflict.remote
                          ? sharedText(conflict.remote)
                          : tr("Removed from the server.")}
                      </p>
                    </div>
                  </div>
                  {(["local", "remote"] as const).map((keep) => (
                    <button
                      key={keep}
                      disabled={disabled}
                      onClick={() =>
                        void act(async () => {
                          setConflicts(
                            await syncApi.resolve(
                              campaignId,
                              conflict.kind,
                              conflict.itemId,
                              keep,
                            ),
                          );
                          setItems(await syncApi.items(campaignId));
                          return tr("Choice saved.");
                        })
                      }
                    >
                      {keep === "local"
                        ? tr("Keep this device's version")
                        : tr("Keep the server's version")}
                    </button>
                  ))}
                </article>
              ))}
            </section>
          ) : null}
          <section aria-label={tr("What leaves this device")}>
            <h4>{tr("What leaves this device")}</h4>
            <p role="status" className="sync-preview">
              {tr(
                "Summary: {0} only on this device · {1} private copies on the server · {2} shared with the other players.",
                [
                  items.filter((item) => item.scope === "none").length,
                  items.filter((item) => item.scope === "private").length,
                  items.filter((item) => item.scope === "shared").length,
                ],
              )}
            </p>
            {link.role === "reader" ? (
              <p className="muted">
                {tr("Readers consult the shared campaign without sharing.")}
              </p>
            ) : null}
            {(Object.keys(kinds) as SharedKind[]).map((kind) => {
              const rows = items.filter((item) => item.kind === kind);
              return rows.length ? (
                <fieldset
                  key={kind}
                  disabled={disabled || link.role === "reader"}
                >
                  <legend>{kinds[kind]}</legend>
                  {rows.map((item) => (
                    <div key={item.itemId} className="sync-item">
                      <label>
                        <span dir="auto">{item.title}</span>{" "}
                        <select
                          value={item.scope}
                          onChange={(event) =>
                            void act(async () => {
                              setItems(
                                await syncApi.setScope(
                                  campaignId,
                                  kind,
                                  item.itemId,
                                  event.target.value as SyncScope,
                                ),
                              );
                            })
                          }
                        >
                          {(Object.keys(scopes) as SyncScope[]).map((scope) => (
                            <option key={scope} value={scope}>
                              {scopes[scope]}
                            </option>
                          ))}
                        </select>
                      </label>{" "}
                      <span className="muted">· {statuses[item.status]}</span>
                    </div>
                  ))}
                </fieldset>
              ) : null;
            })}
          </section>
          <section aria-label={tr("Shared with you")}>
            <h4>{tr("Shared with you")}</h4>
            {remote.length ? null : (
              <p className="muted">{tr("Nothing received yet.")}</p>
            )}
            <ul className="sync-remote">
              {remote.map((item) => (
                <li key={`${item.kind}:${item.itemId}`}>
                  <strong dir="auto">
                    {itemTitle(item.kind, item.payload)}
                  </strong>{" "}
                  <span className="muted">
                    {item.mine
                      ? tr(
                          "· {0} · from your other device, waiting for what it refers to · revision {1}",
                          [kinds[item.kind], item.revision],
                        )
                      : tr("· {0} · shared by {1} · revision {2}", [
                          kinds[item.kind],
                          item.authorName,
                          item.revision,
                        ])}
                  </span>
                  <p dir="auto">{sharedText(item.payload).slice(0, 600)}</p>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </section>
  );
}
