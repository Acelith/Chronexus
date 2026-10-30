import { date as formatDateTime } from "./i18n/store";
import { localeInfo } from "./i18n/locales";
import { getPreferences } from "./i18n/store";
import { Text } from "./i18n/Text";
import { usePreferences, tr } from "./i18n/store";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
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
import SyncStatusBadge from "./features/sync/SyncStatusBadge";
import type { SaveGuard } from "./features/journal/Editor";
import { appText } from "./strings";
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
import type { ClueSource } from "./features/clues/api";
import { OperationContext } from "./operations";
import { heraldApi, type UpdateOffer } from "./features/updates/api";
import { usePeriodicBackup } from "./features/backup/usePeriodicBackup";
import { useStartupHerald } from "./features/updates/useStartupHerald";
import { PeriodicBackupNotice } from "./features/backup/PeriodicBackupNotice";
import { CampaignForm, SessionForm } from "./features/journal/EntryForms";
import { AppSidebar } from "./features/shell/AppSidebar";
import { onboardingApi } from "./features/onboarding/api";
import { CampaignTabs } from "./features/shell/CampaignTabs";
import type { View } from "./features/shell/views";
const SearchPanel = lazy(() => import("./features/search/SearchPanel"));
const ClueWorkspace = lazy(() => import("./features/clues/ClueWorkspace"));

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
const AppSettings = lazy(() => import("./features/preferences/AppSettings"));
const HeraldAnnouncement = lazy(
  () => import("./features/updates/HeraldAnnouncement"),
);
const CampaignSettings = lazy(
  () => import("./features/assistant/CampaignSettings"),
);
const ImportSource = lazy(() => import("./features/knowledge/ImportSource"));
const CampaignSharing = lazy(() => import("./features/sync/CampaignSharing"));
const GuidedTour = lazy(() => import("./features/onboarding/GuidedTour"));

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
  const [view, setView] = useState<View>("journal");
  const [playerReturn, setPlayerReturn] = useState<{
    view: PlayerView;
    assetId: string;
  } | null>(null);
  /** Spell prepared in the wiki, waiting to open as an unsaved form. */
  const [wikiDraft, setWikiDraft] = useState<AbilityDetails | null>(null);
  const [focusBlock, setFocusBlock] = useState<string | undefined>();
  const [clueSource, setClueSource] = useState<ClueSource>();
  const [selectedClueId, setSelectedClueId] = useState<string>();
  const [form, setForm] = useState<"campaign" | "rename" | "session" | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
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

  const load = useCallback(async (preferred?: string) => {
    const version = ++loadVersion.current;
    try {
      const items = await api.campaigns();
      const first = items.find((item) => item.id === preferred) ?? items[0];
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
      if (!items.length) {
        // M32: offer the tour once on a fresh profile; a failure only skips the offer.
        onboardingApi
          .firstStart()
          .then((state) => {
            if (!state.tourSeen && version === loadVersion.current)
              setTourOpen(true);
          })
          .catch(() => undefined);
      }
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
          if (operation.current) {
            // Closing now could interrupt a save, backup or restore.
            setError(
              tr(
                "An operation is still running. Close Chronexus again when it has finished.",
              ),
            );
            return;
          }
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

  /** Switches workspace after flushing drafts, closing any open form. */
  function show(
    next: View,
    options: {
      closeBackup?: boolean;
      clearFocus?: boolean;
      before?: () => void;
    } = {},
  ) {
    void run(async () => {
      if (options.closeBackup) setBackupOpen(false);
      setView(next);
      if (next === "clues") {
        setClueSource(undefined);
        setSelectedClueId(undefined);
      }
      setForm(null);
      options.before?.();
      if (options.clearFocus) setFocusBlock(undefined);
    });
  }

  function selectCampaign(id: string) {
    if (id === campaignId && !backupOpen) return;
    void run(async () => {
      // Invalidate reads still running for the previous campaign (external refresh).
      const version = ++loadVersion.current;
      const [items, knowledge] = await Promise.all([
        api.sessions(id),
        knowledgeApi.pages(id),
      ]);
      if (version !== loadVersion.current) return;
      setCampaignId(id);
      setPlayerReturn(null);
      setBackupOpen(false);
      setSessions(items);
      setSessionId(items[0]?.id ?? null);
      setPages(knowledge);
      setPageId(null);
      setView("journal");
      setClueSource(undefined);
      setSelectedClueId(undefined);
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
        ++loadVersion.current;
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

  function closeTour() {
    setTourOpen(false);
    onboardingApi.setTourSeen(true).catch((reason: unknown) => {
      setError(errorMessage(reason));
    });
  }

  async function openDemo() {
    await run(async () => {
      setBackupOpen(false);
      const created = await onboardingApi.createDemo();
      await load(created.id);
      setView("overview");
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
      setError(tr("Complete or cancel the open form before searching."));
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
      } else if (result.kind === "clue") {
        setSelectedClueId(result.sourceId);
        setView("clues");
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
        // Native modals (the herald) have no role attribute but block input too.
        document.querySelector(
          'dialog[open],[role="dialog"],[role="alertdialog"]',
        )
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
  function createClueFromBlock(source: {
    kind: "session" | "page";
    id: string;
    blockId: string;
  }) {
    void run(async () => {
      setClueSource({ ...source });
      setSelectedClueId(undefined);
      setView("clues");
    });
  }
  function openClue(id: string) {
    void run(async () => {
      setClueSource(undefined);
      setSelectedClueId(id);
      setView("clues");
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
      if (!campaignId) throw Error(tr("Select a campaign."));
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
      <PeriodicBackupNotice
        outcome={periodic.outcome}
        onClose={periodic.dismiss}
      />
      {tourOpen && !herald.announcement ? (
        <Suspense fallback={null}>
          <GuidedTour onClose={closeTour} />
        </Suspense>
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
          <AppSidebar
            campaigns={campaigns}
            campaignId={campaignId}
            hasCampaign={!!campaign}
            backupOpen={backupOpen}
            view={view}
            busy={busy}
            loading={loading}
            onSelectCampaign={selectCampaign}
            onNewCampaign={() =>
              void run(async () => {
                setBackupOpen(false);
                setForm("campaign");
              })
            }
            onOpenBackup={() =>
              void run(async () => {
                setForm(null);
                setBackupOpen(true);
              })
            }
            onShow={(next) => show(next, { closeBackup: true })}
          />
          <main>
            {searchOpen && campaignId ? (
              <Suspense
                fallback={
                  <p role="status">
                    <Text source={"Opening search…"} />
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
                    <Text source={"Close message"} />
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
                    {appText.retry}
                  </button>
                ) : null}
              </div>
            ) : null}
            {backupOpen ? (
              <Suspense
                fallback={
                  <p role="status">
                    <Text source={"Opening backup…"} />
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
              <p role="status">{appText.loading}</p>
            ) : (
              <>
                <header className="campaign-header">
                  <div>
                    <h2>
                      {view === "preferences"
                        ? tr("App settings")
                        : (campaign?.name ?? appText.emptyCampaigns)}
                      {view !== "preferences" && campaign?.demo ? (
                        <span className="demo-badge">{tr("Demo")}</span>
                      ) : null}
                    </h2>
                  </div>
                  {campaign && view !== "preferences" ? (
                    <SyncStatusBadge
                      key={campaign.id}
                      campaignId={campaign.id}
                      onOpen={() => show("sharing")}
                    />
                  ) : null}
                  {view !== "preferences" ? (
                    <span className="last-modified">
                      {[...sessions, ...pages].some((item) =>
                        Number.isFinite(Date.parse(item.updatedAt)),
                      ) ? (
                        <>
                          <Text source={"Last changed:"} />{" "}
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
                  ) : null}
                  {campaign && view !== "preferences" ? (
                    <details className="campaign-actions">
                      <summary aria-label={tr("Campaign actions")}>•••</summary>
                      <div className="actions">
                        <button
                          ref={searchButton}
                          disabled={busy}
                          onClick={openSearch}
                          title={tr("Ctrl+K / ⌘K")}
                        >
                          <Text source={"Search the campaign"} />
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
                          {appText.rename}
                        </button>
                        <button
                          className="primary"
                          disabled={busy}
                          onClick={() => {
                            void run(async () => setForm("session"));
                          }}
                        >
                          + {appText.newSession}
                        </button>
                      </div>
                    </details>
                  ) : null}
                </header>
                {campaign ? (
                  <CampaignTabs
                    view={view}
                    busy={busy}
                    onShow={(next) =>
                      show(next, {
                        // Overview, Party and Wiki keep the focused source block.
                        clearFocus: !["overview", "party", "wiki"].includes(
                          next,
                        ),
                        before:
                          next === "codex" && !pageId
                            ? () => setPageId(pages[0]?.id ?? null)
                            : undefined,
                      })
                    }
                  />
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
                      <Text source={"Back to the character entry"} />
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
                      <p>{appText.emptyCampaignHint}</p>
                      {form !== "campaign" ? (
                        <div className="first-start-actions">
                          <button
                            className="primary"
                            onClick={() => setForm("campaign")}
                          >
                            {appText.createCampaign}
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => void openDemo()}
                          >
                            <Text source={"Try the demo campaign"} />
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => setTourOpen(true)}
                          >
                            <Text source={"Take the guided tour"} />
                          </button>
                        </div>
                      ) : null}
                    </section>
                  ) : null}
                  {campaign && view === "codex" ? (
                    <Suspense
                      fallback={
                        <p role="status">
                          <Text source={"Opening Codex…"} />
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
                        onCreateClue={createClueFromBlock}
                        onOpenClue={openClue}
                        onCreate={createPage}
                        onUpdate={updatePage}
                        onRecover={recoverPage}
                      />
                    </Suspense>
                  ) : null}
                  {view === "preferences" ? (
                    <Suspense
                      fallback={<p role="status">{tr("Opening settings…")}</p>}
                    >
                      <AppSettings
                        busy={busy}
                        run={run}
                        onOpenTour={() => setTourOpen(true)}
                        onDemoChanged={(id) => load(id ?? undefined)}
                        initialOffer={updateHandoff}
                        onHandoffUsed={() => setUpdateHandoff(null)}
                        onCampaignAdded={() => void load()}
                      />
                    </Suspense>
                  ) : null}
                  {campaign && view === "dice" ? (
                    <Suspense
                      fallback={
                        <p role="status">
                          <Text source={"Opening dice roller…"} />
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
                          <Text source={"Opening settings…"} />
                        </p>
                      }
                    >
                      <CampaignSettings
                        key={campaign.id}
                        campaignId={campaign.id}
                        register={register}
                      />
                    </Suspense>
                  ) : null}
                  {campaign && view === "sharing" ? (
                    <Suspense
                      fallback={<p role="status">{tr("Opening sharing…")}</p>}
                    >
                      <CampaignSharing
                        key={campaign.id}
                        campaignId={campaign.id}
                        busy={busy}
                      />
                    </Suspense>
                  ) : null}
                  {campaign && view === "clues" ? (
                    <Suspense
                      fallback={<p role="status">{tr("Loading clues…")}</p>}
                    >
                      <ClueWorkspace
                        key={campaign.id}
                        campaignId={campaign.id}
                        pages={pages}
                        sessions={sessions}
                        initialSource={clueSource}
                        selectedId={selectedClueId}
                        externalEpoch={externalEpoch}
                        register={register}
                        busy={busy}
                        onSource={(source) =>
                          openGraphSource({
                            kind: source.kind,
                            id: source.id,
                            title:
                              source.kind === "session"
                                ? (sessions.find((s) => s.id === source.id)
                                    ?.title ?? "")
                                : (pages.find((p) => p.id === source.id)
                                    ?.title ?? ""),
                            blockId: source.blockId,
                          })
                        }
                        onPage={openPage}
                      />
                    </Suspense>
                  ) : null}
                  {campaign && view === "assistant" ? (
                    <Suspense
                      fallback={
                        <p role="status">
                          <Text source={"Opening assistant…"} />
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
                          <Text source={"Opening wiki…"} />
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
                          <Text source={"Opening party…"} />
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
                          <Text source={"Opening overview…"} />
                        </p>
                      }
                    >
                      <Dashboard
                        key={campaign.id}
                        campaignId={campaign.id}
                        sessions={sessions}
                        pages={pages}
                        onImported={refreshExternal}
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
                          <Text source={"Opening graph…"} />
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
                          <Text source={"Opening character…"} />
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
                      <h3>{appText.emptySessions}</h3>
                      <p>{appText.emptySessionsHint}</p>
                      <button
                        className="primary"
                        disabled={busy}
                        onClick={() => setForm("session")}
                      >
                        {appText.newSession}
                      </button>
                    </section>
                  ) : null}
                  {view === "journal" && sessions.length ? (
                    <div className="journal-layout">
                      <nav
                        className="session-list"
                        aria-label={appText.journal}
                      >
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
                              <Text source={"Session "} />
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
                                <Text source={"Session "} />
                                {session.sequence}{" "}
                                <span aria-hidden="true">/</span>{" "}
                                {formatDate(session.playedOn)}
                              </p>
                              <h3>{session.title}</h3>
                            </header>
                            <Suspense
                              fallback={
                                <p role="status">{appText.editorLoading}</p>
                              }
                            >
                              <Editor
                                key={`${session.id}:${externalEpoch}`}
                                session={session}
                                register={register}
                                onSaved={onSaved}
                                focusBlock={focusBlock}
                                disabled={busy}
                                onCreateClue={createClueFromBlock}
                                onOpenClue={openClue}
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
                          <p>{appText.chooseSession}</p>
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
  if (!date) return appText.dateMissing;
  return new Intl.DateTimeFormat(localeInfo(getPreferences().locale).intl, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}
