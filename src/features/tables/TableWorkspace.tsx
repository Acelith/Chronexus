import { useEffect, useRef, useState, useCallback } from "react";
import {
  createTableRuntime,
  type BoardWidget,
} from "../../../vendor/table-runtime/index.js";
import { usePreferences, tr, number } from "../../i18n/store";
import { syncApi } from "../sync/api";
import JournalGrants from "./JournalGrants";
import { uuid7 } from "./operation-id";
import { tablesApi, type Table } from "./api";
import type { BoardOperation, LiveEvent } from "./server-types";

/** Server-rolled dice and GM-only lines; the desktop only displays them. */
function ChatLine({ event }: { event: LiveEvent }) {
  const whisper = event.audience === "gm",
    roll = event.roll;
  return (
    <li className={whisper ? "chat-whisper" : roll ? "chat-roll" : undefined}>
      <b>{event.authorName}</b>
      {roll ? (
        <>
          {" "}
          {tr("rolled {0}", [roll.expression])}
          {roll.label && ` · ${roll.label}`}
          <span className="roll-dice">
            {roll.terms.map((term, i) => (
              <span key={i}>
                {(i > 0 || term.sign < 0) && (
                  <span aria-hidden="true">
                    {term.sign < 0 ? " − " : " + "}
                  </span>
                )}
                {term.sides
                  ? term.results.map((value, n) => (
                      <span
                        key={n}
                        className={term.kept[n] ? "die" : "die die-dropped"}
                        title={
                          term.kept[n]
                            ? `d${term.sides}`
                            : `d${term.sides} · ${tr("discarded")}`
                        }
                      >
                        {number(value)}
                      </span>
                    ))
                  : number(term.value)}
              </span>
            ))}
          </span>
          <strong className="roll-total">
            {tr("Total {0}", [roll.total])}
          </strong>
        </>
      ) : (
        <>
          : {whisper ? event.text.replace(/^\s*\/w\s+gm\s+/i, "") : event.text}
        </>
      )}
      {whisper && <i className="chat-tag"> · {tr("to the GM only")}</i>}
    </li>
  );
}
import CharacterProjection from "./CharacterProjection";

