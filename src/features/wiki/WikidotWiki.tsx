import { useEffect, useRef, useState } from "react";
import { localeInfo } from "../../i18n/locales";
import { getPreferences, systemMessage, tr } from "../../i18n/store";
import { Text } from "../../i18n/Text";
import { errorMessage } from "../journal/api";
import type { AbilityDetails } from "../player/api";
import {
  missingLabels,
  originLabels,
  spellFromWikidot,
  wikidotApi,
  wikidotCategories,
  type Block,
  type Cached,
  type Entry,
  type IndexRow,
  type Origin,
  type SearchResult,
  type WikidotCategory,
} from "./wikidot";

export interface Unavailable {
  reason: string;
  query: string;
  retry: () => void;
}
function when(iso: string) {
  return new Date(iso).toLocaleString(localeInfo(getPreferences().locale).intl);
}
export function BlockView({ block }: { block: Block }) {
  switch (block.kind) {
    case "heading":
      return <h5>{block.text}</h5>;
    case "paragraph":
      return <p className="wiki-prose">{block.text}</p>;
    case "list":
      return (
        <ul>
          {block.items.map((item, i) => (
            <li key={i} className="wiki-prose">
              {item}
            </li>
          ))}
        </ul>
      );
    case "table":
      return (
        <div className="wiki-table">
          <table>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}
export default function WikidotWiki({
  onUnavailable,
  onImportSpell,
}: {
  onUnavailable: (value: Unavailable) => void;
  onImportSpell?: (spell: AbilityDetails) => void;
}) {
  const [category, setCategory] = useState<WikidotCategory>("spells");
  const [query, setQuery] = useState("");
  const [origin, setOrigin] = useState<"" | Origin>("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [selected, setSelected] = useState<IndexRow | null>(null);
  const [entry, setEntry] = useState<Cached<Entry> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const version = useRef(0);
  useEffect(
    () => () => {
      // Leaving the view abandons pending lookups instead of storing late results.
      version.current++;
      void wikidotApi.cancel().catch(() => undefined);
    },
    [],
  );
  async function find(refresh = false) {
    const id = ++version.current;
    const term = query.trim();
    setBusy(true);
    setError("");
    setSelected(null);
    setEntry(null);
    try {
      const r = await wikidotApi.search(category, term, refresh);
      if (id !== version.current) return;
      setResult(r);
      if (!r.total)
        onUnavailable({
          reason: tr(
            "Nessuna voce corrisponde a «{0}» nell’indice Wikidot di questa categoria.",
            [term],
          ),
          query: term,
          retry: () => void find(),
        });
    } catch (reason) {
      if (id !== version.current) return;
      const message = errorMessage(reason);
      setError(message);
      onUnavailable({
        reason: message,
        query: term,
        retry: () => void find(refresh),
      });
    } finally {
      if (id === version.current) setBusy(false);
    }
  }
  async function open(row: IndexRow, refresh = false) {
    const id = ++version.current;
    setSelected(row);
    setEntry(null);
    setBusy(true);
    setError("");
    try {
      const r = await wikidotApi.entry(row.page, refresh);
      if (id !== version.current) return;
      setEntry(r);
      if (r.payload.missing.length)
        onUnavailable({
          reason: tr(
            "La pagina Wikidot non contiene in forma riconoscibile: {0}.",
            [r.payload.missing.map((m) => missingLabels[m] ?? m).join(", ")],
          ),
          query: row.name,
          retry: () => void open(row, true),
        });
    } catch (reason) {
      if (id !== version.current) return;
      const message = errorMessage(reason);
      setError(message);
      onUnavailable({
        reason: message,
        query: row.name,
        retry: () => void open(row, refresh),
      });
    } finally {
      if (id === version.current) setBusy(false);
    }
  }
  function cancel() {
    version.current++;
    setBusy(false);
    void wikidotApi.cancel().catch(() => undefined);
  }
  const rows = result?.rows.filter((r) => !origin || r.origin === origin) ?? [];
  const page = entry?.payload;
  return (
    <>
      <p className="editor-hint">
        <Text
          source={
            "Contenuti in inglese dalla wiki pubblica dnd5e.wikidot.com (regole 2014). Chronexus scarica l’indice della categoria solo quando premi Cerca e filtra il nome sul dispositivo: il termine cercato non viene inviato. Le pagine aperte restano disponibili offline."
          }
        />
      </p>
      <form
        className="wiki-search"
        onSubmit={(e) => {
          e.preventDefault();
          void find();
        }}
      >
        <label>
          <Text source={"Categoria Wikidot"} />
          <select
            value={category}
            disabled={busy}
            onChange={(e) => {
              version.current++;
              setCategory(e.target.value as WikidotCategory);
              setResult(null);
              setSelected(null);
              setEntry(null);
              setError("");
            }}
          >
            {Object.entries(wikidotCategories).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <Text source={"Nome nella wiki"} />
          <input
            type="search"
            maxLength={100}
            value={query}
            placeholder={tr("Es. Magic Missile")}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <button className="primary" disabled={busy}>
          <Text source={"Cerca su Wikidot"} />
        </button>
        {result ? (
          <button type="button" disabled={busy} onClick={() => void find(true)}>
            <Text source={"Aggiorna indice online"} />
          </button>
        ) : null}
        {busy ? (
          <button type="button" onClick={cancel}>
            <Text source={"Annulla richiesta"} />
          </button>
        ) : null}
      </form>
      {busy ? (
        <p role="status">
          <Text
            source={
              "Consultazione Wikidot… Le richieste sono distanziate per rispettare il sito."
            }
          />
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="error">
          {systemMessage(error)}
        </p>
      ) : null}
      {result?.warning ? (
        <p role="status">{systemMessage(result.warning)}</p>
      ) : null}
      {result ? (
        <>
          <div className="wiki-results-heading">
            <p>
              {tr("{0} di {1} voci · {2} · {3}", [
                result.total,
                result.indexSize,
                result.cached ? tr("copia locale") : tr("scaricato ora"),
                when(result.fetchedAt),
              ])}
            </p>
            <label>
              <Text source={"Origine"} />
              <select
                value={origin}
                onChange={(e) => setOrigin(e.target.value as "" | Origin)}
              >
                <option value="">{tr("Tutte le origini")}</option>
                {Object.entries(originLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="wiki-layout">
            <div className="wiki-results">
              {rows.map((row) => (
                <button
                  key={row.page}
                  disabled={busy}
                  aria-current={
                    selected?.page === row.page ? "page" : undefined
                  }
                  onClick={() => void open(row)}
                >
                  <strong>{row.name}</strong>
                  <span>
                    {[row.group, originLabels[row.origin]]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  {row.details.length ? <p>{row.details.join(" · ")}</p> : null}
                </button>
              ))}
              {!rows.length ? (
                <p>
                  <Text
                    source={
                      "Nessuna voce trovata. Prova il nome inglese, un termine più breve o un’altra categoria."
                    }
                  />
                </p>
              ) : null}
              {result.total > result.rows.length ? (
                <p className="muted">
                  <Text
                    source={
                      "Mostrate le prime 200 voci. Restringi la ricerca per nome."
                    }
                  />
                </p>
              ) : null}
            </div>
            <article className="wiki-entry" aria-label={tr("Voce wiki")}>
              {page && entry ? (
                <>
                  <h4>{page.title}</h4>
                  <p className="wiki-license">
                    {[
                      page.source
                        ? tr("Fonte dichiarata: {0}", [page.source])
                        : tr("Fonte non indicata nella pagina"),
                      originLabels[page.origin],
                      tr("D&D 5e (2014)"),
                    ].join(" · ")}
                    <br />
                    {page.url}
                    <br />
                    {page.license}
                    <br />
                    {entry.cached
                      ? tr("Copia locale del {0}", [when(entry.fetchedAt)])
                      : tr("Scaricata il {0}", [when(entry.fetchedAt)])}
                  </p>
                  {entry.warning ? (
                    <p role="status">{systemMessage(entry.warning)}</p>
                  ) : null}
                  {page.missing.length ? (
                    <p role="status" className="error">
                      {tr(
                        "Campi non riconosciuti nella pagina: {0}. Nessun valore è stato inventato; leggi il testo originale qui sotto.",
                        [
                          page.missing
                            .map((m) => missingLabels[m] ?? m)
                            .join(", "),
                        ],
                      )}
                    </p>
                  ) : null}
                  {page.blocks.map((block, i) => (
                    <BlockView key={i} block={block} />
                  ))}
                  {page.truncated ? (
                    <p className="muted">
                      <Text
                        source={
                          "La pagina è stata accorciata ai limiti di sicurezza: apri l’indirizzo originale per il resto."
                        }
                      />
                    </p>
                  ) : null}
                  <div className="actions">
                    <button
                      disabled={busy || !selected}
                      onClick={() => selected && void open(selected, true)}
                    >
                      <Text source={"Aggiorna voce online"} />
                    </button>
                    {page.category === "spells" && onImportSpell ? (
                      <button
                        className="primary"
                        disabled={busy}
                        onClick={() => {
                          try {
                            onImportSpell(spellFromWikidot(page));
                          } catch (reason) {
                            setError(errorMessage(reason));
                          }
                        }}
                      >
                        <Text source={"Prepara importazione nella scheda"} />
                      </button>
                    ) : null}
                  </div>
                  {page.category === "spells" && onImportSpell ? (
                    <p className="muted">
                      <Text
                        source={
                          "L’importazione apre un modulo modificabile in Incantesimi: la voce viene salvata solo premendo Salva voce. Le regole della wiki non diventano fatti della campagna."
                        }
                      />
                    </p>
                  ) : null}
                </>
              ) : (
                <p>
                  <Text
                    source={
                      "Apri una voce per leggere testo, fonte dichiarata e origine. Unearthed Arcana e homebrew sono indicati come tali."
                    }
                  />
                </p>
              )}
            </article>
          </div>
        </>
      ) : null}
    </>
  );
}
