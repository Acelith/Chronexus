import { tr } from "../../i18n/store";
import { Text } from "../../i18n/Text";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { SaveGuard } from "../journal/Editor";
import { errorMessage } from "../journal/api";
import {
  knowledgeApi,
  pageKinds,
  type Backlink,
  type KnowledgePage,
  type PageMetadata,
} from "./api";
import { matchingPages } from "./links";
const Editor = lazy(() => import("../journal/Editor"));
const ImageGallery = lazy(() => import("../images/ImageGallery"));
const ImportSource = lazy(() => import("./ImportSource"));

interface Props {
  campaignId: string;
  pages: KnowledgePage[];
  selectedId: string | null;
  fallback: string;
  busy: boolean;
  focusBlock?: string;
  externalEpoch?: number;
  register: (guard: SaveGuard | null) => void;
  onSelect: (id: string, label: string) => void;
  onSource: (link: Backlink) => void;
  onSaved: (page: KnowledgePage) => void;
  onCreate: (metadata: PageMetadata) => Promise<KnowledgePage | undefined>;
  onUpdate: (
    id: string,
    metadata: PageMetadata,
    expected: PageMetadata,
  ) => Promise<KnowledgePage | undefined>;
  onRecover: (id: string, title: string) => Promise<KnowledgePage | undefined>;
}
export default function CodexWorkspace(props: Props) {
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<"create" | "edit" | null>(null);
  // One guard for the whole view: unsaved page metadata and the page editor.
  const formDirty = useRef(false);
  const editorGuard = useRef<SaveGuard | null>(null);
  const { register } = props;
  useEffect(() => {
    register({
      dirty: () => formDirty.current || !!editorGuard.current?.dirty(),
      flush: async () => {
        if (formDirty.current)
          throw Error(
            tr(
              "Save or cancel the open changes before changing view or closing Chronexus.",
            ),
          );
        await editorGuard.current?.flush();
      },
    });
    return () => register(null);
  }, [register]);
  const registerEditor = useCallback((guard: SaveGuard | null) => {
    editorGuard.current = guard;
  }, []);
  const onFormDirty = useCallback((dirty: boolean) => {
    formDirty.current = dirty;
  }, []);
  async function submit(save: () => Promise<unknown>) {
    // The form's own changes are being saved: they must not block the save itself.
    formDirty.current = false;
    if (await save()) setForm(null);
    else formDirty.current = true;
  }
  const page = props.pages.find((page) => page.id === props.selectedId);
  const missing = !!props.selectedId && !page;
  return (
    <section className="codex-workspace" aria-label={tr("Codex")}>
      <div className="codex-toolbar">
        <label>
          <Text source={"Search title or alias"} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <button
          className="primary"
          disabled={props.busy}
          onClick={() => setForm("create")}
        >
          <Text source={"New page"} />
        </button>
      </div>
      {form === "create" ? (
        <PageForm
          busy={props.busy}
          onDirty={onFormDirty}
          onCancel={() => setForm(null)}
          onSave={(metadata) => submit(() => props.onCreate(metadata))}
        />
      ) : null}
      <div className="journal-layout">
        <nav className="session-list" aria-label={tr("Codex pages")}>
          {matchingPages(props.pages, query).map((item) => (
            <button
              key={item.id}
              disabled={props.busy}
              aria-current={item.id === props.selectedId ? "page" : undefined}
              onClick={() => {
                setForm(null);
                props.onSelect(item.id, item.title);
              }}
            >
              <span>
                {pageKinds[item.kind]}
                {item.status === "stub" ? tr(" · Draft") : ""}
              </span>
              <strong>{item.title}</strong>
              {item.aliases.length ? (
                <span>
                  <Text source={"Aliases: "} />
                  {item.aliases.join(", ")}
                </span>
              ) : null}
            </button>
          ))}
          {!matchingPages(props.pages, query).length ? (
            <p className="editor-hint">
              {props.pages.length
                ? tr("No page matches the search.")
                : tr(
                    "The Codex is empty. Create a page or type [[ in the journal.",
                  )}
            </p>
          ) : null}
        </nav>
        <article className="journal-page">
          {page ? (
            <>
              <header className="note-header">
                <p>
                  {pageKinds[page.kind]} ·{" "}
                  {page.status === "stub"
                    ? tr("Draft to complete")
                    : tr("Active page")}
                </p>
                <h3>{page.title}</h3>
                {page.aliases.length ? (
                  <p>
                    <Text source={"Aliases: "} />
                    {page.aliases.join(", ")}
                  </p>
                ) : null}
                <button disabled={props.busy} onClick={() => setForm("edit")}>
                  <Text source={"Edit page"} />
                </button>
              </header>
              {form === "edit" ? (
                <PageForm
                  key={page.id}
                  initial={page}
                  busy={props.busy}
                  onDirty={onFormDirty}
                  onCancel={() => setForm(null)}
                  onSave={(metadata, expected) =>
                    submit(async () =>
                      expected
                        ? props.onUpdate(page.id, metadata, expected)
                        : undefined,
                    )
                  }
                />
              ) : null}
              <Suspense
                fallback={
                  <p role="status">
                    <Text source={"Opening editor…"} />
                  </p>
                }
              >
                <Editor
                  key={`${page.id}:${props.externalEpoch ?? 0}`}
                  page={page}
                  register={registerEditor}
                  onSaved={props.onSaved}
                  focusBlock={props.focusBlock}
                  disabled={props.busy}
                />
              </Suspense>
              <Suspense
                fallback={
                  <p role="status">
                    <Text source={"Opening images…"} />
                  </p>
                }
              >
                <ImageGallery
                  key={page.id}
                  campaignId={props.campaignId}
                  target={{ kind: "page", id: page.id }}
                  busy={props.busy}
                />
              </Suspense>
              {page.document.importedFrom === "logseq" ? (
                <Suspense fallback={null}>
                  <ImportSource
                    key={page.id}
                    campaignId={props.campaignId}
                    kind="page"
                    id={page.id}
                  />
                </Suspense>
              ) : null}
              <Backlinks
                key={`${page.id}-${page.revision}`}
                campaignId={props.campaignId}
                id={page.id}
                onOpen={props.onSource}
                busy={props.busy}
              />
            </>
          ) : missing ? (
            <MissingPage
              key={props.selectedId}
              label={props.fallback}
              busy={props.busy}
              onRecover={(title) => props.onRecover(props.selectedId!, title)}
            />
          ) : (
            <section className="empty">
              <h3>
                <Text source={"Your campaign's knowledge"} />
              </h3>
              <p>
                <Text
                  source={
                    "Choose a page or create a new one. Links keep their source, without turning a suspicion into a fact."
                  }
                />
              </p>
            </section>
          )}
        </article>
      </div>
    </section>
  );
}

