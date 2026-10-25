import { date as formatDateTime } from "./i18n/store";
import { localeInfo } from "./i18n/locales";
import { getPreferences } from "./i18n/store";
import { Text } from "./i18n/Text";
import { usePreferences, tr } from "./i18n/store";
import { Icon } from "./components/Ornaments";
// M21: herald logo chosen by the user (assets/brand/README.md); the name stays in alt.
const brandLogo = new URL(
  "../assets/brand/chronexus-logo.webp",
  import.meta.url,
).href;
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
import { useExternalUpdates } from "./features/journal/useExternalUpdates";
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
import type { AbilityDetails, PlayerView } from "./features/player/api";
import type { SearchResult } from "./features/search/SearchPanel";
import { OperationContext } from "./operations";
import { heraldApi, type UpdateOffer } from "./features/updates/api";
import { usePeriodicBackup } from "./features/backup/usePeriodicBackup";
import { useStartupHerald } from "./features/updates/useStartupHerald";
const SearchPanel = lazy(() => import("./features/search/SearchPanel"));

const Editor = lazy(() => import("./features/journal/Editor"));
const CodexWorkspace = lazy(
  () => import("./features/knowledge/CodexWorkspace"),
);
const GraphWorkspace = lazy(() => import("./features/graph/GraphWorkspace"));
const BackupWorkspace = lazy(() => import("./features/backup/BackupWorkspace"));
const PlayerWorkspace = lazy(() => import("./features/player/PlayerWorkspace"));
const ExportButton = lazy(() => import("./features/export/ExportButton"));
const Dashboard = lazy(() => import("./features/dashboard/Dashboard"));
const WikiWorkspace = lazy(() => import("./features/wiki/WikiWorkspace"));
const PartyWorkspace = lazy(() => import("./features/party/PartyWorkspace"));
const AssistantWorkspace = lazy(
  () => import("./features/assistant/AssistantWorkspace"),
);
const DiceWorkspace = lazy(() => import("./features/dice/DiceWorkspace"));
const UpdateSettings = lazy(() => import("./features/updates/UpdateSettings"));
const WikiSettings = lazy(() => import("./features/wiki/WikiSettings"));
const BackupSettings = lazy(() => import("./features/backup/BackupSettings"));
const AiSetupSettings = lazy(
  () => import("./features/ai-setup/AiSetupSettings"),
);
const HeraldAnnouncement = lazy(
  () => import("./features/updates/HeraldAnnouncement"),
);
const LanguageSettings = lazy(
  () => import("./features/preferences/LanguageSettings"),
);
const CampaignSettings = lazy(
  () => import("./features/assistant/CampaignSettings"),
);
const ImportSource = lazy(() => import("./features/knowledge/ImportSource"));

