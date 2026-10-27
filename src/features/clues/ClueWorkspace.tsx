import { useEffect, useMemo, useState } from "react";
import { tr } from "../../i18n/store";
import { errorMessage } from "../journal/api";
import type { Session } from "../journal/api";
import type { SaveGuard } from "../journal/Editor";
import type { KnowledgePage } from "../knowledge/api";
import {
  clueApi,
  type Clue,
  type ClueInput,
  type ClueSource,
  type ClueKind,
  type Certainty,
  type ClueStatus,
} from "./api";
import "./clues.css";

const kinds: Record<ClueKind, string> = {
  question: "Question",
  lead: "Lead",
  suspicion: "Suspicion",
  rumour: "Rumour",
};
const certainties: Record<Certainty, string> = {
  confirmed: "Confirmed",
  suspected: "Suspected",
  disproven: "Disproven",
  unknown: "Unknown",
};
const statuses: Record<ClueStatus, string> = {
  open: "Open",
  resolved: "Resolved",
  disproven: "Disproven",
};
const blank = (source?: ClueSource): ClueInput => ({
  kind: "question",
  title: "",
  details: "",
  certainty: "unknown",
  status: "open",
  sources: source ? [source] : [],
  pageIds: [],
  resolutionSessionId: null,
});
const sourceKey = (source: ClueSource) =>
  `${source.kind}:${source.id}:${source.blockId ?? ""}`;