function PageForm({
  initial,
  busy,
  onDirty,
  onSave,
  onCancel,
}: {
  initial?: KnowledgePage;
  busy: boolean;
  onDirty: (dirty: boolean) => void;
  onSave: (metadata: PageMetadata, expected?: PageMetadata) => Promise<void>;
  onCancel: () => void;
}) {
  const snapshot = useRef(
    initial
      ? {
          title: initial.title,
          kind: initial.kind,
          status: initial.status,
          aliases: [...initial.aliases],
        }
      : undefined,
  );
  const [title, setTitle] = useState(initial?.title ?? "");
  const [kind, setKind] = useState<PageMetadata["kind"]>(
    initial?.kind ?? "note",
  );
  const [status, setStatus] = useState<PageMetadata["status"]>(
    initial?.status ?? "active",
  );
  const [aliases, setAliases] = useState(initial?.aliases.join("\n") ?? "");
  const changed =
    title !== (initial?.title ?? "") ||
    kind !== (initial?.kind ?? "note") ||
    status !== (initial?.status ?? "active") ||
    aliases !== (initial?.aliases.join("\n") ?? "");
  useEffect(() => {
    onDirty(changed);
  }, [changed, onDirty]);
  // Closing the form (save, cancel or another page) releases the guard.
  useEffect(() => () => onDirty(false), [onDirty]);
  return (
    <form
      className="entry-form"
      aria-label={initial ? tr("Edit page") : tr("New page")}
      onSubmit={(event) => {
        event.preventDefault();
        void onSave(
          {
            title,
            kind,
            status,
            aliases: aliases
              .split("\n")
              .map((alias) => alias.trim())
              .filter(Boolean),
          },
          snapshot.current,
        );
      }}
    >
      <label>
        <Text source={"Page title"} />
        <input
          autoFocus
          required
          maxLength={200}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          disabled={busy}
        />
      </label>
      <div className="form-fields">
        <label>
          <Text source={"Type"} />
          <select
            aria-label={tr("Type")}
            value={kind}
            onChange={(event) =>
              setKind(event.target.value as PageMetadata["kind"])
            }
            disabled={busy}
          >
            {Object.entries(pageKinds).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <Text source={"Status"} />
          <select
            aria-label={tr("Status")}
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as PageMetadata["status"])
            }
            disabled={busy}
          >
            <option value="active">{tr("Activate")}</option>
            <option value="stub">{tr("Draft")}</option>
          </select>
        </label>
      </div>
      <label>
        <Text source={"Aliases (one per line, up to 20)"} />
        <textarea
          rows={3}
          value={aliases}
          onChange={(event) => setAliases(event.target.value)}
          disabled={busy}
        />
      </label>
      <p className="editor-hint">
        <Text
          source={
            "Shared aliases are shown as separate results: always choose the right page."
          }
        />
      </p>
      <div className="actions">
        <button className="primary" disabled={busy || !title.trim()}>
          {initial ? tr("Save page") : tr("Create page")}
        </button>
        <button type="button" disabled={busy} onClick={onCancel}>
          <Text source={"Cancel"} />
        </button>
      </div>
    </form>
  );
}
function MissingPage({
  label,
  busy,
  onRecover,
}: {
  label: string;
  busy: boolean;
  onRecover: (title: string) => Promise<KnowledgePage | undefined>;
}) {
  const [title, setTitle] = useState(label);
  return (
    <section className="empty">
      <h3>
        <Text source={"Missing page"} />
      </h3>
      <p>
        <Text
          source={
            "The reference keeps its ID. You can recover a draft without changing the links in your notes. If the title is already used, choose a different name."
          }
        />
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void onRecover(title);
        }}
      >
        <label>
          <Text source={"Title to recover"} />
          <input
            required
            maxLength={200}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <button disabled={busy || !title.trim()}>
          <Text source={"Recover draft"} />
        </button>
      </form>
    </section>
  );
}
function Backlinks({
  campaignId,
  id,
  onOpen,
  busy,
}: {
  campaignId: string;
  id: string;
  onOpen: (link: Backlink) => void;
  busy: boolean;
}) {
  const [links, setLinks] = useState<Backlink[] | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    knowledgeApi
      .backlinks(campaignId, id)
      .then((links) => {
        if (active) {
          setLinks(links);
          setError("");
        }
      })
      .catch((reason) => {
        if (active) setError(errorMessage(reason));
      });
    return () => {
      active = false;
    };
  }, [campaignId, id, retry]);
  const groups = new Map<string, Backlink[]>();
  for (const link of links ?? []) {
    const key = `${link.sourceKind}:${link.sourceId}`;
    groups.set(key, [...(groups.get(key) ?? []), link]);
  }
  return (
    <section className="backlinks" aria-label={tr("References to this page")}>
      <h4>
        <Text source={"References to this page"} />
      </h4>
      {error ? (
        <div role="alert" className="error">
          {error}
          <button onClick={() => setRetry((value) => value + 1)}>
            <Text source={"Retry backlinks"} />
          </button>
        </div>
      ) : links === null ? (
        <p role="status">
          <Text source={"Loading references…"} />
        </p>
      ) : !links.length ? (
        <p className="editor-hint">
          <Text
            source={
              "No session or page mentions it yet. Type [[ and select it in your notes."
            }
          />
        </p>
      ) : null}
      {Array.from(groups, ([key, items]) => (
        <div key={key}>
          <h5>
            {items[0].sourceKind === "session"
              ? tr("Session {0}", [items[0].sequence])
              : tr("Page")}
            : {items[0].sourceTitle}
          </h5>
          {items.map((link) => (
            <button
              key={link.blockId}
              disabled={busy}
              onClick={() => onOpen(link)}
            >
              <span>{link.preview || tr("Block without text")}</span>
              <small>
                <Text source={"Open the source block"} />
              </small>
            </button>
          ))}
        </div>
      ))}
    </section>
  );
}
