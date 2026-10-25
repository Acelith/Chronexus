import { Text } from "../../i18n/Text";
import { tr } from "../../i18n/store";
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
            tr(
              "Save or cancel the open relationship before changing view or closing Chronexus.",
            ),
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
    data?.nodes.find((node) => node.id === id)?.title ?? tr("Page not visible");
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
      setNotice(tr("Relationship saved on the computer."));
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
      setNotice(tr("Relationship deleted. Mentions in notes are kept."));
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
              tr("Session"))
            : (pages.find((p) => p.id === relationship.sourceId)?.title ??
              tr("Page")),
      }
    : edge?.provenance;
  return (
    <section className="graph-workspace" aria-label={tr("Campaign graph")}>
      <div className="graph-heading">
        <div>
          <h3>
            <Text source={"Campaign connections"} />
          </h3>
          <p className="editor-hint">
            <Text
              source={
                "Explore how people, places, items and events intertwine in the story."
              }
            />
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
          <Text source={"New relationship"} />
        </button>
      </div>
      <div className="graph-filter-details">
        <form
          className="graph-filters"
          aria-label={tr("Graph filters")}
          onSubmit={(event) => {
            event.preventDefault();
            apply(draft);
          }}
        >
          <fieldset disabled={disabled}>
            <label>
              <Text source={"Search nodes"} />
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
              <Text source={"Node type"} />
              <select
                aria-label={tr("Node type")}
                value={draft.kind ?? ""}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    kind: (event.target.value as GraphNode["kind"]) || null,
                  })
                }
              >
                <option value="">{tr("All types")}</option>
                {Object.entries(pageKinds).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
                <option value="session">{tr("Session")}</option>
                <option value="missing">{tr("Missing page")}</option>
              </select>
            </label>
            <label>
              <Text source={"Links"} />
              <select
                aria-label={tr("Links")}
                value={draft.edgeKind}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    edgeKind: event.target.value as GraphQuery["edgeKind"],
                  })
                }
              >
                <option value="all">{tr("Mentions and relationships")}</option>
                <option value="mentions">{tr("Mentions only")}</option>
                <option value="assertions">
                  {tr("Declared relationships only")}
                </option>
              </select>
            </label>
            <details className="graph-advanced">
              <summary>
                <Text source={"More filters"} />
              </summary>
              <div>
                <label>
                  <Text source={"Relationship certainty"} />
                  <select
                    aria-label={tr("Relationship certainty")}
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
                    <option value="">{tr("All certainties")}</option>
                    {Object.entries(certainties).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <Text source={"Session source"} />
                  <select
                    aria-label={tr("Session source")}
                    value={draft.sessionId ?? ""}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        sessionId: event.target.value || null,
                      })
                    }
                  >
                    <option value="">{tr("All sessions")}</option>
                    {sessions.map((session) => (
                      <option key={session.id} value={session.id}>
                        {tr("Session ")}
                        {session.sequence}: {session.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <Text source={"Central node"} />
                  <select
                    aria-label={tr("Central node")}
                    value={draft.focusId ?? ""}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        focusId: event.target.value || null,
                      })
                    }
                  >
                    <option value="">{tr("No center")}</option>
                    {pages.map((page) => (
                      <option key={page.id} value={`page:${page.id}`}>
                        {page.title}
                      </option>
                    ))}
                    {sessions.map((session) => (
                      <option key={session.id} value={`session:${session.id}`}>
                        {tr("Session ")}
                        {session.sequence}: {session.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <Text source={"Depth"} />
                  <select
                    aria-label={tr("Depth")}
                    value={draft.depth}
                    disabled={!draft.focusId || disabled}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        depth: Number(event.target.value) as 1 | 2,
                      })
                    }
                  >
                    <option value={1}>
                      <Text source={"1 passaggio"} />
                    </option>
                    <option value={2}>
                      <Text source={"2 passaggi"} />
                    </option>
                  </select>
                </label>
              </div>
            </details>
            <div className="actions">
              <button className="primary">
                <Text source={"Apply filters"} />
              </button>
              <button type="button" onClick={() => apply(defaultQuery)}>
                <Text source={"Clear filters"} />
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
            <Text source={"Reload graph"} />
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
      <div className="graph-legend" aria-label={tr("Graph legend")}>
        <span>
          <i className="mention-line" aria-hidden="true" />
          <Text source={"Mention: dashed, from the source to the page"} />
        </span>
        <span>
          <i className="assertion-line" aria-hidden="true" />
          <Text source={"Declared relationship: solid, label and certainty"} />
        </span>
        <span>
          <Text
            source={
              "Circle: characters and pages · Hexagon: place · Diamond: item or missing page · Rectangle: session"
            }
          />
        </span>
      </div>
      {loading ? (
        <p role="status">
          <Text source={"Loading graph…"} />
        </p>
      ) : data ? (
        <>
          <p role="status" className="graph-count">
            {data.nodes.length} <Text source={" nodes and "} />
            {data.edges.length} <Text source={" links in the view."} />
          </p>
          {data.truncated ? (
            <p className="graph-limit" role="status">
              <Text
                source={
                  "View limited to 150 nodes and 400 links. The filters match "
                }
              />
              {data.totalNodes} <Text source={" nodes and "} />
              {data.totalEdges}{" "}
              <Text
                source={"links: choose a central node or narrow the search."}
              />
            </p>
          ) : null}
          <div className="graph-layout">
            <div>
              {data.nodes.length ? (
                <Suspense
                  fallback={
                    <p role="status">
                      <Text source={"Opening view…"} />
                    </p>
                  }
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
                  <h4>
                    <Text source={"No nodes with these filters"} />
                  </h4>
                  <p>
                    <Text
                      source={
                        "Create pages in the Codex or clear the filters to explore the campaign."
                      }
                    />
                  </p>
                </div>
              )}
              {!data.edges.length && data.nodes.length ? (
                <p className="editor-hint">
                  <Text
                    source={
                      "No links with these filters. Relationships are added explicitly; they are never inferred from notes."
                    }
                  />
                </p>
              ) : null}
            </div>
            <aside className="graph-detail" aria-label={tr("Link details")}>
              <h4>
                <Text source={"Entry details"} />
              </h4>
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
                      ? tr("Session")
                      : selectedNode.kind === "missing"
                        ? tr("Missing page")
                        : pageKinds[selectedNode.kind]}
                  </span>
                  <p>
                    {pagePreview(
                      pages.find((p) => p.id === selectedNode.entityId),
                    ) ||
                      tr(
                        "Open the entry to read the notes. Select a link to see its source and certainty.",
                      )}
                  </p>
                  <div className="node-connections">
                    <h5>
                      <Text source={"Main links"} />
                    </h5>
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
                      <p>
                        <Text source={"No links in this view."} />
                      </p>
                    ) : null}
                  </div>
                  <div className="actions">
                    <button
                      disabled={disabled}
                      onClick={() => onNode(selectedNode)}
                    >
                      <Text source={"Open the entry"} />
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
                      <Text source={"Explore the links"} />
                    </button>
                  </div>
                </div>
              ) : relationLoading ? (
                <p role="status">
                  <Text source={"Opening relationship…"} />
                </p>
              ) : relationship ? (
                <>
                  <h4>
                    <Text source={"Declared relationship"} />
                  </h4>
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
                      <h5>
                        <Text source={"Recorded evidence"} />
                      </h5>
                      <p className="preserve-lines">{relationship.evidence}</p>
                    </>
                  ) : null}
                  {relationship.notes ? (
                    <>
                      <h5>
                        <Text source={"Notes"} />
                      </h5>
                      <p className="preserve-lines">{relationship.notes}</p>
                    </>
                  ) : null}
                  {!relationship.sourceAvailable ? (
                    <p role="alert">
                      <Text
                        source={
                          "The source block is no longer available. The recorded evidence is kept."
                        }
                      />
                    </p>
                  ) : null}
                  <div className="actions">
                    <button
                      disabled={disabled}
                      onClick={() => setForm(relationship)}
                    >
                      <Text source={"Edit relationship"} />
                    </button>
                    <button
                      disabled={disabled}
                      onClick={() => setConfirm(true)}
                    >
                      <Text source={"Delete relationship"} />
                    </button>
                  </div>
                </>
              ) : edge ? (
                <>
                  <h4>
                    <Text source={"Mention in notes"} />
                  </h4>
                  <p>
                    {nodeTitle(edge.source)} <Text source={" mentions "} />
                    {nodeTitle(edge.target)}.
                  </p>
                  <p className="preserve-lines">{edge.preview}</p>
                  <p className="editor-hint">
                    <Text
                      source={
                        "This quote does not assert a relationship between pages. To remove it, edit the source notes."
                      }
                    />
                  </p>
                </>
              ) : (
                <>
                  <h4>
                    <Text source={"Explore the connections"} />
                  </h4>
                  <p>
                    <Text
                      source={
                        "Open a node to read the page. Select a link to see certainty, evidence and source."
                      }
                    />
                  </p>
                </>
              )}
              {source ? (
                <div className="graph-source">
                  <h5>
                    <Text source={"Source: "} />
                    {source.title}
                  </h5>
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
                      ? tr("Open source document")
                      : tr("Open source")}
                  </button>
                </div>
              ) : relationship ? (
                <p className="editor-hint">
                  <Text source={"No linked source."} />
                </p>
              ) : null}
            </aside>
          </div>
          <details className="graph-accessible">
            <summary>
              <Text source={"Accessible list of nodes and links"} />
            </summary>
            <h4>
              <Text source={"Nodes"} />
            </h4>
            <ul>
              {data.nodes.map((node) => (
                <li key={node.id}>
                  <button disabled={disabled} onClick={() => onNode(node)}>
                    <Text source={"Open node "} />
                    {node.title}
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
                    <Text source={"Center "} />
                    {node.title}
                  </button>
                </li>
              ))}
            </ul>
            <h4>
              <Text source={"Links"} />
            </h4>
            <ul>
              {data.edges.map((item) => (
                <li key={item.id}>
                  <button
                    disabled={disabled || relationLoading}
                    onClick={() => {
                      void selectEdge(item);
                    }}
                  >
                    {item.kind === "mention"
                      ? tr("Mention")
                      : tr("Relationship")}
                    : {nodeTitle(item.source)} → {item.label} →{" "}
                    {nodeTitle(item.target)}
                    {item.certainty
                      ? tr(" · {0}", [certainties[item.certainty]])
                      : ""}
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
        <h4 id="delete-relation-title">
          <Text source={"Delete this relationship?"} />
        </h4>
        <p id="delete-relation-description">
          <Text
            source={
              "The declared relationship will be removed. Pages, sessions and mentions in notes will be kept."
            }
          />
        </p>
        {error ? (
          <p role="alert" className="error">
            {error}
          </p>
        ) : null}
        <div className="actions">
          <button disabled={busy} onClick={onCancel}>
            <Text source={"Cancel deletion"} />
          </button>
          <button disabled={busy} onClick={onDelete}>
            <Text source={"Confirm deletion"} />
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
