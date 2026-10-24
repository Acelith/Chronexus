import NodePortrait from "./NodePortrait";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { errorMessage, type Session } from "../journal/api";
import type { SaveGuard } from "../journal/Editor";
import { pageKinds, type KnowledgePage } from "../knowledge/api";
import {
  certainties,
  defaultQuery,
  graphApi,
  type GraphData,
  type GraphEdge,
  type GraphNode,
  type GraphQuery,
  type Relationship,
  type RelationshipInput,
  type SourceRef,
} from "./api";
import RelationshipForm from "./RelationshipForm";
const GraphCanvas = lazy(() => import("./GraphCanvas"));
interface Props {
  campaignId: string;
  pages: KnowledgePage[];
  sessions: Session[];
  busy?: boolean;
  register: (guard: SaveGuard | null) => void;
  onNode: (node: GraphNode) => void;
  onSource: (source: SourceRef) => void;
}
export default function GraphWorkspace({
  campaignId,
  pages,
  sessions,
  busy = false,
  register,
  onNode,
  onSource,
}: Props) {
  const [draft, setDraft] = useState<GraphQuery>(defaultQuery);
  const [query, setQuery] = useState<GraphQuery>(defaultQuery);
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [relationLoading, setRelationLoading] = useState(false);
  const [form, setForm] = useState<"new" | Relationship | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [edgeId, setEdgeId] = useState<string | null>(null);
  const [relationship, setRelationship] = useState<Relationship | null>(null);
  const selectionVersion = useRef(0);
  const dirty = useRef(false);
  useEffect(() => {
    dirty.current = form !== null || confirm;
  }, [form, confirm]);
  useEffect(() => {
    register({
      flush: async () => {
        if (dirty.current)
          throw Error(
            "Salva o annulla la relazione aperta prima di cambiare vista o chiudere Chronexus.",
          );
      },
      dirty: () => dirty.current,
    });
    return () => register(null);
  }, [register]);
  useEffect(() => {
    let active = true;
    graphApi
      .graph(campaignId, query)
      .then((result) => {
        if (active) {
          setData(result);
          const degree = (id: string) =>
            result.edges.filter((e) => e.source === id || e.target === id)
              .length;
          const suggested = [...result.nodes]
            .filter((n) => n.kind === "npc")
            .sort((a, b) => degree(b.id) - degree(a.id))[0];
          setSelectedNode((current) => current ?? suggested ?? null);
          setLoading(false);
        }
      })
      .catch((reason) => {
        if (active) {
          setError(errorMessage(reason));
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [campaignId, query, refresh]);
  const edge = data?.edges.find((edge) => edge.id === edgeId);
  const nodeTitle = (id: string) =>
    data?.nodes.find((node) => node.id === id)?.title ?? "Pagina non visibile";
  function apply(next: GraphQuery) {
    selectionVersion.current += 1;
    setRelationLoading(false);
    setSelectedNode(null);
    setData(null);
    setLoading(true);
    setError("");
    setNotice("");
    setRelationship(null);
    setEdgeId(null);
    setDraft(next);
    setQuery({ ...next });
  }
  async function reload() {
    const result = await graphApi.graph(campaignId, query);
    setData(result);
  }
  async function selectEdge(selected: GraphEdge) {
    if (form || confirm || pending) return;
    setSelectedNode(null);
    const version = ++selectionVersion.current;
    setEdgeId(selected.id);
    setRelationship(null);
    setError("");
    if (selected.relationshipId) {
      setRelationLoading(true);
      try {
        const result = await graphApi.relationship(
          campaignId,
          selected.relationshipId,
        );
        if (version === selectionVersion.current) setRelationship(result);
      } catch (reason) {
        if (version === selectionVersion.current)
          setError(errorMessage(reason));
      } finally {
        if (version === selectionVersion.current) setRelationLoading(false);
      }
    }
  }
  async function save(input: RelationshipInput) {
    setPending(true);
    setError("");
    setNotice("");
    try {
      const saved = await graphApi.save(
        campaignId,
        input,
        form && form !== "new" ? form : undefined,
      );
      setForm(null);
      setRelationship(saved);
      setEdgeId(`relationship:${saved.id}`);
      setNotice("Relazione salvata sul computer.");
      await reload();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setPending(false);
    }
  }
  async function remove() {
    if (!relationship) return;
    setPending(true);
    setError("");
    try {
      await graphApi.remove(campaignId, relationship);
      setConfirm(false);
      setRelationship(null);
      setEdgeId(null);
      setNotice(
        "Relazione eliminata. Le menzioni negli appunti sono conservate.",
      );
      await reload();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setPending(false);
    }
  }
  const disabled = busy || pending || form !== null || confirm;
  const source = relationship?.sourceId
    ? {
        kind: relationship.sourceKind!,
        id: relationship.sourceId,
        blockId: relationship.sourceBlockId,
        title:
          relationship.sourceKind === "session"
            ? (sessions.find((s) => s.id === relationship.sourceId)?.title ??
              "Sessione")
            : (pages.find((p) => p.id === relationship.sourceId)?.title ??
              "Pagina"),
      }
    : edge?.provenance;
  return (
    <section className="graph-workspace" aria-label="Grafo della campagna">
      <div className="graph-heading">
        <div>
          <h3>Connessioni della campagna</h3>
          <p className="editor-hint">
            Esplora come persone, luoghi, oggetti ed eventi si intrecciano nella
            storia.
          </p>
        </div>
        <button
          className="primary"
          disabled={disabled || !pages.length || relationLoading}
          onClick={() => {
            setForm("new");
            setNotice("");
            setError("");
          }}
        >
          Nuova relazione
        </button>
      </div>
      <div className="graph-filter-details">
        <form
          className="graph-filters"
          aria-label="Filtri del grafo"
          onSubmit={(event) => {
            event.preventDefault();
            apply(draft);
          }}
        >
          <fieldset disabled={disabled}>
            <label>
              Cerca nodi
              <input
                type="search"
                maxLength={200}
                value={draft.search}
                onChange={(event) =>
                  setDraft({ ...draft, search: event.target.value })
                }
              />
            </label>
            <label>
              Tipo nodo
              <select
                aria-label="Tipo nodo"
                value={draft.kind ?? ""}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    kind: (event.target.value as GraphNode["kind"]) || null,
                  })
                }
              >
                <option value="">Tutti i tipi</option>
                {Object.entries(pageKinds).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
                <option value="session">Sessione</option>
                <option value="missing">Pagina mancante</option>
              </select>
            </label>
            <label>
              Collegamenti
              <select
                aria-label="Collegamenti"
                value={draft.edgeKind}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    edgeKind: event.target.value as GraphQuery["edgeKind"],
                  })
                }
              >
                <option value="all">Menzioni e relazioni</option>
                <option value="mentions">Solo menzioni</option>
                <option value="assertions">Solo relazioni dichiarate</option>
              </select>
            </label>
            <details className="graph-advanced">
              <summary>Altri filtri</summary>
              <div>
                <label>
                  Certezza delle relazioni
                  <select
                    aria-label="Certezza delle relazioni"
                    value={draft.certainty ?? ""}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        certainty:
                          (event.target.value as GraphQuery["certainty"]) ||
                          null,
                      })
                    }
                  >
                    <option value="">Tutte le certezze</option>
                    {Object.entries(certainties).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Fonte sessione
                  <select
                    aria-label="Fonte sessione"
                    value={draft.sessionId ?? ""}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        sessionId: event.target.value || null,
                      })
                    }
                  >
                    <option value="">Tutte le sessioni</option>
                    {sessions.map((session) => (
                      <option key={session.id} value={session.id}>
                        Sessione {session.sequence}: {session.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Nodo centrale
                  <select
                    aria-label="Nodo centrale"
                    value={draft.focusId ?? ""}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        focusId: event.target.value || null,
                      })
                    }
                  >
                    <option value="">Nessun centro</option>
                    {pages.map((page) => (
                      <option key={page.id} value={`page:${page.id}`}>
                        {page.title}
                      </option>
                    ))}
                    {sessions.map((session) => (
                      <option key={session.id} value={`session:${session.id}`}>
                        Sessione {session.sequence}: {session.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Profondità
                  <select
                    aria-label="Profondità"
                    value={draft.depth}
                    disabled={!draft.focusId || disabled}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        depth: Number(event.target.value) as 1 | 2,
                      })
                    }
                  >
                    <option value={1}>1 passaggio</option>
                    <option value={2}>2 passaggi</option>
                  </select>
                </label>
              </div>
            </details>
            <div className="actions">
              <button className="primary">Applica filtri</button>
              <button type="button" onClick={() => apply(defaultQuery)}>
                Azzera filtri
              </button>
            </div>
          </fieldset>
        </form>
      </div>
      {error ? (
        <div className="error" role="alert">
          {error}
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setLoading(true);
              setError("");
              setRefresh((value) => value + 1);
            }}
          >
            Ricarica grafo
          </button>
        </div>
      ) : null}
      {notice ? (
        <p role="status" className="save-state saved">
          {notice}
        </p>
      ) : null}
      {form ? (
        <RelationshipForm
          key={form === "new" ? "new" : `${form.id}-${form.revision}`}
          pages={pages}
          sessions={sessions}
          initial={form === "new" ? undefined : form}
          busy={pending || busy}
          onSave={save}
          onCancel={() => setForm(null)}
        />
      ) : null}
      <div className="graph-legend" aria-label="Legenda del grafo">
        <span>
          <i className="mention-line" aria-hidden="true" />
          Menzione: tratteggiata, dalla fonte alla pagina
        </span>
        <span>
          <i className="assertion-line" aria-hidden="true" />
          Relazione dichiarata: continua, etichetta e certezza
        </span>
        <span>
          Cerchio: personaggi e pagine · Esagono: luogo · Rombo: oggetto o
          pagina mancante · Rettangolo: sessione
        </span>
      </div>
      {loading ? (
        <p role="status">Caricamento grafo…</p>
      ) : data ? (
        <>
          <p role="status" className="graph-count">
            {data.nodes.length} nodi e {data.edges.length} collegamenti nella
            vista.
          </p>
          {data.truncated ? (
            <p className="graph-limit" role="status">
              Vista limitata a 150 nodi e 400 collegamenti. I filtri
              corrispondono a {data.totalNodes} nodi e {data.totalEdges}{" "}
              collegamenti: scegli un nodo centrale o restringi la ricerca.
            </p>
          ) : null}
          <div className="graph-layout">
            <div>
              {data.nodes.length ? (
                <Suspense
                  fallback={<p role="status">Apertura visualizzazione…</p>}
                >
                  <GraphCanvas
                    data={data}
                    focusId={query.focusId}
                    onNode={(node) => {
                      setSelectedNode(node);
                      setEdgeId(null);
                      setRelationship(null);
                    }}
                    onEdge={(selected) => {
                      void selectEdge(selected);
                    }}
                  />
                </Suspense>
              ) : (
                <div className="empty">
                  <h4>Nessun nodo con questi filtri</h4>
                  <p>
                    Crea pagine nel Codex o azzera i filtri per esplorare la
                    campagna.
                  </p>
                </div>
              )}
              {!data.edges.length && data.nodes.length ? (
                <p className="editor-hint">
                  Nessun collegamento con questi filtri. Le relazioni si
                  aggiungono esplicitamente; non vengono dedotte dalle note.
                </p>
              ) : null}
            </div>
            <aside className="graph-detail" aria-label="Dettaglio collegamento">
              <h4>Dettagli della voce</h4>
              {selectedNode ? (
                <div className="graph-node-detail">
                  <NodePortrait
                    key={selectedNode.id}
                    campaignId={campaignId}
                    pageId={selectedNode.entityId}
                    kind={selectedNode.kind}
                  />
                  <h4>{selectedNode.title}</h4>
                  <span className="node-kind">
                    {selectedNode.kind === "session"
                      ? "Sessione"
                      : selectedNode.kind === "missing"
                        ? "Pagina mancante"
                        : pageKinds[selectedNode.kind]}
                  </span>
                  <p>
                    {pagePreview(
                      pages.find((p) => p.id === selectedNode.entityId),
                    ) ||
                      "Apri la voce per leggere gli appunti. Seleziona un collegamento per consultarne fonte e certezza."}
                  </p>
                  <div className="node-connections">
                    <h5>Collegamenti principali</h5>
                    {data.edges
                      .filter(
                        (e) =>
                          e.source === selectedNode.id ||
                          e.target === selectedNode.id,
                      )
                      .slice(0, 8)
                      .map((e) => (
                        <button
                          key={e.id}
                          disabled={disabled || relationLoading}
                          onClick={() => void selectEdge(e)}
                        >
                          <span>
                            {nodeTitle(
                              e.source === selectedNode.id
                                ? e.target
                                : e.source,
                            )}
                          </span>
                          <em>{e.kind === "mention" ? "menzione" : e.label}</em>
                        </button>
                      ))}
                    {!data.edges.some(
                      (e) =>
                        e.source === selectedNode.id ||
                        e.target === selectedNode.id,
                    ) ? (
                      <p>Nessun collegamento in questa vista.</p>
                    ) : null}
                  </div>
                  <div className="actions">
                    <button
                      disabled={disabled}
                      onClick={() => onNode(selectedNode)}
                    >
                      Apri la voce
                    </button>
                    <button
                      disabled={disabled}
                      onClick={() =>
                        apply({
                          ...query,
                          focusId: selectedNode.id,
                          search: "",
                        })
                      }
                    >
                      Esplora i collegamenti
                    </button>
                  </div>
                </div>
              ) : relationLoading ? (
                <p role="status">Apertura relazione…</p>
              ) : relationship ? (
                <>
                  <h4>Relazione dichiarata</h4>
                  <p className="relation-statement">
                    {pages.find((p) => p.id === relationship.fromPageId)?.title}{" "}
                    <strong>{relationship.label}</strong>{" "}
                    {pages.find((p) => p.id === relationship.toPageId)?.title}
                  </p>
                  <p className={`certainty ${relationship.certainty}`}>
                    {certainties[relationship.certainty]}
                  </p>
                  {relationship.evidence ? (
                    <>
                      <h5>Evidenza registrata</h5>
                      <p className="preserve-lines">{relationship.evidence}</p>
                    </>
                  ) : null}
                  {relationship.notes ? (
                    <>
                      <h5>Note</h5>
                      <p className="preserve-lines">{relationship.notes}</p>
                    </>
                  ) : null}
                  {!relationship.sourceAvailable ? (
                    <p role="alert">
                      Il blocco della fonte non è più disponibile. L'evidenza
                      registrata è conservata.
                    </p>
                  ) : null}
                  <div className="actions">
                    <button
                      disabled={disabled}
                      onClick={() => setForm(relationship)}
                    >
                      Modifica relazione
                    </button>
                    <button
                      disabled={disabled}
                      onClick={() => setConfirm(true)}
                    >
                      Elimina relazione
                    </button>
                  </div>
                </>
              ) : edge ? (
                <>
                  <h4>Menzione negli appunti</h4>
                  <p>
                    {nodeTitle(edge.source)} menziona {nodeTitle(edge.target)}.
                  </p>
                  <p className="preserve-lines">{edge.preview}</p>
                  <p className="editor-hint">
                    Questa citazione non afferma una relazione tra le pagine.
                    Per rimuoverla modifica gli appunti di origine.
                  </p>
                </>
              ) : (
                <>
                  <h4>Esplora le connessioni</h4>
                  <p>
                    Apri un nodo per leggere la pagina. Seleziona un
                    collegamento per vedere certezza, evidenza e fonte.
                  </p>
                </>
              )}
              {source ? (
                <div className="graph-source">
                  <h5>Fonte: {source.title}</h5>
                  <button
                    disabled={disabled}
                    onClick={() =>
                      onSource(
                        relationship && !relationship.sourceAvailable
                          ? { ...source, blockId: null }
                          : source,
                      )
                    }
                  >
                    {relationship && !relationship.sourceAvailable
                      ? "Apri documento della fonte"
                      : "Apri fonte"}
                  </button>
                </div>
              ) : relationship ? (
                <p className="editor-hint">Nessuna fonte collegata.</p>
              ) : null}
            </aside>
          </div>
          <details className="graph-accessible">
            <summary>Elenco accessibile di nodi e collegamenti</summary>
            <h4>Nodi</h4>
            <ul>
              {data.nodes.map((node) => (
                <li key={node.id}>
                  <button disabled={disabled} onClick={() => onNode(node)}>
                    Apri nodo {node.title}
                  </button>
                  <button
                    disabled={disabled}
                    onClick={() =>
                      apply({
                        ...query,
                        focusId: node.id,
                        search: "",
                        kind: null,
                      })
                    }
                  >
                    Centra {node.title}
                  </button>
                </li>
              ))}
            </ul>
            <h4>Collegamenti</h4>
            <ul>
              {data.edges.map((item) => (
                <li key={item.id}>
                  <button
                    disabled={disabled || relationLoading}
                    onClick={() => {
                      void selectEdge(item);
                    }}
                  >
                    {item.kind === "mention" ? "Menzione" : "Relazione"}:{" "}
                    {nodeTitle(item.source)} → {item.label} →{" "}
                    {nodeTitle(item.target)}
                    {item.certainty ? ` · ${certainties[item.certainty]}` : ""}
                  </button>
                </li>
              ))}
            </ul>
          </details>
        </>
      ) : null}
      {confirm && relationship ? (
        <DeleteConfirmation
          busy={pending}
          error={error}
          onCancel={() => setConfirm(false)}
          onDelete={() => {
            void remove();
          }}
        />
      ) : null}
    </section>
  );
}
function DeleteConfirmation({
  busy,
  error,
  onCancel,
  onDelete,
}: {
  busy: boolean;
  error: string;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const origin = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => {
      if (origin?.isConnected) origin.focus();
    };
  }, []);
  return (
    <div className="dialog-backdrop">
      <div
        ref={dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-relation-title"
        aria-describedby="delete-relation-description"
        className="confirm-dialog"
        onKeyDown={(event) => {
          if (event.key === "Escape" && !busy) {
            event.preventDefault();
            onCancel();
          }
          if (event.key === "Tab") {
            const buttons = Array.from(
              dialog.current?.querySelectorAll<HTMLButtonElement>(
                "button:not(:disabled)",
              ) ?? [],
            );
            if (!buttons.length) {
              event.preventDefault();
              return;
            }
            const first = buttons[0],
              last = buttons[buttons.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <h4 id="delete-relation-title">Eliminare questa relazione?</h4>
        <p id="delete-relation-description">
          La relazione dichiarata verrà rimossa. Pagine, sessioni e menzioni
          negli appunti resteranno conservate.
        </p>
        {error ? (
          <p role="alert" className="error">
            {error}
          </p>
        ) : null}
        <div className="actions">
          <button disabled={busy} onClick={onCancel}>
            Annulla eliminazione
          </button>
          <button disabled={busy} onClick={onDelete}>
            Conferma eliminazione
          </button>
        </div>
      </div>
    </div>
  );
}

function pagePreview(page: KnowledgePage | undefined): string {
  if (!page) return "";
  const texts: string[] = [];
  function visit(value: unknown) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const node = value as Record<string, unknown>;
    if (node.type === "text" && typeof node.text === "string")
      texts.push(node.text);
    if (node.type === "pageMention") {
      const props = node.props as { label?: string };
      if (props.label) texts.push(props.label);
    }
    if (node.content) visit(node.content);
    if (node.children) visit(node.children);
  }
  visit(page.document.blocks);
  return texts.join(" ").slice(0, 340);
}
