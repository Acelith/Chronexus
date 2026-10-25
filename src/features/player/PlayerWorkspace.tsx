import { Text } from "../../i18n/Text";
import { tr } from "../../i18n/store";
import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import type { SaveGuard } from "../journal/Editor";
import { errorMessage, type Session } from "../journal/api";
import type { KnowledgePage } from "../knowledge/api";
import type { SourceRef } from "../graph/api";
import {
  emptyLinks,
  playerApi,
  statGroups,
  type AbilityDetails,
  type Asset,
  type AssetDetails,
  type AssetInput,
  type Character,
  type CharacterInput,
  type PlayerView,
  type Stat,
} from "./api";
import { adapterFor } from "./rulesets";
import CharacterForm from "./CharacterForm";
import AssetForm from "./AssetForm";
import { emptySheet, trainingLabels } from "./sheet";
import { SheetSummary } from "./SheetSections";
import CatalogSourceNote from "./CatalogSourceNote";
const DndCatalog = lazy(() => import("./DndCatalog"));
const ImageGallery = lazy(() => import("../images/ImageGallery"));

type EditState =
  | { type: "character" }
  | {
      type: "asset";
      initial: Asset | null;
      kind: AssetDetails["kind"];
      draft?: AssetInput;
    }
  | null;
interface Props {
  campaignId: string;
  view: PlayerView;
  pages: KnowledgePage[];
  sessions: Session[];
  busy?: boolean;
  initialSelection?: string;
  /** Spell prepared from the wiki: opens as an unsaved, editable form. */
  initialDraft?: AbilityDetails | null;
  onDraftUsed?: () => void;
  register: (guard: SaveGuard | null) => void;
  onPage: (
    id: string,
    title: string,
    assetId: string,
    view: PlayerView,
  ) => void;
  onSource: (source: SourceRef, assetId: string, view: PlayerView) => void;
}
export default function PlayerWorkspace({
  campaignId,
  view,
  pages,
  sessions,
  busy = false,
  initialSelection,
  initialDraft,
  onDraftUsed,
  register,
  onPage,
  onSource,
}: Props) {
  const [character, setCharacter] = useState<Character | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [editor, setEditor] = useState<EditState>(() =>
    initialDraft
      ? {
          type: "asset",
          initial: null,
          kind: "spell",
          draft: { details: initialDraft, links: emptyLinks() },
        }
      : null,
  );
  const draftOnMount = useRef(initialDraft ?? null);
  const draftUsed = useRef(onDraftUsed);
  const [pending, setPending] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelection ?? null,
  );
  const [confirm, setConfirm] = useState<Asset | null>(null);
  const [search, setSearch] = useState("");
  const [rank, setRank] = useState("");
  const [status, setStatus] = useState("all");
  const [catalogOpen, setCatalogOpen] = useState(false);
  const dirty = useRef(initialDraft != null);
  const operation = useRef(false);
  const deleteButton = useRef<HTMLButtonElement>(null);
  function edit(value: EditState) {
    dirty.current = value !== null;
    setEditor(value);
    setError("");
  }
  function askDelete(value: Asset | null) {
    dirty.current = value !== null;
    setConfirm(value);
  }
  useEffect(() => {
    register({
      dirty: () => dirty.current || operation.current,
      flush: async () => {
        if (operation.current)
          throw Error(tr("Wait for the sheet or entry to be saved."));
        if (dirty.current)
          throw Error(
            tr(
              "Save or cancel the open changes before changing view or closing Chronexus.",
            ),
          );
      },
    });
    return () => register(null);
  }, [register]);
  useEffect(() => {
    let active = true;
    playerApi
      .character(campaignId)
      .then(async (sheet) => ({
        sheet,
        items: sheet ? await playerApi.assets(campaignId, sheet.id) : [],
      }))
      .then(({ sheet, items }) => {
        if (active) {
          setCharacter(sheet);
          setAssets(items);
          setError("");
          if (draftOnMount.current) {
            draftOnMount.current = null;
            draftUsed.current?.();
            if (!sheet) {
              dirty.current = false;
              setEditor(null);
              setError(
                tr(
                  "Create the character first, then repeat the import from the wiki. No spell was saved.",
                ),
              );
            }
          }
        }
      })
      .catch((reason) => {
        if (active) setError(errorMessage(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [campaignId, refresh]);
  const disabled = busy || pending;
  async function perform(
    action: () => Promise<void>,
    message = tr("Saved on the computer."),
  ) {
    if (operation.current || busy) return;
    operation.current = true;
    setPending(true);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(message);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      operation.current = false;
      setPending(false);
    }
  }
  function saveAsset(input: AssetInput, initial: Asset | null) {
    if (!character) return Promise.resolve();
    return perform(async () => {
      const saved = await playerApi.saveAsset(
        campaignId,
        character.id,
        initial,
        input,
      );
      setAssets((items) => [...items.filter((a) => a.id !== saved.id), saved]);
      setSelectedId(saved.id);
      edit(null);
    });
  }
  const visible = assets
    .filter((asset) => {
      const d = asset.input.details;
      if (view === "inventory" ? d.kind !== "item" : d.kind === "item")
        return false;
      if (
        !d.name.toLocaleLowerCase("it").includes(search.toLocaleLowerCase("it"))
      )
        return false;
      if (view === "abilities" && d.kind !== "item") {
        if (
          rank &&
          !d.rank.toLocaleLowerCase("it").includes(rank.toLocaleLowerCase("it"))
        )
          return false;
        if (
          (status === "known" && !d.known) ||
          (status === "prepared" && !d.prepared) ||
          (status === "spell" && d.kind !== "spell") ||
          (status === "ability" && d.kind !== "ability")
        )
          return false;
      }
      return true;
    })
    .sort((a, b) =>
      a.input.details.name.localeCompare(b.input.details.name, "it"),
    );
  const selected = visible.find((a) => a.id === selectedId) ?? visible[0];
  const title =
    view === "character"
      ? tr("Character")
      : view === "inventory"
        ? tr("Inventory")
        : tr("Spells and abilities");
  if (loading)
    return (
      <p role="status">
        <Text source={"Opening sheet and inventory…"} />
      </p>
    );
  if (error && !character && !editor)
    return (
      <section aria-label={title}>
        <div role="alert" className="error">
          <p>{error}</p>
          <button
            disabled={disabled}
            onClick={() => {
              setLoading(true);
              setRefresh((n) => n + 1);
            }}
          >
            <Text source={"Reload sheet"} />
          </button>
        </div>
      </section>
    );
  return (
    <section
      className="player-workspace"
      aria-label={title}
      aria-busy={disabled}
    >
      <header className="player-heading">
        <div>
          <h3>{title}</h3>
          <p className="muted">
            {character
              ? tr("{0} · {1}", [
                  character.data.name,
                  adapterFor(character.data.systemId).label,
                ])
              : tr(
                  "Create the character to collect resources, items and abilities.",
                )}
          </p>
        </div>
        {!editor && character ? (
          <div className="actions">
            {view === "character" ? (
              <button
                disabled={disabled}
                onClick={() => edit({ type: "character" })}
              >
                <Text source={"Edit character"} />
              </button>
            ) : (
              <>
                <button
                  className="primary"
                  disabled={disabled}
                  onClick={() =>
                    edit({
                      type: "asset",
                      initial: null,
                      kind: view === "inventory" ? "item" : "spell",
                    })
                  }
                >
                  {view === "inventory" ? tr("Add item") : tr("Add spell")}
                </button>
                {view === "abilities" ? (
                  <button
                    disabled={disabled}
                    onClick={() =>
                      edit({ type: "asset", initial: null, kind: "ability" })
                    }
                  >
                    <Text source={"Add ability"} />
                  </button>
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </header>
      {!editor ? (
        <button disabled={disabled} onClick={() => setCatalogOpen((v) => !v)}>
          {catalogOpen ? tr("Hide D&D search") : tr("Search D&D")}
        </button>
      ) : null}
      {catalogOpen && !editor ? (
        <Suspense
          fallback={
            <p role="status">
              <Text source={"Opening catalog…"} />
            </p>
          }
        >
          <DndCatalog
            onClose={() => setCatalogOpen(false)}
            onImport={
              character
                ? (details) => {
                    setCatalogOpen(false);
                    edit({
                      type: "asset",
                      initial: null,
                      kind: "spell",
                      draft: {
                        details,
                        links: {
                          pageId: null,
                          sourceSessionId: null,
                          sourceBlockId: null,
                          npcId: null,
                          placeId: null,
                          questId: null,
                          provenanceNotes: "",
                        },
                      },
                    });
                  }
                : undefined
            }
          />
        </Suspense>
      ) : null}
      {error ? (
        <div className="error" role="alert">
          <p>{error}</p>
          {!editor && !confirm ? (
            <button
              disabled={disabled}
              onClick={() => {
                setLoading(true);
                setRefresh((n) => n + 1);
              }}
            >
              <Text source={"Reload sheet"} />
            </button>
          ) : null}
        </div>
      ) : null}
      <p className="player-save-status" role="status">
        {pending ? tr("Saving…") : notice}
      </p>
      {editor?.type === "character" ? (
        <CharacterForm
          initial={character}
          busy={disabled}
          onCancel={() => edit(null)}
          onSave={async (input: CharacterInput) => {
            await perform(async () => {
              const saved = await playerApi.saveCharacter(
                campaignId,
                character,
                input,
              );
              setCharacter(saved);
              edit(null);
            });
          }}
        />
      ) : editor?.type === "asset" && character ? (
        <AssetForm
          initial={editor.initial}
          draft={editor.draft}
          kind={editor.kind}
          systemId={character.data.systemId}
          pages={pages}
          sessions={sessions}
          busy={disabled}
          onCancel={() => edit(null)}
          onSave={(input) => saveAsset(input, editor.initial)}
        />
      ) : !character ? (
        <div className="empty player-empty">
          <h4>
            <Text source={"The sheet is still empty"} />
          </h4>
          <p>
            <Text
              source={
                "The values are whatever you enter, regardless of the rules system."
              }
            />
          </p>
          <button
            className="primary"
            disabled={disabled}
            onClick={() => edit({ type: "character" })}
          >
            <Text source={"Create character"} />
          </button>
        </div>
      ) : view === "character" ? (
        <>
          <div className="character-identity">
            <h4>{character.data.name}</h4>
            <dl>
              {[
                [tr("Rules system"), character.data.systemId],
                [tr("Origin"), character.data.ancestry],
                [tr("Calling"), character.data.vocation],
                [tr("Level"), character.data.level],
                [tr("Experience"), character.data.experience],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value ?? tr("Not given")}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="player-counters">
            <Counter
              label={tr("Hit points")}
              value={character.data.hpCurrent}
              maximum={character.data.hpMaximum}
              disabled={disabled}
              onChange={(delta) =>
                void perform(async () =>
                  setCharacter(
                    await playerApi.counter(campaignId, character, "hp", delta),
                  ),
                )
              }
            />
            <Counter
              label={tr("Temporary hit points")}
              value={character.data.hpTemporary}
              maximum={1000000}
              hideMaximum
              disabled={disabled}
              onChange={(delta) =>
                void perform(async () =>
                  setCharacter(
                    await playerApi.counter(
                      campaignId,
                      character,
                      "temporaryHp",
                      delta,
                    ),
                  ),
                )
              }
            />
            {character.data.resources
              .filter(
                (r) => r.kind !== "slot" || r.maximum > 0 || r.current > 0,
              )
              .map((resource) => (
                <Counter
                  key={resource.id}
                  label={resource.label}
                  kind={resource.kind === "slot" ? "Slots" : "Resource"}
                  value={resource.current}
                  maximum={resource.maximum}
                  disabled={disabled}
                  onChange={(delta) =>
                    void perform(async () =>
                      setCharacter(
                        await playerApi.counter(
                          campaignId,
                          character,
                          resource.id,
                          delta,
                        ),
                      ),
                    )
                  }
                />
              ))}
          </div>
          {character.data.resources.some(
            (r) => r.kind === "slot" && !r.maximum && !r.current,
          ) ? (
            <details className="unused-slots">
              <summary>
                <Text source={"Slots not configured"} />
              </summary>
              <p className="muted">
                <Text source={"Set the maximums from Edit character."} />
              </p>
              {character.data.resources
                .filter((r) => r.kind === "slot" && !r.maximum && !r.current)
                .map((r) => (
                  <p key={r.id}>{r.label}: 0 / 0</p>
                ))}
            </details>
          ) : null}
          <h4>
            <Text source={"Statistics"} />
          </h4>
          {character.data.stats.length ? (
            <Statistics stats={character.data.stats} />
          ) : (
            <p className="muted">
              <Text
                source={
                  "No statistics configured. Add them from “Edit character”."
                }
              />
            </p>
          )}
          <SheetSummary value={character.data.sheet ?? emptySheet()} />
          <Suspense
            fallback={
              <p role="status">
                <Text source={"Opening images…"} />
              </p>
            }
          >
            <ImageGallery
              key={character.id}
              campaignId={campaignId}
              target={{ kind: "character", id: character.id }}
              busy={disabled}
            />
          </Suspense>
          <h4>
            <Text source={"Conditions"} />
          </h4>
          <p className="player-text">
            {character.data.conditions || tr("No conditions noted.")}
          </p>
          <h4>
            <Text source={"Notes"} />
          </h4>
          <p className="player-text">
            {character.data.notes || tr("No character notes.")}
          </p>
        </>
      ) : (
        <>
          <div className="player-filters">
            <label>
              <Text source={"Search by name"} />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={disabled}
              />
            </label>
            {view === "abilities" ? (
              <>
                <label>
                  <Text source={"Filter by level"} />
                  <input
                    value={rank}
                    onChange={(e) => setRank(e.target.value)}
                    disabled={disabled}
                  />
                </label>
                <label>
                  <Text source={"Status or type"} />
                  <select
                    aria-label={tr("Status or type")}
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    disabled={disabled}
                  >
                    <option value="all">{tr("All")}</option>
                    <option value="known">{tr("Known")}</option>
                    <option value="prepared">{tr("Prepared")}</option>
                    <option value="spell">{tr("Spells")}</option>
                    <option value="ability">{tr("Abilities")}</option>
                  </select>
                </label>
              </>
            ) : null}
          </div>
          {view === "abilities" ? (
            <p className="muted">
              <Text
                source={
                  "Create custom entries or use the D&D catalog as a base. To spend resources or slots, use the sheet counters."
                }
              />
            </p>
          ) : null}
          {!visible.length ? (
            <div className="player-empty">
              <p>
                {search || rank || status !== "all"
                  ? tr("No entries match the filters.")
                  : view === "inventory"
                    ? tr(
                        "The inventory is empty. Add the first item and note who gave it to you.",
                      )
                    : tr(
                        "No abilities noted. Add a spell or an ability with your own text.",
                      )}
              </p>
            </div>
          ) : (
            <div className="player-assets-layout">
              <nav
                className="player-asset-list"
                aria-label={tr("Character entries")}
              >
                {visible.map((a) => (
                  <button
                    key={a.id}
                    disabled={disabled}
                    aria-current={a.id === selected?.id ? "page" : undefined}
                    onClick={() => {
                      setSelectedId(a.id);
                      setError("");
                    }}
                  >
                    <strong>{a.input.details.name}</strong>
                    <span>
                      {a.input.details.kind === "item"
                        ? tr("Number of {0}{1}", [
                            a.input.details.quantity,
                            a.input.details.equipped ? tr(" · Equipped") : "",
                          ])
                        : tr("{0} · {1}", [
                            a.input.details.kind === "spell"
                              ? tr("Spell")
                              : tr("Abilities"),
                            a.input.details.rank || tr("No level"),
                          ])}
                    </span>
                  </button>
                ))}
              </nav>
              {selected ? (
                <article
                  className="player-asset-detail"
                  aria-label={tr("Entry details")}
                >
                  <h4>{selected.input.details.name}</h4>
                  <Suspense
                    fallback={
                      <p role="status">
                        <Text source={"Opening images…"} />
                      </p>
                    }
                  >
                    <ImageGallery
                      key={selected.id}
                      campaignId={campaignId}
                      target={{ kind: "asset", id: selected.id }}
                      busy={disabled}
                    />
                  </Suspense>
                  {selected.input.details.kind === "item" ? (
                    <>
                      <Counter
                        label={tr("Quantity")}
                        value={selected.input.details.quantity}
                        maximum={1000000}
                        hideMaximum
                        disabled={disabled}
                        onChange={(delta) => {
                          if (selected.input.details.kind === "item")
                            void saveAsset(
                              {
                                ...selected.input,
                                details: {
                                  ...selected.input.details,
                                  quantity:
                                    selected.input.details.quantity + delta,
                                },
                              },
                              selected,
                            );
                        }}
                      />
                      <p>
                        {selected.input.details.category || tr("Uncategorized")}{" "}
                        ·{" "}
                        {selected.input.details.equipped
                          ? tr("Equipped")
                          : tr("Not equipped")}
                        {selected.input.details.consumable
                          ? tr(" · Consumable")
                          : ""}
                      </p>
                      <p>
                        <Text source={"Weight: "} />
                        {selected.input.details.weight ?? tr("Not given")}{" "}
                        <Text source={"· Value:"} />{" "}
                        {selected.input.details.value || tr("Not given")}
                      </p>
                      <p>
                        <Text source={"Location:"} />{" "}
                        {selected.input.details.location || tr("Not given")}
                      </p>
                      <button
                        disabled={disabled}
                        onClick={() => {
                          if (selected.input.details.kind === "item")
                            void saveAsset(
                              {
                                ...selected.input,
                                details: {
                                  ...selected.input.details,
                                  equipped: !selected.input.details.equipped,
                                },
                              },
                              selected,
                            );
                        }}
                      >
                        {selected.input.details.equipped
                          ? tr("Unequip")
                          : tr("Equip")}
                      </button>
                    </>
                  ) : (
                    <>
                      <p>
                        {selected.input.details.systemId} ·{" "}
                        {selected.input.details.rank || tr("No level")} ·{" "}
                        {selected.input.details.school || tr("No tradition")}
                      </p>
                      <p>
                        {selected.input.details.ritual ? tr("Ritual · ") : ""}
                        {selected.input.details.concentration
                          ? tr("Requires concentration")
                          : ""}
                      </p>
                      {selected.input.details.catalogSource ? (
                        <CatalogSourceNote
                          source={selected.input.details.catalogSource}
                          compact
                        />
                      ) : null}
                      <dl className="ability-metadata">
                        {[
                          [
                            tr("Activation"),
                            selected.input.details.castingTime,
                          ],
                          [tr("Duration"), selected.input.details.duration],
                          [tr("Range"), selected.input.details.range],
                          [tr("Components"), selected.input.details.components],
                        ].map(([label, value]) => (
                          <div key={label}>
                            <dt>{label}</dt>
                            <dd>{value || tr("Not given")}</dd>
                          </div>
                        ))}
                      </dl>
                      <p>
                        {selected.input.details.known
                          ? tr("Known")
                          : tr("Not marked as known")}{" "}
                        ·{" "}
                        {selected.input.details.prepared
                          ? tr("Prepared")
                          : tr("Not prepared")}
                      </p>
                      <div className="actions">
                        <button
                          disabled={disabled}
                          onClick={() => {
                            if (selected.input.details.kind !== "item")
                              void saveAsset(
                                {
                                  ...selected.input,
                                  details: {
                                    ...selected.input.details,
                                    known: !selected.input.details.known,
                                  },
                                },
                                selected,
                              );
                          }}
                        >
                          <Text source={"Toggle known"} />
                        </button>
                        <button
                          disabled={disabled}
                          onClick={() => {
                            if (selected.input.details.kind !== "item")
                              void saveAsset(
                                {
                                  ...selected.input,
                                  details: {
                                    ...selected.input.details,
                                    prepared: !selected.input.details.prepared,
                                  },
                                },
                                selected,
                              );
                          }}
                        >
                          <Text source={"Toggle prepared"} />
                        </button>
                      </div>
                    </>
                  )}
                  <p className="player-text">
                    {selected.input.details.description ||
                      tr("No description.")}
                  </p>
                  {selected.input.details.notes ? (
                    <p className="player-text">
                      {selected.input.details.notes}
                    </p>
                  ) : null}
                  <h5>
                    <Text source={"Provenance and links"} />
                  </h5>
                  <div className="player-provenance">
                    {(
                      [
                        [selected.input.links.pageId, tr("Codex page")],
                        [selected.input.links.npcId, "NPC"],
                        [selected.input.links.placeId, tr("Place")],
                        [selected.input.links.questId, tr("Quest")],
                      ] as const
                    ).map(([id, label]) => {
                      const page = pages.find((p) => p.id === id);
                      return id ? (
                        <button
                          key={label}
                          disabled={disabled}
                          onClick={() =>
                            onPage(
                              id,
                              page?.title ?? "Linked page",
                              selected.id,
                              view,
                            )
                          }
                        >
                          {label}: {page?.title ?? tr("Open page")}
                        </button>
                      ) : null;
                    })}
                    {selected.input.links.sourceSessionId ? (
                      <button
                        disabled={disabled}
                        onClick={() => {
                          const session = sessions.find(
                            (s) =>
                              s.id === selected.input.links.sourceSessionId,
                          );
                          if (session)
                            onSource(
                              {
                                kind: "session",
                                id: session.id,
                                title: session.title,
                                blockId: selected.sourceAvailable
                                  ? selected.input.links.sourceBlockId
                                  : null,
                              },
                              selected.id,
                              view,
                            );
                        }}
                      >
                        <Text source={"Open source session"} />
                        {selected.input.links.sourceBlockId &&
                        selected.sourceAvailable
                          ? tr(" at block")
                          : ""}
                      </button>
                    ) : null}
                  </div>
                  {!selected.sourceAvailable ? (
                    <p role="status">
                      <Text
                        source={
                          "The source block is no longer present. The provenance is kept; you can open the whole session."
                        }
                      />
                    </p>
                  ) : null}
                  <p className="player-text">
                    {selected.input.links.provenanceNotes ||
                      tr("No provenance notes.")}
                  </p>
                  <div className="actions">
                    <button
                      disabled={disabled}
                      onClick={() =>
                        edit({
                          type: "asset",
                          initial: selected,
                          kind: selected.input.details.kind,
                        })
                      }
                    >
                      <Text source={"Edit entry"} />
                    </button>
                    <button
                      ref={deleteButton}
                      disabled={disabled}
                      onClick={() => askDelete(selected)}
                    >
                      <Text source={"Delete entry"} />
                    </button>
                  </div>
                </article>
              ) : null}
            </div>
          )}
        </>
      )}
      {confirm ? (
        <DeleteConfirmation
          asset={confirm}
          busy={disabled}
          error={error}
          onCancel={() => {
            askDelete(null);
            deleteButton.current?.focus();
          }}
          onDelete={() =>
            void perform(async () => {
              await playerApi.deleteAsset(confirm);
              setAssets((items) => items.filter((a) => a.id !== confirm.id));
              askDelete(null);
            }, tr("Entry deleted. Pages and notes kept."))
          }
        />
      ) : null}
    </section>
  );
}
function Statistics({ stats }: { stats: Stat[] }) {
  return (
    <div className="sheet-sections">
      {Object.entries(statGroups).map(([group, label]) => {
        const entries = stats.filter((s) => s.group === group);
        return entries.length ? (
          <details key={group} open={group !== "skill" && group !== "save"}>
            <summary>
              {label} · {entries.length}
            </summary>
            <dl className="player-stats">
              {entries.map((s) => (
                <div key={s.id}>
                  <dt>{s.label}</dt>
                  <dd>
                    {s.value || tr("Not given")}
                    {s.modifier ? tr(" · Mod. {0}", [s.modifier]) : ""}
                    {s.training && s.training !== "none"
                      ? tr(" · {0}", [trainingLabels[s.training]])
                      : ""}
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        ) : null;
      })}
    </div>
  );
}
function Counter({
  label,
  value,
  maximum,
  disabled,
  onChange,
  hideMaximum = false,
  kind,
}: {
  label: string;
  value: number;
  maximum: number;
  disabled: boolean;
  onChange: (delta: number) => void;
  hideMaximum?: boolean;
  kind?: string;
}) {
  return (
    <div className="player-counter">
      <div>
        <span>{label}</span>
        {kind ? <small>{kind}</small> : null}
        <output aria-label={label}>
          {value}
          {hideMaximum ? "" : ` / ${maximum}`}
        </output>
      </div>
      <div className="actions">
        <button
          aria-label={tr("Decrease {0}", [label])}
          disabled={disabled || value <= 0}
          onClick={() => onChange(-1)}
        >
          −
        </button>
        <button
          aria-label={tr("Increase {0}", [label])}
          disabled={disabled || value >= maximum}
          onClick={() => onChange(1)}
        >
          +
        </button>
      </div>
    </div>
  );
}
function DeleteConfirmation({
  asset,
  busy,
  error,
  onCancel,
  onDelete,
}: {
  asset: Asset;
  busy: boolean;
  error: string;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancel.current?.focus();
  }, []);
  function keys(e: KeyboardEvent) {
    if (e.key === "Escape" && !busy) {
      e.preventDefault();
      onCancel();
    }
    if (e.key !== "Tab") return;
    const buttons = dialog.current?.querySelectorAll<HTMLButtonElement>(
      "button:not(:disabled)",
    );
    if (!buttons?.length) {
      e.preventDefault();
      return;
    }
    const first = buttons[0],
      last = buttons[buttons.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
  return (
    <div className="player-confirm-overlay">
      <div
        ref={dialog}
        className="player-confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="player-delete-title"
        aria-describedby="player-delete-description"
        onKeyDown={keys}
      >
        <h4 id="player-delete-title">
          <Text source={"Delete "} />
          {asset.input.details.name}?
        </h4>
        <p id="player-delete-description">
          <Text
            source={
              "The entry will be removed from the character. Codex pages and source notes will be kept."
            }
          />
        </p>
        {error ? <p role="alert">{error}</p> : null}
        <div className="actions">
          <button ref={cancel} disabled={busy} onClick={onCancel}>
            <Text source={"Cancel deletion"} />
          </button>
          <button className="danger" disabled={busy} onClick={onDelete}>
            <Text source={"Confirm deletion"} />
          </button>
        </div>
      </div>
    </div>
  );
}
