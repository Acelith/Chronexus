import { useCallback, useContext, useEffect, useState } from "react";
import { tr } from "../../i18n/store";
import { OperationContext } from "../../operations";
import { usePendingAction } from "../../usePendingAction";
import {
  sharedText,
  syncApi,
  type RemoteItem,
  type SharedKind,
  type SyncConflict,
  type SyncInvite,
  type SyncItem,
  type SyncLink,
} from "./api";

const kindLabels = (): Record<SharedKind, string> => ({
  page: tr("Codex pages"),
  session: tr("Sessions"),
  relationship: tr("Relationships"),
  party: tr("Party members"),
});
const statusLabels = (): Record<SyncItem["status"], string> => ({
  private: tr("private"),
  new: tr("to send"),
  pending: tr("changed, to send"),
  synced: tr("synchronized"),
  conflict: tr("conflict"),
  blocked: tr("waiting: share both pages"),
  revoking: tr("removal at next synchronization"),
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

/** M24: what this campaign shares, what others shared, and open conflicts. */
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
  const { pending, error, notice, setError, perform } = usePendingAction();
  const disabled = busy || pending;
  const reload = useCallback(async () => {
    const state = await read(campaignId);
    setLink(state.link);
    setItems(state.items);
    setConflicts(state.conflicts);
    setRemote(state.remote);
  }, [campaignId]);
  useEffect(() => {
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
  }, [campaignId, setError]);
  const act = (action: () => Promise<string | void>) =>
    perform(action, { blocked: busy, through: run });
  const kinds = kindLabels();
  const statuses = statusLabels();
  return (
    <section className="campaign-sharing" aria-label={tr("Sharing")}>
      <h3>{tr("Sharing")}</h3>
      <p>
        {tr(
          "Everything is private by default. Shared items are sent only when you press Synchronize now. What other players share stays attributed to them and never becomes a fact of your campaign.",
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
              "This campaign is not linked. Choose the server and sign in from App settings, then create the shared campaign or join one with an invitation code.",
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
          <div className="actions">
            <button
              className="primary"
              disabled={disabled}
              onClick={() =>
                void act(async () => {
                  const r = await syncApi.now(campaignId);
                  await reload();
                  return tr(
                    "Synchronized: {0} sent, {1} removed from the server, {2} received, {3} updated here, {4} withdrawn by others, {5} conflicts, {6} waiting.",
                    [
                      r.pushed,
                      r.deleted,
                      r.received,
                      r.updated,
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
            <button disabled={disabled} onClick={() => setConfirmUnlink(true)}>
              {tr("Unlink this campaign")}
            </button>
          </div>
          {invite ? (
            <p className="sync-invite" role="status">
              {tr(
                "Invitation code for a {0}: {1} (valid until {2}). Share it privately; it works once.",
                [invite.role, invite.code, invite.expiresAt],
              )}
            </p>
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
          <section aria-label={tr("What you share")}>
            <h4>{tr("What you share")}</h4>
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
                    <label key={item.itemId} className="sync-item">
                      <input
                        type="checkbox"
                        checked={item.shared}
                        onChange={(event) =>
                          void act(async () => {
                            setItems(
                              await syncApi.setShare(
                                campaignId,
                                kind,
                                item.itemId,
                                event.target.checked,
                              ),
                            );
                          })
                        }
                      />
                      <span dir="auto">{item.title}</span>{" "}
                      <span className="muted">· {statuses[item.status]}</span>
                    </label>
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
                      ? tr("· {0} · from your other device · revision {1}", [
                          kinds[item.kind],
                          item.revision,
                        ])
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