function element(
  tag: string,
  attrs: Record<string, unknown> = {},
  ...children: unknown[]
): HTMLElement {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "text") node.textContent = String(value);
    else if (key.startsWith("on") && typeof value === "function")
      node.addEventListener(key.slice(2), value as EventListener);
    else node.setAttribute(key, value === true ? "" : String(value));
  }
  for (const child of children.flat())
    if (child !== undefined && child !== null && child !== false)
      node.append(
        child instanceof Node ? child : document.createTextNode(String(child)),
      );
  return node;
}
function dataBlob(data: string): Blob {
  const match =
    /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(data);
  if (!match) throw Error("Invalid image");
  return new Blob([Uint8Array.from(atob(match[2]), (v) => v.charCodeAt(0))], {
    type: match[1],
  });
}
interface Confirmation {
  title: string;
  lines: string[];
  accept: string;
  resolve: (ok: boolean) => void;
}
function ConfirmationDialog({
  value,
  done,
}: {
  value: Confirmation;
  done: (ok: boolean) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby="table-confirm-title"
      className="restore-confirmation"
      onCancel={(e) => {
        e.preventDefault();
        done(false);
      }}
    >
      <h3 id="table-confirm-title">{value.title}</h3>
      <p style={{ whiteSpace: "pre-line" }}>{value.lines.join("\n")}</p>
      <button type="button" onClick={() => done(false)}>
        {tr("Cancel")}
      </button>
      <button type="button" onClick={() => done(true)}>
        {value.accept}
      </button>
    </dialog>
  );
}
export default function TableWorkspace({
  campaignId,
  table,
  onClose,
}: {
  campaignId: string;
  table: Table;
  onClose: () => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    widget = useRef<BoardWidget | null>(null),
    subscription = useRef<string | null>(null);
  const [error, setError] = useState(""),
    [online, setOnline] = useState(false),
    [people, setPeople] = useState(0),
    [events, setEvents] = useState<LiveEvent[]>([]);
  const [message, setMessage] = useState(""),
    [pending, setPending] = useState<{
      id: string;
      text: string;
      revision: number;
    } | null>(null),
    [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const confirmationRef = useRef<Confirmation | null>(null),
    messagePending = useRef(pending);
  useEffect(() => {
    messagePending.current = pending;
  }, [pending]);
  const prefs = usePreferences();
  const ask = useCallback(
    (title: string, lines: string[], accept: string) =>
      new Promise<boolean>((resolve) => {
        const value = { title, lines, accept, resolve };
        confirmationRef.current = value;
        setConfirmation(value);
      }),
    [],
  );
  const done = (ok: boolean) => {
    confirmationRef.current?.resolve(ok);
    confirmationRef.current = null;
    setConfirmation(null);
  };
  useEffect(() => {
    let active = true,
      instance: BoardWidget | null = null;
    const container = host.current;
    const runtime = createTableRuntime(prefs.locale);
    const fail = () => {
      if (active)
        setError(
          tr("Table unavailable. Your journal remains available offline."),
        );
    };
    async function start() {
      const [account, seats] = await Promise.all([
        syncApi.account(),
        tablesApi.seats(table.id),
      ]);
      if (!active) return;
      const prefix = `/api/v1/tables/${table.id}`;
      const adapter = async (
        method: string,
        path: string,
        body?: BoardOperation,
        binary = false,
      ) => {
        if (!active)
          throw new Error(
            tr("Table access ended. Sign in again or check your invitation."),
          );
        if (method === "GET" && path === prefix + "/board")
          return tablesApi.board(table.id);
        if (method === "POST" && path === prefix + "/board/operations" && body)
          return tablesApi.operate(table.id, body);
        if (method === "GET" && binary && path.startsWith(prefix + "/maps/"))
          return dataBlob(
            await tablesApi.image(
              table.id,
              path.slice((prefix + "/maps/").length),
              !!instance?.snapshot?.scenes.some(
                (s) => s.mapId === path.slice((prefix + "/maps/").length),
              ),
            ),
          );
        throw new Error(
          tr("Table access ended. Sign in again or check your invitation."),
        );
      };
      instance = runtime.board.create({
        el: element,
        t: runtime.i18n.t,
        api: adapter,
        tableId: table.id,
        role: table.role === "gm" ? "spectator" : table.role,
        account: account.accountId,
        seats,
        confirm: ask,
        active: () => active,
        ping: (p: { sceneId: string; x: number; y: number }) => {
          const id = subscription.current;
          if (id) void tablesApi.ping(id, p.sceneId, p.x, p.y).catch(() => {});
        },
      });
      widget.current = instance;
      container?.replaceChildren(instance.root);
      const id = await tablesApi.start(table.id, (frame) => {
        if (!active) return;
        if (frame.type === "accessLost") {
          instance?.dispose();
          instance = null;
          container?.replaceChildren();
          widget.current = null;
          setEvents([]);

          setPeople(0);
          setOnline(false);
          setError(
            tr("Table access ended. Sign in again or check your invitation."),
          );
          return;
        }
        if (
          frame.type === "ping" &&
          typeof frame.sceneId === "string" &&
          typeof frame.x === "number" &&
          typeof frame.y === "number"
        ) {
          instance?.showPing({
            sceneId: frame.sceneId,
            x: frame.x,
            y: frame.y,
            authorId: frame.authorId,
            authorName: frame.authorName,
          });
          return;
        }
        if (frame.type === "disconnected") {
          instance?.connected(false);
          setOnline(false);
          return;
        }
        if (frame.type === "state" && frame.board) {
          try {
            instance?.update(frame.board);
            instance?.connected(true);
            setOnline(true);
            setError("");
          } catch {
            instance?.connected(false);
            setOnline(false);
            fail();
          }
          const p = messagePending.current;
          if (p && frame.events?.some((e) => e.operationId === p.id)) {
            messagePending.current = null;
            setPending(null);
            setMessage((current) => (current === p.text ? "" : current));
          }
          setEvents((current) => {
            const map = new Map(
              (frame.reset ? [] : current).map((e) => [e.operationId, e]),
            );
            for (const e of frame.events ?? []) map.set(e.operationId, e);
            return [...map.values()]
              .sort((a, b) => a.revision - b.revision)
              .slice(-100);
          });
        }
        if (frame.type === "error") {
          messagePending.current = null;
          setPending(null);
          setError(
            tr("The table changed. Review the current state before retrying."),
          );
        }
        if (typeof frame.online === "number") setPeople(frame.online);
      });
      if (!active) {
        await tablesApi.stop(id);
        return;
      }
      subscription.current = id;
    }
    void start().catch(fail);
    return () => {
      active = false;
      instance?.dispose();
      widget.current = null;
      container?.replaceChildren();
      confirmationRef.current?.resolve(false);
      const id = subscription.current;
      subscription.current = null;
      if (id) void tablesApi.stop(id).catch(() => {});
    };
  }, [table.id, table.role, prefs.locale, ask]);
  async function sendMessage() {
    const current = widget.current?.snapshot;
    if (!subscription.current || !current || !online) return;
    const op = pending ?? {
      id: uuid7(),
      text: message,
      revision: current.revision,
    };
    messagePending.current = op;
    setPending(op);
    try {
      await tablesApi.message(
        subscription.current,
        op.id,
        op.revision,
        op.text,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "");
    }
  }
  async function close() {
    if (
      (message || pending) &&
      !(await ask(
        tr("Close table?"),
        [tr("Unsent table messages will be discarded.")],
        tr("Close"),
      ))
    )
      return;
    onClose();
  }
  async function leave() {
    if (
      !(await ask(
        tr("Leave table?"),
        [tr("Unsent table messages will be discarded.")],
        tr("Leave table"),
      ))
    )
      return;
    try {
      await tablesApi.leave(table.id);
      await tablesApi.link(campaignId, table.id, false);
      onClose();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : tr("Table unavailable. Your journal remains available offline."),
      );
    }
  }
  return (
    <section className="chronexus-table">
      <header className="table-heading">
        <h2>{table.name}</h2>
        <button type="button" onClick={() => void close()}>
          {tr("Close")}
        </button>
        {table.role !== "gm" && (
          <button type="button" disabled={!online} onClick={() => void leave()}>
            {tr("Leave table")}
          </button>
        )}
      </header>
      <p role="status">
        {online
          ? tr("Live table")
          : tr("Table disconnected — editing is paused.")}{" "}
        · {people}
      </p>
      {table.role === "gm" && (
        <p>
          {tr(
            "GM preparation tools are available in the server web interface.",
          )}
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div ref={host} />
      {table.role === "player" && (
        <CharacterProjection
          campaignId={campaignId}
          tableId={table.id}
          online={online}
          getWidget={() => widget.current}
          ask={ask}
        />
      )}
      <details>
        <summary>{tr("Table messages")}</summary>
        <ol>
          {events.map((event) => (
            <ChatLine key={event.operationId} event={event} />
          ))}
        </ol>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendMessage();
          }}
        >
          <label>
            {tr("Message")}
            <textarea
              maxLength={2000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </label>
          <button type="submit" disabled={!online || !message.trim()}>
            {pending ? tr("Retry") : tr("Send")}
          </button>
        </form>
        <p className="muted">
          {tr(
            "Roll with /r 1d20+5, advantage with /r 2d20kh1, secretly with /gr 1d6; whisper to the GM with /w gm. The server rolls the dice.",
          )}
        </p>
      </details>
      <JournalGrants
        key={online ? "connected" : "disconnected"}
        campaignId={campaignId}
        tableId={table.id}
        online={online}
        canGrant={table.role === "player"}
        ask={ask}
        setError={setError}
      />
      {confirmation && <ConfirmationDialog value={confirmation} done={done} />}
    </section>
  );
}