export default function ClueWorkspace({
  campaignId,
  pages,
  sessions,
  initialSource,
  selectedId,
  onSource,
  onPage,
  register,
  busy,
  externalEpoch,
}: {
  campaignId: string;
  pages: KnowledgePage[];
  sessions: Session[];
  initialSource?: ClueSource;
  selectedId?: string;
  onSource: (source: ClueSource) => void;
  onPage: (id: string, title: string) => void;
  register: (guard: SaveGuard | null) => void;
  busy: boolean;
  externalEpoch: number;
}) {
  const [items, setItems] = useState<Clue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Clue | null | undefined>(
    initialSource ? null : undefined,
  );
  const [draft, setDraft] = useState<ClueInput>(() => blank(initialSource));
  const [dirty, setDirty] = useState(!!initialSource);
  const [status, setStatus] = useState("");
  const [pageFilter, setPageFilter] = useState("");
  const [sessionFilter, setSessionFilter] = useState("");
  useEffect(() => {
    register({
      dirty: () => dirty,
      flush: async () => {
        if (dirty)
          throw Error(tr("Save or cancel the clue before changing view."));
      },
    });
    return () => register(null);
  }, [register, dirty]);
  useEffect(() => {
    let active = true;
    clueApi
      .list(campaignId)
      .then((rows) => {
        if (active) {
          setItems(rows);
          setError("");
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
  }, [campaignId, externalEpoch]);
  useEffect(() => {
    if (selectedId)
      document
        .getElementById(`clue-${selectedId}`)
        ?.scrollIntoView({ block: "center" });
  }, [selectedId, items]);
  const filtered = useMemo(
    () =>
      items.filter(
        (item) =>
          (!status || item.status === status) &&
          (!pageFilter || item.pageIds.includes(pageFilter)) &&
          (!sessionFilter ||
            item.sources.some(
              (s) => s.kind === "session" && s.id === sessionFilter,
            ) ||
            item.resolutionSessionId === sessionFilter),
      ),
    [items, status, pageFilter, sessionFilter],
  );
  const update = (patch: Partial<ClueInput>) => {
    setDraft((value) => ({ ...value, ...patch }));
    setDirty(true);
  };
  const begin = (item?: Clue) => {
    setEditing(item ?? null);
    setDraft(
      item
        ? {
            kind: item.kind,
            title: item.title,
            details: item.details,
            certainty: item.certainty,
            status: item.status,
            sources: item.sources,
            pageIds: item.pageIds,
            resolutionSessionId: item.resolutionSessionId,
          }
        : blank(),
    );
    setDirty(false);
    setError("");
  };
  async function save() {
    setSaving(true);
    setError("");
    try {
      const saved = await clueApi.save(campaignId, draft, editing ?? undefined);
      setItems((rows) => [saved, ...rows.filter((row) => row.id !== saved.id)]);
      setEditing(undefined);
      setDirty(false);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }
  async function remove(item: Clue) {
    if (
      !window.confirm(tr("Delete this clue? Its source notes stay unchanged."))
    )
      return;
    setSaving(true);
    setError("");
    try {
      await clueApi.delete(campaignId, item);
      setItems((rows) => rows.filter((row) => row.id !== item.id));
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }
  function sourceTitle(source: ClueSource) {
    return source.kind === "session"
      ? (sessions.find((s) => s.id === source.id)?.title ??
          tr("Missing session"))
      : (pages.find((p) => p.id === source.id)?.title ?? tr("Missing page"));
  }
  return (
    <section className="clue-workspace" aria-label={tr("Clue board")}>
      <header className="clue-heading">
        <div>
          <p className="eyebrow">{tr("Campaign evidence")}</p>
          <h2>{tr("Clue board")}</h2>
          <p>
            {tr(
              "Questions and leads remain player notes. Resolving one never changes the source or asserts a world fact.",
            )}
          </p>
        </div>
        <button
          className="primary"
          disabled={busy || saving || editing !== undefined}
          onClick={() => begin()}
        >
          {tr("New clue")}
        </button>
      </header>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {loading && <p role="status">{tr("Loading clues…")}</p>}
      {editing !== undefined && (
        <form
          className="clue-form"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <h3>{editing ? tr("Edit clue") : tr("New clue")}</h3>
          <div className="clue-form-grid">
            <label>
              {tr("Type")}
              <select
                value={draft.kind}
                onChange={(e) => update({ kind: e.target.value as ClueKind })}
              >
                {Object.entries(kinds).map(([key, label]) => (
                  <option key={key} value={key}>
                    {tr(label)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {tr("Certainty")}
              <select
                value={draft.certainty}
                onChange={(e) =>
                  update({
                    certainty: e.target.value as Certainty,
                    status:
                      draft.status === "disproven" &&
                      e.target.value !== "disproven"
                        ? "open"
                        : draft.status,
                  })
                }
              >
                {Object.entries(certainties).map(([key, label]) => (
                  <option key={key} value={key}>
                    {tr(label)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {tr("Status")}
              <select
                value={draft.status}
                onChange={(e) =>
                  update({
                    status: e.target.value as ClueStatus,
                    certainty:
                      e.target.value === "disproven"
                        ? "disproven"
                        : draft.certainty,
                    resolutionSessionId:
                      e.target.value === "open"
                        ? null
                        : draft.resolutionSessionId,
                  })
                }
              >
                {Object.entries(statuses).map(([key, label]) => (
                  <option key={key} value={key}>
                    {tr(label)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            {tr("Clue title")}
            <input
              required
              maxLength={200}
              value={draft.title}
              onChange={(e) => update({ title: e.target.value })}
            />
          </label>
          <label>
            {tr("Notes")}
            <textarea
              dir="auto"
              maxLength={8000}
              rows={4}
              value={draft.details}
              onChange={(e) => update({ details: e.target.value })}
            />
          </label>
          <fieldset>
            <legend>{tr("Linked Codex pages")}</legend>
            <div className="clue-checkboxes">
              {pages.map((page) => (
                <label key={page.id}>
                  <input
                    type="checkbox"
                    checked={draft.pageIds.includes(page.id)}
                    onChange={(e) =>
                      update({
                        pageIds: e.target.checked
                          ? [...draft.pageIds, page.id]
                          : draft.pageIds.filter((id) => id !== page.id),
                      })
                    }
                  />
                  {page.title}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>{tr("Sources")}</legend>
            <div className="clue-checkboxes">
              {[
                ...sessions.map((s) => ({
                  kind: "session" as const,
                  id: s.id,
                  blockId: null,
                })),
                ...pages.map((p) => ({
                  kind: "page" as const,
                  id: p.id,
                  blockId: null,
                })),
              ].map((source) => (
                <label key={sourceKey(source)}>
                  <input
                    type="checkbox"
                    checked={draft.sources.some(
                      (s) => sourceKey(s) === sourceKey(source),
                    )}
                    onChange={(e) =>
                      update({
                        sources: e.target.checked
                          ? [...draft.sources, source]
                          : draft.sources.filter(
                              (s) => sourceKey(s) !== sourceKey(source),
                            ),
                      })
                    }
                  />
                  {sourceTitle(source)}
                </label>
              ))}
            </div>
            {draft.sources
              .filter((s) => s.blockId)
              .map((source) => (
                <p key={sourceKey(source)}>
                  {sourceTitle(source)} · {tr("Selected block")}{" "}
                  <button
                    type="button"
                    onClick={() =>
                      update({
                        sources: draft.sources.filter(
                          (s) => sourceKey(s) !== sourceKey(source),
                        ),
                      })
                    }
                  >
                    {tr("Remove")}
                  </button>
                </p>
              ))}
          </fieldset>
          {draft.status !== "open" && (
            <label>
              {tr("Resolution session (optional)")}
              <select
                value={draft.resolutionSessionId ?? ""}
                onChange={(e) =>
                  update({ resolutionSessionId: e.target.value || null })
                }
              >
                <option value="">{tr("No session selected")}</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.sequence}. {s.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="clue-actions">
            <button className="primary" type="submit" disabled={busy || saving}>
              {saving ? tr("Saving…") : tr("Save clue")}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setEditing(undefined);
                setDirty(false);
              }}
            >
              {tr("Cancel")}
            </button>
          </div>
        </form>
      )}
      <div className="clue-filters">
        <label>
          {tr("Filter by status")}
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{tr("All statuses")}</option>
            {Object.entries(statuses).map(([key, label]) => (
              <option key={key} value={key}>
                {tr(label)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {tr("Filter by page")}
          <select
            value={pageFilter}
            onChange={(e) => setPageFilter(e.target.value)}
          >
            <option value="">{tr("All pages")}</option>
            {pages.map((page) => (
              <option key={page.id} value={page.id}>
                {page.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          {tr("Filter by session")}
          <select
            value={sessionFilter}
            onChange={(e) => setSessionFilter(e.target.value)}
          >
            <option value="">{tr("All sessions")}</option>
            {sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.sequence}. {session.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!loading && !items.length && (
        <p className="clue-empty">
          {tr(
            "No clues yet. Add a question or create one from a selected note block.",
          )}
        </p>
      )}
      {!loading && !!items.length && !filtered.length && (
        <p className="clue-empty">{tr("No clues match these filters.")}</p>
      )}
      <div className="clue-list">
        {filtered.map((item) => (
          <article className="clue-card" id={`clue-${item.id}`} key={item.id}>
            <div className="clue-card-head">
              <div>
                <span>
                  {tr(kinds[item.kind])} · {tr(statuses[item.status])} ·{" "}
                  {tr(certainties[item.certainty])}
                </span>
                <h3 dir="auto">{item.title}</h3>
              </div>
              <div className="clue-actions">
                <button
                  disabled={busy || saving || editing !== undefined}
                  onClick={() => begin(item)}
                >
                  {tr("Edit")}
                </button>
                <button
                  disabled={busy || saving || editing !== undefined}
                  onClick={() => void remove(item)}
                >
                  {tr("Delete")}
                </button>
              </div>
            </div>
            {item.details && (
              <p className="clue-details" dir="auto">
                {item.details}
              </p>
            )}
            {!!item.pageIds.length && (
              <div className="clue-links">
                <strong>{tr("Linked pages")}</strong>
                {item.pageIds.map((id) => (
                  <button
                    key={id}
                    onClick={() =>
                      onPage(id, pages.find((p) => p.id === id)?.title ?? "")
                    }
                  >
                    {pages.find((p) => p.id === id)?.title ??
                      tr("Missing page")}
                  </button>
                ))}
              </div>
            )}
            {!!item.sources.length && (
              <div className="clue-links">
                <strong>{tr("Sources")}</strong>
                {item.sources.map((source) => (
                  <button
                    key={sourceKey(source)}
                    onClick={() => onSource(source)}
                  >
                    {sourceTitle(source)}
                    {source.blockId ? ` · ${tr("Selected block")}` : ""}
                  </button>
                ))}
              </div>
            )}
            {item.resolutionSessionId && (
              <p>
                {tr("Resolution session")}:{" "}
                <button
                  onClick={() =>
                    onSource({
                      kind: "session",
                      id: item.resolutionSessionId!,
                      blockId: null,
                    })
                  }
                >
                  {sessions.find((s) => s.id === item.resolutionSessionId)
                    ?.title ?? tr("Missing session")}
                </button>
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
