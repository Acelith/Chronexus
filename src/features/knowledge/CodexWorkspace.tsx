import { lazy, Suspense, useEffect, useState } from "react";
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

interface Props {
  campaignId: string;
  pages: KnowledgePage[];
  selectedId: string | null;
  fallback: string;
  busy: boolean;
  focusBlock?: string;
  register: (guard: SaveGuard | null) => void;
  onSelect: (id: string, label: string) => void;
  onSource: (link: Backlink) => void;
  onSaved: (page: KnowledgePage) => void;
  onCreate: (metadata: PageMetadata) => Promise<KnowledgePage | undefined>;
  onUpdate: (
    id: string,
    metadata: PageMetadata,
  ) => Promise<KnowledgePage | undefined>;
  onRecover: (id: string, title: string) => Promise<KnowledgePage | undefined>;
}
export default function CodexWorkspace(props: Props) {
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<"create" | "edit" | null>(null);
  const page = props.pages.find((page) => page.id === props.selectedId);
  const missing = !!props.selectedId && !page;
  return (
    <section className="codex-workspace" aria-label="Codex">
      <div className="codex-toolbar">
        <label>
          Cerca titolo o alias
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
          Nuova pagina
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
        <nav className="session-list" aria-label="Pagine del Codex">
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
                {item.status === "stub" ? " · Bozza" : ""}
              </span>
              <strong>{item.title}</strong>
              {item.aliases.length ? (
                <span>Alias: {item.aliases.join(", ")}</span>
              ) : null}
            </button>
          ))}
          {!matchingPages(props.pages, query).length ? (
            <p className="editor-hint">
              {props.pages.length
                ? "Nessuna pagina corrisponde alla ricerca."
                : "Il Codex è vuoto. Crea una pagina o scrivi [[ nel diario."}
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
                    ? "Bozza da completare"
                    : "Pagina attiva"}
                </p>
                <h3>{page.title}</h3>
                {page.aliases.length ? (
                  <p>Alias: {page.aliases.join(", ")}</p>
                ) : null}
                <button disabled={props.busy} onClick={() => setForm("edit")}>
                  Modifica pagina
                </button>
              </header>
              {form === "edit" ? (
                <PageForm
                  key={page.id}
                  initial={page}
                  busy={props.busy}
                  onCancel={() => setForm(null)}
                  onSave={async (metadata) => {
                    if (await props.onUpdate(page.id, metadata)) setForm(null);
                  }}
                />
              ) : null}
              <Suspense fallback={<p role="status">Apertura editor…</p>}>
                <Editor
                  key={page.id}
                  page={page}
                  register={props.register}
                  onSaved={props.onSaved}
                  focusBlock={props.focusBlock}
                  disabled={props.busy}
                />
              </Suspense>
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
              <h3>Le conoscenze della tua campagna</h3>
              <p>
                Scegli una pagina o creane una nuova. I collegamenti conservano
                la fonte, senza trasformare un sospetto in un fatto.
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
  onSave: (metadata: PageMetadata) => Promise<void>;
  onCancel: () => void;
}) {
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
      aria-label={initial ? "Modifica pagina" : "Nuova pagina"}
      onSubmit={(event) => {
        event.preventDefault();
        void onSave({
          title,
          kind,
          status,
          aliases: aliases
            .split("\n")
            .map((alias) => alias.trim())
            .filter(Boolean),
        });
      }}
    >
      <label>
        Titolo della pagina
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
          Tipo
          <select
            aria-label="Tipo"
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
          Stato
          <select
            aria-label="Stato"
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as PageMetadata["status"])
            }
            disabled={busy}
          >
            <option value="active">Attiva</option>
            <option value="stub">Bozza</option>
          </select>
        </label>
      </div>
      <label>
        Alias (uno per riga, massimo 20)
        <textarea
          rows={3}
          value={aliases}
          onChange={(event) => setAliases(event.target.value)}
          disabled={busy}
        />
      </label>
      <p className="editor-hint">
        Gli alias condivisi vengono mostrati come risultati distinti: scegli
        sempre la pagina corretta.
      </p>
      <div className="actions">
        <button className="primary" disabled={busy || !title.trim()}>
          {initial ? "Salva pagina" : "Crea pagina"}
        </button>
        <button type="button" disabled={busy} onClick={onCancel}>
          Annulla
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
      <h3>Pagina mancante</h3>
      <p>
        Il riferimento conserva il suo ID. Puoi recuperare una bozza senza
        cambiare i collegamenti negli appunti. Se il titolo è già usato, scegli
        un nome distinto.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void onRecover(title);
        }}
      >
        <label>
          Titolo da recuperare
          <input
            required
            maxLength={200}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <button disabled={busy || !title.trim()}>Recupera bozza</button>
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
    <section className="backlinks" aria-label="Riferimenti a questa pagina">
      <h4>Riferimenti a questa pagina</h4>
      {error ? (
        <div role="alert" className="error">
          {error}
          <button onClick={() => setRetry((value) => value + 1)}>
            Riprova backlink
          </button>
        </div>
      ) : links === null ? (
        <p role="status">Caricamento riferimenti…</p>
      ) : !links.length ? (
        <p className="editor-hint">
          Nessuna sessione o pagina la menziona ancora. Scrivi [[ e selezionala
          nei tuoi appunti.
        </p>
      ) : null}
      {Array.from(groups, ([key, items]) => (
        <div key={key}>
          <h5>
            {items[0].sourceKind === "session"
              ? `Sessione ${items[0].sequence}`
              : "Pagina"}
            : {items[0].sourceTitle}
          </h5>
          {items.map((link) => (
            <button
              key={link.blockId}
              disabled={busy}
              onClick={() => onOpen(link)}
            >
              <span>{link.preview || "Blocco senza testo"}</span>
              <small>Apri il blocco di origine</small>
            </button>
          ))}
        </div>
      ))}
    </section>
  );
}