const modifiedDateFormat = {
  format: (value: Date) =>
    formatDateTime(value, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
};

export function App() {
  usePreferences();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pages, setPages] = useState<KnowledgePage[]>([]);
  const [pageId, setPageId] = useState<string | null>(null);
  const [fallback, setFallback] = useState("");
  const [view, setView] = useState<
    | "overview"
    | "journal"
    | "codex"
    | "graph"
    | "wiki"
    | "party"
    | "assistant"
    | "settings"
    | "dice"
    | "preferences"
    | PlayerView
  >("journal");
  const [playerReturn, setPlayerReturn] = useState<{
    view: PlayerView;
    assetId: string;
  } | null>(null);
  /** Spell prepared in the wiki, waiting to open as an unsaved form. */
  const [wikiDraft, setWikiDraft] = useState<AbilityDetails | null>(null);
  const [focusBlock, setFocusBlock] = useState<string | undefined>();
  const [form, setForm] = useState<"campaign" | "rename" | "session" | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchButton = useRef<HTMLButtonElement>(null);
  const [error, setError] = useState("");
  const guard = useRef<SaveGuard | null>(null);
  const operation = useRef(false);
  const loadVersion = useRef(0);
  const [externalEpoch, setExternalEpoch] = useState(0);
  const canRefreshExternal = useCallback(
    () => !operation.current && !guard.current?.dirty(),
    [],
  );
  const refreshExternal = useCallback(async () => {
    if (!campaignId) return true;
    const version = loadVersion.current;
    try {
      const [notes, knowledge] = await Promise.all([
        api.sessions(campaignId),
        knowledgeApi.pages(campaignId),
      ]);
      if (version !== loadVersion.current) return true;
      if (!canRefreshExternal()) return false;
      setSessions(notes);
      setPages(knowledge);
      setSessionId((previous) => previous ?? notes[0]?.id ?? null);
      setExternalEpoch((previous) => previous + 1);
    } catch (reason) {
      setError(errorMessage(reason));
    }
    return true;
  }, [campaignId, canRefreshExternal]);
  useExternalUpdates(campaignId, canRefreshExternal, refreshExternal);
  /** Update offer chosen from the herald, handed to the M15 settings flow. */
  const [updateHandoff, setUpdateHandoff] = useState<UpdateOffer | null>(null);
  // The herald waits for an idle app: no save, form, restore or dirty draft.
  const heraldCanShow = useCallback(
    () =>
      !loading &&
      !busy &&
      !operation.current &&
      !backupOpen &&
      !searchOpen &&
      !form &&
      !guard.current?.dirty(),
    [loading, busy, backupOpen, searchOpen, form],
  );
  const herald = useStartupHerald(heraldCanShow);
  // M19: same idle rule as the herald; the backend adds AI/update/restore checks.
  const periodic = usePeriodicBackup(heraldCanShow);
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
  function openSearch() {
    if (!campaignId || busy || backupOpen) return;
    if (form) {
      setError(tr("Completa o annulla il modulo aperto prima di cercare."));
      return;
    }
    void run(async () => setSearchOpen(true));
  }
  function selectSearch(result: SearchResult) {
    void run(async () => {
      if (result.kind === "session") {
        setSessionId(result.sourceId);
        setView("journal");
      } else if (result.kind === "page") {
        setPageId(result.sourceId);
        setFallback(result.title);
        setView("codex");
      } else {
        const target =
          result.kind === "character"
            ? "character"
            : result.kind === "item"
              ? "inventory"
              : "abilities";
        setView(target);
        setPlayerReturn({ view: target, assetId: result.sourceId });
      }
      setFocusBlock(result.blockId ?? undefined);
      setForm(null);
      setSearchOpen(false);
    });
  }
  useEffect(() => {
    const keyboard = (event: globalThis.KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        document.querySelector('[role="dialog"],[role="alertdialog"]')
      )
        return;
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      if (event.key.toLowerCase() === "k") {
        event.preventDefault();
        openSearch();
      }
      if (
        event.shiftKey &&
        event.key.toLowerCase() === "n" &&
        campaignId &&
        !form &&
        !backupOpen
      ) {
        event.preventDefault();
        void run(async () => setForm("session"));
      }
    };
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  });
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
      if (!campaignId) throw Error(tr("Seleziona una campagna."));
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
  async function updatePage(
    id: string,
    metadata: PageMetadata,
    expected: PageMetadata,
  ) {
    if (!campaignId) return;
    return run(async () => {
      const saved = await knowledgeApi.update(
        campaignId,
        id,
        metadata,
        expected,
      );
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
    <OperationContext.Provider value={run}>
      {periodic.outcome ? (
        <div
          className={
            periodic.outcome.error
              ? "periodic-backup-notice error"
              : "periodic-backup-notice"
          }
          role={periodic.outcome.error ? "alert" : "status"}
        >
          <p>
            {periodic.outcome.error
              ? tr("Backup periodico non riuscito: {0}", [
                  periodic.outcome.error,
                ])
              : tr("Backup periodico creato e verificato.")}
          </p>
          <button onClick={periodic.dismiss}>{tr("Chiudi")}</button>
        </div>
      ) : null}
      {herald.announcement ? (
        <Suspense fallback={null}>
          <HeraldAnnouncement
            announcement={herald.announcement}
            onLater={() => herald.close("later")}
            onDismiss={() => herald.close("dismiss")}
            onSound={async (sound) => {
              const current = await heraldApi.settings();
              await heraldApi.save({ ...current, sound });
            }}
            onUpdate={() => {
              const offer = herald.announcement!.offer;
              herald.close(null);
              void run(async () => {
                setUpdateHandoff(offer);
                setBackupOpen(false);
                setForm(null);
                setView("preferences");
              });
            }}
          />
        </Suspense>
      ) : null}
      <KnowledgeContext.Provider
        value={{ pages, open: openPage, create: createLinkedPage }}
      >
        <div className="shell" aria-busy={busy || loading}>
          <aside>
            <div className="brand">
              <h1>
                <img className="brand-logo" src={brandLogo} alt={it.appName} />
              </h1>
              <p>
                <Text source={"Le tue storie vivono"} />
              </p>
            </div>
            <nav className="sidebar-menu" aria-label={it.campaigns}>
              <label className="campaign-picker">
                <Text source={"Campagna attuale"} />
                <select
                  aria-label={tr("Campagna attuale")}
                  value={backupOpen ? "" : (campaignId ?? "")}
                  disabled={busy || loading}
                  onChange={(e) => selectCampaign(e.target.value)}
                >
                  {backupOpen ? (
                    <option value="">{tr("Seleziona campagna")}</option>
                  ) : null}
                  {!campaigns.length ? (
                    <option value="">{tr("Nessuna campagna")}</option>
                  ) : null}
                  {campaigns.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                disabled={busy || loading}
                onClick={() => {
                  void run(async () => {
                    setBackupOpen(false);
                    setForm("campaign");
                  });
                }}
              >
                <Icon name="plus" />
                {it.newCampaign}
              </button>
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
                <Icon name="backup" />
                <Text source={"Backup e ripristino"} />
              </button>
              {campaign ? (
                <>
                  <button
                    disabled={busy}
                    aria-current={
                      !backupOpen && view === "settings" ? "page" : undefined
                    }
                    onClick={() => {
                      void run(async () => {
                        setBackupOpen(false);
                        setView("settings");
                        setForm(null);
                      });
                    }}
                  >
                    <Icon name="settings" />
                    <Text source={"Impostazioni della campagna"} />
                  </button>
                  <button
                    disabled={busy}
                    aria-current={
                      !backupOpen && view === "assistant" ? "page" : undefined
                    }
                    onClick={() => {
                      void run(async () => {
                        setBackupOpen(false);
                        setView("assistant");
                        setForm(null);
                      });
                    }}
                  >
                    <Icon name="star" />
                    <Text source={"Assistente locale"} />
                  </button>
                </>
              ) : null}
              {campaign ? (
                <button
                  disabled={busy}
                  aria-current={
                    !backupOpen && view === "dice" ? "page" : undefined
                  }
                  onClick={() => {
                    void run(async () => {
                      setBackupOpen(false);
                      setView("dice");
                      setForm(null);
                    });
                  }}
                >
                  <Icon name="dice" />
                  <Text source={"Tiradadi"} />
                </button>
              ) : null}
              <button
                disabled={busy || loading}
                aria-current={
                  !backupOpen && view === "preferences" ? "page" : undefined
                }
                onClick={() => {
                  void run(async () => {
                    setBackupOpen(false);
                    setForm(null);
                    setView("preferences");
                  });
                }}
              >
                <Icon name="settings" />
                {tr("Impostazioni dell’app")}
              </button>
            </nav>
            <div className="local-mark">
              <img
                src={new URL("../assets/gui/castle.png", import.meta.url).href}
                alt=""
              />
              <p>
                <Text source={"Persone, luoghi, idee."} />
                <br />
                <Text source={"Tutto è connesso."} />
              </p>
              <span aria-hidden="true">— ◈ —</span>
            </div>
          </aside>
          <main>
            {searchOpen && campaignId ? (
              <Suspense
                fallback={
                  <p role="status">
                    <Text source={"Apertura ricerca…"} />
                  </p>
                }
              >
                <SearchPanel
                  campaignId={campaignId}
                  onSelect={selectSearch}
                  onClose={() => {
                    setSearchOpen(false);
                    searchButton.current?.focus();
                  }}
                />
              </Suspense>
            ) : null}
            {error ? (
              <div className="error" role="alert">
                <p>{error}</p>
                {campaigns.length ? (
                  <button type="button" onClick={() => setError("")}>
                    <Text source={"Chiudi messaggio"} />
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
              <Suspense
                fallback={
                  <p role="status">
                    <Text source={"Apertura backup…"} />
                  </p>
                }
              >
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
                    <h2>
                      {view === "preferences"
                        ? tr("Impostazioni dell’app")
                        : (campaign?.name ?? it.emptyCampaigns)}
                    </h2>
                  </div>
                  <span className="last-modified">
                    {[...sessions, ...pages].some((item) =>
                      Number.isFinite(Date.parse(item.updatedAt)),
                    ) ? (
                      <>
                        <Text source={"Ultima modifica:"} />{" "}
                        <time>
                          {modifiedDateFormat.format(
                            new Date(
                              Math.max(
                                ...[...sessions, ...pages]
                                  .map((item) => Date.parse(item.updatedAt))
                                  .filter(Number.isFinite),
                              ),
                            ),
                          )}
                        </time>
                      </>
                    ) : null}
                  </span>
                  {campaign ? (
                    <details className="campaign-actions">
                      <summary aria-label={tr("Azioni della campagna")}>
                        •••
                      </summary>
                      <div className="actions">
                        <button
                          ref={searchButton}
                          disabled={busy}
                          onClick={openSearch}
                          title={tr("Ctrl+K / ⌘K")}
                        >
                          <Text source={"Cerca nella campagna"} />
                        </button>
                        <Suspense fallback={null}>
                          <ExportButton
                            key={campaign.id}
                            campaignId={campaign.id}
                            busy={busy}
                          />
                        </Suspense>
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
                    </details>
                  ) : null}
                </header>
                {campaign ? (
                  <nav
                    className="view-tabs"
                    aria-label={tr("Viste della campagna")}
                  >
                    <button
                      aria-current={view === "overview" ? "page" : undefined}
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          setView("overview");
                          setForm(null);
                        })
                      }
                    >
                      <Icon name="document" />
                      <Text source={"Riepilogo"} />
                    </button>
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
                      <Icon name="book" />
                      <Text source={"Diario"} />
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
                      <Icon name="books" />
                      <Text source={"Codex"} />
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
                      <Icon name="graph" />
                      <Text source={"Grafo"} />
                    </button>
                    <button
                      aria-current={view === "party" ? "page" : undefined}
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          setView("party");
                          setForm(null);
                        })
                      }
                    >
                      <Icon name="party" />
                      <Text source={"Party"} />
                    </button>
                    {(
                      [
                        ["character", tr("Personaggio")],
                        ["inventory", tr("Inventario")],
                        ["abilities", tr("Incantesimi")],
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
                        <Icon
                          name={
                            id === "character"
                              ? "helmet"
                              : id === "inventory"
                                ? "bag"
                                : "star"
                          }
                        />
                        {label}
                      </button>
                    ))}
                    <button
                      aria-current={view === "wiki" ? "page" : undefined}
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          setView("wiki");
                          setForm(null);
                        })
                      }
                    >
                      <Icon name="wiki" />
                      <Text source={"Wiki D&D"} />
                    </button>
                  </nav>
                ) : null}
                <div className={`workspace-content view-${view}`}>
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
                      <Text source={"Torna alla voce del personaggio"} />
                    </button>
                  ) : null}
                  {form === "campaign" || form === "rename" ? (
                    <CampaignForm
                      key={`${form}-${campaignId}`}
                      initialName={
                        form === "rename" ? (campaign?.name ?? "") : ""
                      }
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
                        Math.max(0, ...sessions.map((item) => item.sequence)) +
                          1,
                      )}
                      busy={busy}
                      onSave={saveSession}
                      onCancel={() => setForm(null)}
                    />
                  ) : null}
                  {!campaign && !error && view !== "preferences" ? (
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
                    <Suspense
                      fallback={
                        <p role="status">
                          <Text source={"Apertura Codex…"} />
                        </p>
                      }
                    >
                      <CodexWorkspace
                        key={campaign.id}
                        externalEpoch={externalEpoch}
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
                  {view === "preferences" ? (
                    <Suspense
                      fallback={
                        <p role="status">{tr("Apertura impostazioni…")}</p>
                      }
                    >
                      <>
                        <UpdateSettings
                          busy={busy}
                          run={run}
                          initialOffer={updateHandoff}
                          onHandoffUsed={() => setUpdateHandoff(null)}
                        />
                        <LanguageSettings disabled={busy} />
                        <BackupSettings disabled={busy} />
                        <WikiSettings disabled={busy} />
                        <AiSetupSettings disabled={busy} />
                      </>
                    </Suspense>
                  ) : null}
                  {campaign && view === "dice" ? (
                    <Suspense
                      fallback={
                        <p role="status">
                          <Text source={"Apertura tiradadi…"} />
                        </p>
                      }
                    >
                      <DiceWorkspace
                        key={campaign.id}
                        campaignId={campaign.id}
                        register={register}
                        busy={busy}
                      />
                    </Suspense>
                  ) : null}
                  {campaign && view === "settings" ? (
                    <Suspense
                      fallback={
                        <p role="status">
                          <Text source={"Apertura impostazioni…"} />
                        </p>
                      }
                    >
                      <CampaignSettings
                        key={campaign.id}
                        campaignId={campaign.id}
                        name={campaign.name}
                        register={register}
                      />
                    </Suspense>
                  ) : null}
                  {campaign && view === "assistant" ? (
                    <Suspense
                      fallback={
                        <p role="status">
                          <Text source={"Apertura assistente…"} />
                        </p>
                      }
                    >
                      <AssistantWorkspace
                        key={campaign.id}
                        campaignId={campaign.id}
                        register={register}
                        onSource={selectSearch}
                      />
                    </Suspense>
                  ) : null}
                  {campaign && view === "wiki" ? (
                    <Suspense
                      fallback={
                        <p role="status">
                          <Text source={"Apertura wiki…"} />
                        </p>
                      }
                    >
                      <WikiWorkspace
                        onImportSpell={(spell) =>
                          void run(async () => {
                            setWikiDraft(spell);
                            setPlayerReturn(null);
                            setView("abilities");
                            setForm(null);
                          })
                        }
                      />
                    </Suspense>
                  ) : null}
                  {campaign && view === "party" ? (
                    <Suspense
                      fallback={
                        <p role="status">
                          <Text source={"Apertura party…"} />
                        </p>
                      }
                    >
                      <PartyWorkspace
                        key={`${campaign.id}:${externalEpoch}`}
                        campaignId={campaign.id}
                        pages={pages}
                        register={register}
                        onSaved={onPageSaved}
                        onOpen={(p) => openPage(p.id, p.title)}
                        busy={busy}
                      />
                    </Suspense>
                  ) : null}
                  {campaign && view === "overview" ? (
                    <Suspense
                      fallback={
                        <p role="status">
                          <Text source={"Apertura riepilogo…"} />
                        </p>
                      }
                    >
                      <Dashboard
                        key={campaign.id}
                        campaignId={campaign.id}
                        sessions={sessions}
                        pages={pages}
                        onSession={(s) =>
                          openSource({
                            sourceKind: "session",
                            sourceId: s.id,
                            sourceTitle: s.title,
                            sequence: s.sequence,
                            blockId: "",
                            preview: "",
                          })
                        }
                        onPage={(p) => openPage(p.id, p.title)}
                        onCharacter={() =>
                          void run(async () => setView("character"))
                        }
                        onNewSession={() =>
                          void run(async () => setForm("session"))
                        }
                      />
                    </Suspense>
                  ) : null}
                  {campaign && view === "graph" ? (
                    <Suspense
                      fallback={
                        <p role="status">
                          <Text source={"Apertura grafo…"} />
                        </p>
                      }
                    >
                      <GraphWorkspace
                        key={`${campaign.id}:${externalEpoch}`}
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
                    <Suspense
                      fallback={
                        <p role="status">
                          <Text source={"Apertura personaggio…"} />
                        </p>
                      }
                    >
                      <PlayerWorkspace
                        key={`${campaign.id}-${view}:${externalEpoch}`}
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
                        initialDraft={view === "abilities" ? wikiDraft : null}
                        onDraftUsed={() => setWikiDraft(null)}
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
                              <Text source={"Sessione "} />
                              {item.sequence}
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
                                <Text source={"Sessione "} />
                                {session.sequence}{" "}
                                <span aria-hidden="true">/</span>{" "}
                                {formatDate(session.playedOn)}
                              </p>
                              <h3>{session.title}</h3>
                            </header>
                            <Suspense
                              fallback={<p role="status">{it.editorLoading}</p>}
                            >
                              <Editor
                                key={`${session.id}:${externalEpoch}`}
                                session={session}
                                register={register}
                                onSaved={onSaved}
                                focusBlock={focusBlock}
                                disabled={busy}
                              />
                            </Suspense>
                            {session.document.importedFrom === "logseq" ? (
                              <Suspense fallback={null}>
                                <ImportSource
                                  key={session.id}
                                  campaignId={session.campaignId}
                                  kind="session"
                                  id={session.id}
                                />
                              </Suspense>
                            ) : null}
                          </>
                        ) : (
                          <p>{it.chooseSession}</p>
                        )}
                      </article>
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </main>
        </div>
      </KnowledgeContext.Provider>
    </OperationContext.Provider>
  );
}

function formatDate(date: string | null) {
  if (!date) return it.dateMissing;
  return new Intl.DateTimeFormat(localeInfo(getPreferences().locale).intl, {
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
