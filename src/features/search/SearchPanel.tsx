import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { command, errorMessage } from "../journal/api";
export interface SearchResult {
  kind: "session" | "page" | "character" | "item" | "spell" | "ability";
  sourceId: string;
  blockId: string | null;
  title: string;
  preview: string;
  updatedAt: string;
}
const kinds = {
  session: "Sessioni",
  page: "Pagine",
  character: "Personaggio",
  item: "Oggetti",
  spell: "Incantesimi",
  ability: "Capacità",
};
export default function SearchPanel({
  campaignId,
  onSelect,
  onClose,
}: {
  campaignId: string;
  onSelect: (r: SearchResult) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("");
  const [sort, setSort] = useState("relevance");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setError("");
      command<SearchResult[]>("search_campaign", {
        campaignId,
        query,
        kind: kind || null,
        sort,
      })
        .then((rows) => {
          if (active) setResults(rows);
        })
        .catch((e) => {
          if (active) setError(errorMessage(e));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [campaignId, query, kind, sort, refresh]);
  function keyboard(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
    if (e.key === "Tab") {
      const els = dialog.current?.querySelectorAll<HTMLElement>(
        "button:not(:disabled),input,select,summary",
      );
      if (!els?.length) return;
      const first = els[0],
        last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }
  return (
    <div className="search-overlay">
      <section
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label="Cerca nella campagna"
        className="search-panel"
        onKeyDown={keyboard}
      >
        <header className="player-heading">
          <h2>Cerca nella campagna</h2>
          <button onClick={onClose}>Chiudi ricerca</button>
        </header>
        <label>
          Testo da cercare
          <input
            autoFocus
            type="search"
            maxLength={200}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Un nome, una frase o una parte di parola"
          />
        </label>
        <div className="player-filters">
          <label>
            Cerca in
            <select
              aria-label="Cerca in"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              <option value="">Tutti i contenuti</option>
              {Object.entries(kinds).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            Ordine risultati
            <select
              aria-label="Ordine risultati"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="relevance">Più pertinenti</option>
              <option value="recent">Modificati di recente</option>
            </select>
          </label>
        </div>
        {error ? (
          <p role="alert" className="error">
            {error}
          </p>
        ) : null}
        <p role="status">
          {loading
            ? "Ricerca…"
            : query.trim()
              ? `${results.length} risultati${results.length === 100 ? " (limite raggiunto: restringi la ricerca)" : ""}`
              : "Cerca negli appunti, nei titoli, negli alias e nei dati del personaggio. Tutto resta sul dispositivo."}
        </p>
        <div className="search-results">
          {!loading && query.trim() && !results.length && !error ? (
            <p>Nessun risultato. Prova meno parole o un filtro diverso.</p>
          ) : null}
          {results.map((r, i) => (
            <button
              key={`${r.kind}-${r.sourceId}-${r.blockId ?? i}`}
              onClick={() => onSelect(r)}
            >
              <span>{kinds[r.kind]}</span>
              <strong>{r.title}</strong>
              <p>{r.preview || "Apri il contenuto"}</p>
            </button>
          ))}
        </div>
        <details>
          <summary>Manutenzione ricerca</summary>
          <button
            disabled={loading}
            onClick={() => {
              setLoading(true);
              command<number>("rebuild_search_index")
                .then((count) => {
                  setNotice(
                    `Indice ricostruito: ${count} voci. Gli appunti sono conservati.`,
                  );
                  setRefresh((v) => v + 1);
                })
                .catch((e) => setError(errorMessage(e)))
                .finally(() => setLoading(false));
            }}
          >
            Ricostruisci indice locale
          </button>
          <p role="status">{notice}</p>
        </details>
      </section>
    </div>
  );
}
