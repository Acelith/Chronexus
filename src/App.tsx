import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  api,
  errorMessage,
  type Campaign,
  type Session,
} from "./features/journal/api";
import type { SaveGuard } from "./features/journal/Editor";
import { it } from "./strings";
import {
  knowledgeApi,
  type KnowledgePage,
  type PageMetadata,
  type Backlink,
} from "./features/knowledge/api";
import { KnowledgeContext } from "./features/knowledge/context";
import type { GraphNode, SourceRef } from "./features/graph/api";
import type { PlayerView } from "./features/player/api";

const Editor = lazy(() => import("./features/journal/Editor"));
const CodexWorkspace = lazy(
  () => import("./features/knowledge/CodexWorkspace"),
);
const GraphWorkspace = lazy(() => import("./features/graph/GraphWorkspace"));
const BackupWorkspace = lazy(() => import("./features/backup/BackupWorkspace"));
const PlayerWorkspace = lazy(() => import("./features/player/PlayerWorkspace"));

export function App() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pages, setPages] = useState<KnowledgePage[]>([]);
  const [pageId, setPageId] = useState<string | null>(null);
  const [fallback, setFallback] = useState("");
  const [view, setView] = useState<"journal" | "codex" | "graph" | PlayerView>(
    "journal",
  );
  const [playerReturn, setPlayerReturn] = useState<{
    view: PlayerView;
    assetId: string;
  } | null>(null);
  const [focusBlock, setFocusBlock] = useState<string | undefined>();
  const [form, setForm] = useState<"campaign" | "rename" | "session" | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [error, setError] = useState("");
  const guard = useRef<SaveGuard | null>(null);
  const operation = useRef(false);
  const loadVersion = useRef(0);
  const campaign = campaigns.find((item) => item.id === campaignId);
  const session = sessions.find((item) => item.id === sessionId);
  const register = useCallback((value: SaveGuard | null) => {
    guard.current = value;
  }, []);
  const onSaved = useCallback(
    (saved: Session) =>
      setSessions((items) =>
        items.map((item) => (item.id === saved.id ? saved : item)),
      ),
    [],
  );
  const onPageSaved = useCallback(
    (saved: KnowledgePage) =>
      setPages((items) => {
        const exists = items.some((item) => item.id === saved.id);
        return exists
          ? items.map((item) => (item.id === saved.id ? saved : item))
          : [...items, saved];
      }),
    [],
  );

  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    try {
      const items = await api.campaigns();
      const first = items[0];
      const [notes, knowledge] = first
        ? await Promise.all([
            api.sessions(first.id),
            knowledgeApi.pages(first.id),
          ])
        : [[], []];
      if (version !== loadVersion.current) return;
      setCampaigns(items);
      setCampaignId(first?.id ?? null);
      setSessions(notes);
      setSessionId(notes[0]?.id ?? null);
      setPages(knowledge);
      setPageId(null);
      setPlayerReturn(null);
    } catch (reason) {
      if (version === loadVersion.current) setError(errorMessage(reason));
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, []);
  // Initial synchronization with Rust; all state updates follow asynchronous I/O.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const run = useCallback(
    async <T,>(action: () => Promise<T>): Promise<T | undefined> => {
      if (operation.current) return;
      operation.current = true;
      setBusy(true);
      setError("");
      try {
        await guard.current?.flush();
        return await action();
      } catch (reason) {
        setError(errorMessage(reason));
      } finally {
        operation.current = false;
        setBusy(false);
      }
    },
    [],
  );

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (guard.current?.dirty()) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    let disposed = false;
    let unlisten: (() => void) | undefined;
    if (isTauri()) {
      void getCurrentWindow()
        .onCloseRequested((event) => {
          event.preventDefault();
          void run(async () => {
            await getCurrentWindow().destroy();
          });
        })
        .then((stop) => {
          if (disposed) stop();
          else unlisten = stop;
        })
        .catch((reason) => setError(errorMessage(reason)));
    }
    return () => {
      disposed = true;
      unlisten?.();
      window.removeEventListener("beforeunload", warn);
    };
  }, [run]);

  function selectCampaign(id: string) {
    if (id === campaignId && !backupOpen) return;
    void run(async () => {
      const [items, knowledge] = await Promise.all([
        api.sessions(id),
        knowledgeApi.pages(id),
      ]);
      setCampaignId(id);
      setPlayerReturn(null);
      setBackupOpen(false);
      setSessions(items);
      setSessionId(items[0]?.id ?? null);
      setPages(knowledge);
      setPageId(null);
      setView("journal");
      setFocusBlock(undefined);
      setForm(null);
    });
  }

  async function saveCampaign(name: string) {
    await run(async () => {
      if (form === "rename" && campaign) {
        const saved = await api.renameCampaign(campaign.id, name);
        setCampaigns((items) =>
          items.map((item) => (item.id === saved.id ? saved : item)),
        );
      } else {
        const saved = await api.createCampaign(name);
        setCampaigns((items) => [...items, saved]);
        setCampaignId(saved.id);
        setPlayerReturn(null);
        setSessions([]);
        setSessionId(null);
        setPages([]);
        setPageId(null);
        setView("journal");
      }
      setForm(null);
    });
  }

  async function saveSession(
    sequence: number,
    title: string,
    date: string | null,
  ) {
    if (!campaign) return;
    await run(async () => {
      const saved = await api.createSession(campaign.id, sequence, title, date);
      setSessions((items) =>
        [...items, saved].sort((a, b) => a.sequence - b.sequence),
      );
      setSessionId(saved.id);
      setView("journal");
      setFocusBlock(undefined);
      setForm(null);
    });
  }

  function openPage(id: string, label: string) {
    if (!campaignId) return;
    void run(async () => {
      const knowledge = await knowledgeApi.pages(campaignId);
      setPages(knowledge);
      setPageId(id);
      setFallback(label);
      setView("codex");
      setForm(null);
      setFocusBlock(undefined);
    });
  }
  function openSource(link: Backlink) {
    void run(async () => {
      if (link.sourceKind === "session") {
        setSessionId(link.sourceId);
        setView("journal");
      } else {
        setPageId(link.sourceId);
        setFallback(link.sourceTitle);
        setView("codex");
      }
      setFocusBlock(link.blockId);
      setForm(null);
    });
  }
  function openGraphSource(source: SourceRef) {
    openSource({
      sourceKind: source.kind,
      sourceId: source.id,
      sourceTitle: source.title,
      sequence: null,
      blockId: source.blockId ?? "",
      preview: "",
    });
  }
  function openGraphNode(node: GraphNode) {
    if (node.kind === "session")
      openGraphSource({
        kind: "session",
        id: node.entityId,
        title: node.title,
        blockId: null,
      });
    else openPage(node.entityId, node.title);
  }
  const createLinkedPage = useCallback(
    async (title: string) => {
      if (!campaignId) throw Error("Seleziona una campagna.");
      const saved = await knowledgeApi.create(campaignId, {
        title,
        kind: "note",
        status: "stub",
        aliases: [],
      });
      onPageSaved(saved);
      return saved;
    },
    [campaignId, onPageSaved],
  );
  async function createPage(metadata: PageMetadata) {
    if (!campaignId) return;
    return run(async () => {
      const saved = await knowledgeApi.create(campaignId, metadata);
      onPageSaved(saved);
      setPageId(saved.id);
      return saved;
    });
  }
  async function updatePage(id: string, metadata: PageMetadata) {
    if (!campaignId) return;
    return run(async () => {
      const saved = await knowledgeApi.update(campaignId, id, metadata);
      onPageSaved(saved);
      return saved;
    });
  }
  async function recoverPage(id: string, title: string) {
    if (!campaignId) return;
    return run(async () => {
      const saved = await knowledgeApi.recover(campaignId, id, title);
      onPageSaved(saved);
      return saved;
    });
  }
  return (
    <KnowledgeContext.Provider
      value={{ pages, open: openPage, create: createLinkedPage }}
    >
      <div className="shell" aria-busy={busy || loading}>
        <aside>
          <div className="brand">
            <h1>{it.appName}</h1>
            <p>{it.tagline}</p>
          </div>
          <nav aria-label={it.campaigns}>
            <h2>{it.campaigns}</h2>
            {campaigns.map((item) => (
              <button
                className="campaign-link"
                key={item.id}
                aria-current={item.id === campaignId ? "page" : undefined}
                disabled={busy}
                onClick={() => selectCampaign(item.id)}
              >
                {item.name}
              </button>
            ))}
            <button
              className="quiet"
              disabled={busy || loading}
              onClick={() => {
                void run(async () => {
                  setBackupOpen(false);
                  setForm("campaign");
                });
              }}
            >
              + {it.newCampaign}
            </button>
          </nav>
          <button
            disabled={busy || loading}
            aria-current={backupOpen ? "page" : undefined}
            onClick={() => {
              void run(async () => {
                setForm(null);
                setBackupOpen(true);
              });
            }}
          >
            Backup e ripristino
          </button>
          <div className="local-mark">
            <span aria-hidden="true">◇</span>
            <footer>{it.local}</footer>
          </div>
        </aside>
        <main>
          {error ? (
            <div className="error" role="alert">
              <p>{error}</p>
              {campaigns.length ? (
                <button type="button" onClick={() => setError("")}>
                  Chiudi messaggio
                </button>
              ) : null}
              {!campaigns.length ? (
                <button
                  disabled={loading}
                  onClick={() => {
                    setLoading(true);
                    setError("");
                    void load();
                  }}
                >
                  {it.retry}
                </button>
              ) : null}
            </div>
          ) : null}
          {backupOpen ? (
            <Suspense fallback={<p role="status">Apertura backup…</p>}>
              <BackupWorkspace
                register={register}
                onRestored={async () => {
                  setError("");
                  await load();
                }}
              />
            </Suspense>
          ) : loading ? (
            <p role="status">{it.loading}</p>
          ) : (
            <>
              <header className="campaign-header">
                <div>
                  <p>
                    {view === "character"
                      ? "Scheda del giocatore"
                      : view === "inventory"
                        ? "Equipaggiamento e provenienza"
                        : view === "abilities"
                          ? "Incantesimi e capacità"
                          : it.journal}
                  </p>
                  <h2>{campaign?.name ?? it.emptyCampaigns}</h2>
                </div>
                {campaign ? (
                  <div className="actions">
                    <button
                      disabled={busy}
                      onClick={() => {
                        void run(async () => setForm("rename"));
                      }}
                    >
                      {it.rename}
                    </button>
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() => {
                        void run(async () => setForm("session"));
                      }}
                    >
                      + {it.newSession}
                    </button>
                  </div>
                ) : null}
              </header>
              {campaign ? (
                <nav className="view-tabs" aria-label="Viste della campagna">
                  <button
                    aria-current={view === "journal" ? "page" : undefined}
                    disabled={busy}
                    onClick={() => {
                      void run(async () => {
                        setView("journal");
                        setForm(null);
                        setFocusBlock(undefined);
                      });
                    }}
                  >
                    Diario
                  </button>
                  <button
                    aria-current={view === "codex" ? "page" : undefined}
                    disabled={busy}
                    onClick={() => {
                      void run(async () => {
                        setView("codex");
                        setForm(null);
                        if (!pageId) setPageId(pages[0]?.id ?? null);
                        setFocusBlock(undefined);
                      });
                    }}
                  >
                    Codex
                  </button>
                  <button
                    aria-current={view === "graph" ? "page" : undefined}
                    disabled={busy}
                    onClick={() => {
                      void run(async () => {
                        setView("graph");
                        setForm(null);
                        setFocusBlock(undefined);
                      });
                    }}
                  >
                    Grafo
                  </button>
                  {(
                    [
                      ["character", "Personaggio"],
                      ["inventory", "Inventario"],
                      ["abilities", "Capacità"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      aria-current={view === id ? "page" : undefined}
                      disabled={busy}
                      onClick={() => {
                        void run(async () => {
                          setView(id);
                          setForm(null);
                          setFocusBlock(undefined);
                        });
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </nav>
              ) : null}
              {playerReturn && (view === "journal" || view === "codex") ? (
                <button
                  className="player-return"
                  disabled={busy}
                  onClick={() => {
                    void run(async () => {
                      setView(playerReturn.view);
                      setForm(null);
                      setFocusBlock(undefined);
                    });
                  }}
                >
                  Torna alla voce del personaggio
                </button>
              ) : null}
              {form === "campaign" || form === "rename" ? (
                <CampaignForm
                  key={`${form}-${campaignId}`}
                  initialName={form === "rename" ? (campaign?.name ?? "") : ""}
                  rename={form === "rename"}
                  busy={busy}
                  onSave={saveCampaign}
                  onCancel={() => setForm(null)}
                />
              ) : null}
              {form === "session" ? (
                <SessionForm
                  initialSequence={Math.min(
                    999999,
                    Math.max(0, ...sessions.map((item) => item.sequence)) + 1,
                  )}
                  busy={busy}
                  onSave={saveSession}
                  onCancel={() => setForm(null)}
                />
              ) : null}
              {!campaign && !error ? (
                <section className="empty">
                  <span className="book-mark" aria-hidden="true">
                    ◇
                  </span>
                  <p>{it.emptyCampaignHint}</p>
                  {form !== "campaign" ? (
                    <button
                      className="primary"
                      onClick={() => setForm("campaign")}
                    >
                      {it.createCampaign}
                    </button>
                  ) : null}
                </section>
              ) : null}
              {campaign && view === "codex" ? (
                <Suspense fallback={<p role="status">Apertura Codex…</p>}>
                  <CodexWorkspace
                    key={campaign.id}
                    campaignId={campaign.id}
                    pages={pages}
                    selectedId={pageId}
                    fallback={fallback}
                    busy={busy}
                    focusBlock={focusBlock}
                    register={register}
                    onSaved={onPageSaved}
                    onSelect={openPage}
                    onSource={openSource}
                    onCreate={createPage}
                    onUpdate={updatePage}
                    onRecover={recoverPage}
                  />
                </Suspense>
              ) : null}
              {campaign && view === "graph" ? (
                <Suspense fallback={<p role="status">Apertura grafo…</p>}>
                  <GraphWorkspace
                    key={campaign.id}
                    campaignId={campaign.id}
                    pages={pages}
                    sessions={sessions}
                    busy={busy}
                    register={register}
                    onNode={openGraphNode}
                    onSource={openGraphSource}
                  />
                </Suspense>
              ) : null}
              {campaign &&
              (view === "character" ||
                view === "inventory" ||
                view === "abilities") ? (
                <Suspense fallback={<p role="status">Apertura personaggio…</p>}>
                  <PlayerWorkspace
                    key={`${campaign.id}-${view}`}
                    campaignId={campaign.id}
                    view={view}
                    pages={pages}
                    sessions={sessions}
                    busy={busy}
                    register={register}
                    initialSelection={
                      playerReturn?.view === view
                        ? playerReturn.assetId
                        : undefined
                    }
                    onPage={(id, title, assetId, view) => {
                      setPlayerReturn({ view, assetId });
                      openPage(id, title);
                    }}
                    onSource={(source, assetId, view) => {
                      setPlayerReturn({ view, assetId });
                      openGraphSource(source);
                    }}
                  />
                </Suspense>
              ) : null}
              {campaign &&
              view === "journal" &&
              !sessions.length &&
              form !== "session" ? (
                <section className="empty">
                  <h3>{it.emptySessions}</h3>
                  <p>{it.emptySessionsHint}</p>
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() => setForm("session")}
                  >
                    {it.newSession}
                  </button>
                </section>
              ) : null}
              {view === "journal" && sessions.length ? (
                <div className="journal-layout">
                  <nav className="session-list" aria-label={it.journal}>
                    {sessions.map((item) => (
                      <button
                        key={item.id}
                        disabled={busy}
                        aria-current={
                          item.id === sessionId ? "page" : undefined
                        }
                        onClick={() => {
                          if (item.id !== sessionId)
                            void run(async () => {
                              setSessionId(item.id);
                              setFocusBlock(undefined);
                              setForm(null);
                            });
                        }}
                      >
                        <span className="session-number">
                          Sessione {item.sequence}
                        </span>
                        <strong>{item.title}</strong>
                        <span>{formatDate(item.playedOn)}</span>
                      </button>
                    ))}
                  </nav>
                  <article className="journal-page">
                    {session ? (
                      <>
                        <header className="note-header">
                          <p>
                            Sessione {session.sequence}{" "}
                            <span aria-hidden="true">/</span>{" "}
                            {formatDate(session.playedOn)}
                          </p>
                          <h3>{session.title}</h3>
                        </header>
                        <Suspense
                          fallback={<p role="status">{it.editorLoading}</p>}
                        >
                          <Editor
                            key={session.id}
                            session={session}
                            register={register}
                            onSaved={onSaved}
                            focusBlock={focusBlock}
                            disabled={busy}
                          />
                        </Suspense>
                      </>
                    ) : (
                      <p>{it.chooseSession}</p>
                    )}
                  </article>
                </div>
              ) : null}
            </>
          )}
        </main>
      </div>
    </KnowledgeContext.Provider>
  );
}

function formatDate(date: string | null) {
  if (!date) return it.dateMissing;
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

function CampaignForm({
  initialName,
  rename,
  busy,
  onSave,
  onCancel,
}: {
  initialName: string;
  rename: boolean;
  busy: boolean;
  onSave: (name: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);
  return (
    <form
      className="entry-form"
      aria-label={rename ? it.rename : it.newCampaign}
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        void onSave(name);
      }}
    >
      <label>
        {it.campaignName}
        <input
          autoFocus
          required
          maxLength={200}
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={busy}
        />
      </label>
      <div className="actions">
        <button className="primary" disabled={busy || !name.trim()}>
          {rename ? it.saveName : it.createCampaign}
        </button>
        <button type="button" disabled={busy} onClick={onCancel}>
          {it.cancel}
        </button>
      </div>
    </form>
  );
}

function SessionForm({
  initialSequence,
  busy,
  onSave,
  onCancel,
}: {
  initialSequence: number;
  busy: boolean;
  onSave: (
    sequence: number,
    title: string,
    date: string | null,
  ) => Promise<void>;
  onCancel: () => void;
}) {
  const [sequence, setSequence] = useState(initialSequence);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  return (
    <form
      className="entry-form"
      aria-label={it.newSession}
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        void onSave(sequence, title, date || null);
      }}
    >
      <div className="form-fields">
        <label className="number-field">
          {it.sessionNumber}
          <input
            type="number"
            required
            min={1}
            max={999999}
            step={1}
            value={sequence}
            onChange={(event) => setSequence(event.target.valueAsNumber)}
            disabled={busy}
          />
        </label>
        <label>
          {it.sessionTitle}
          <input
            autoFocus
            required
            maxLength={200}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={busy}
          />
        </label>
        <label>
          {it.sessionDate}
          <input
            type="date"
            min="0001-01-01"
            max="9999-12-31"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            disabled={busy}
          />
        </label>
      </div>
      <div className="actions">
        <button className="primary" disabled={busy || !title.trim()}>
          {it.createSession}
        </button>
        <button type="button" disabled={busy} onClick={onCancel}>
          {it.cancel}
        </button>
      </div>
    </form>
  );
}
