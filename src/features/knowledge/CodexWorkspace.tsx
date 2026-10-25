import { tr } from "../../i18n/store";
import { Text } from "../../i18n/Text";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
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
  const page = props.pages.find((page) => page.id === props.selectedId);
  const missing = !!props.selectedId && !page;
  return (
    <section className="codex-workspace" aria-label={tr("Codex")}>
      <div className="codex-toolbar">
        <label>
          <Text source={"Cerca titolo o alias"} />
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
          <Text source={"Nuova pagina"} />
        </button>
      </div>
      {form === "create" ? (
        <PageForm
          busy={props.busy}
          onCancel={() => setForm(null)}
          onSave={async (metadata) => {
            if (await props.onCreate(metadata)) setForm(null);
          }}
        />
      ) : null}
      <div className="journal-layout">
        <nav className="session-list" aria-label={tr("Pagine del Codex")}>
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
                {item.status === "stub" ? tr(" · Bozza") : ""}
              </span>
              <strong>{item.title}</strong>
              {item.aliases.length ? (
                <span>
                  <Text source={"Alias: "} />
                  {item.aliases.join(", ")}
                </span>
              ) : null}
            </button>
          ))}
          {!matchingPages(props.pages, query).length ? (
            <p className="editor-hint">
              {props.pages.length
                ? tr("Nessuna pagina corrisponde alla ricerca.")
                : tr(
                    "Il Codex è vuoto. Crea una pagina o scrivi [[ nel diario.",
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
                    ? tr("Bozza da completare")
                    : tr("Pagina attiva")}
                </p>
                <h3>{page.title}</h3>
                {page.aliases.length ? (
                  <p>
                    <Text source={"Alias: "} />
                    {page.aliases.join(", ")}
                  </p>
                ) : null}
                <button disabled={props.busy} onClick={() => setForm("edit")}>
                  <Text source={"Modifica pagina"} />
                </button>
              </header>
              {form === "edit" ? (
                <PageForm
                  key={page.id}
                  initial={page}
                  busy={props.busy}
                  onCancel={() => setForm(null)}
                  onSave={async (metadata, expected) => {
                    if (
                      expected &&
                      (await props.onUpdate(page.id, metadata, expected))
                    )
                      setForm(null);
                  }}
                />
              ) : null}
              <Suspense
                fallback={
                  <p role="status">
                    <Text source={"Apertura editor…"} />
                  </p>
                }
              >
                <Editor
                  key={`${page.id}:${props.externalEpoch ?? 0}`}
                  page={page}
                  register={props.register}
                  onSaved={props.onSaved}
                  focusBlock={props.focusBlock}
                  disabled={props.busy}
                />
              </Suspense>
              <Suspense
                fallback={
                  <p role="status">
                    <Text source={"Apertura immagini…"} />
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
                <Text source={"Le conoscenze della tua campagna"} />
              </h3>
              <p>
                <Text
                  source={
                    "Scegli una pagina o creane una nuova. I collegamenti conservano la fonte, senza trasformare un sospetto in un fatto."
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
  onSave,
  onCancel,
}: {
  initial?: KnowledgePage;
  busy: boolean;
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
  return (
    <form
      className="entry-form"
      aria-label={initial ? tr("Modifica pagina") : tr("Nuova pagina")}
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
        <Text source={"Titolo della pagina"} />
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
          <Text source={"Tipo"} />
          <select
            aria-label={tr("Tipo")}
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
          <Text source={"Stato"} />
          <select
            aria-label={tr("Stato")}
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as PageMetadata["status"])
            }
            disabled={busy}
          >
            <option value="active">{tr("Attiva")}</option>
            <option value="stub">{tr("Bozza")}</option>
          </select>
        </label>
      </div>
      <label>
        <Text source={"Alias (uno per riga, massimo 20)"} />
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
            "Gli alias condivisi vengono mostrati come risultati distinti: scegli sempre la pagina corretta."
          }
        />
      </p>
      <div className="actions">
        <button className="primary" disabled={busy || !title.trim()}>
          {initial ? tr("Salva pagina") : tr("Crea pagina")}
        </button>
        <button type="button" disabled={busy} onClick={onCancel}>
          <Text source={"Annulla"} />
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
        <Text source={"Pagina mancante"} />
      </h3>
      <p>
        <Text
          source={
            "Il riferimento conserva il suo ID. Puoi recuperare una bozza senza cambiare i collegamenti negli appunti. Se il titolo è già usato, scegli un nome distinto."
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
          <Text source={"Titolo da recuperare"} />
          <input
            required
            maxLength={200}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <button disabled={busy || !title.trim()}>
          <Text source={"Recupera bozza"} />
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
    <section
      className="backlinks"
      aria-label={tr("Riferimenti a questa pagina")}
    >
      <h4>
        <Text source={"Riferimenti a questa pagina"} />
      </h4>
      {error ? (
        <div role="alert" className="error">
          {error}
          <button onClick={() => setRetry((value) => value + 1)}>
            <Text source={"Riprova backlink"} />
          </button>
        </div>
      ) : links === null ? (
        <p role="status">
          <Text source={"Caricamento riferimenti…"} />
        </p>
      ) : !links.length ? (
        <p className="editor-hint">
          <Text
            source={
              "Nessuna sessione o pagina la menziona ancora. Scrivi [[ e selezionala nei tuoi appunti."
            }
          />
        </p>
      ) : null}
      {Array.from(groups, ([key, items]) => (
        <div key={key}>
          <h5>
            {items[0].sourceKind === "session"
              ? tr("Sessione {0}", [items[0].sequence])
              : tr("Pagina")}
            : {items[0].sourceTitle}
          </h5>
          {items.map((link) => (
            <button
              key={link.blockId}
              disabled={busy}
              onClick={() => onOpen(link)}
            >
              <span>{link.preview || tr("Blocco senza testo")}</span>
              <small>
                <Text source={"Apri il blocco di origine"} />
              </small>
            </button>
          ))}
        </div>
      ))}
    </section>
  );
}
