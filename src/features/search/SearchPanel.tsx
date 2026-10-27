import { resultCount } from "../../i18n/resultCount";
import { localizeLabels } from "../../i18n/store";
import { tr } from "../../i18n/store";
import { Text } from "../../i18n/Text";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { command, errorMessage } from "../journal/api";
export interface SearchResult {
  kind:
    "session" | "page" | "clue" | "character" | "item" | "spell" | "ability";
  sourceId: string;
  blockId: string | null;
  title: string;
  preview: string;
  updatedAt: string;
}
const kinds = localizeLabels({
  session: "Sessions",
  page: "Pages",
  clue: "Clue board",
  character: "Character",
  item: "Items",
  spell: "Spells",
  ability: "Abilities",
});
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
        aria-label={tr("Search the campaign")}
        className="search-panel"
        onKeyDown={keyboard}
      >
        <header className="player-heading">
          <h2>
            <Text source={"Search the campaign"} />
          </h2>
          <button onClick={onClose}>
            <Text source={"Close search"} />
          </button>
        </header>
        <label>
          <Text source={"Text to search"} />
          <input
            autoFocus
            type="search"
            maxLength={200}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tr("A name, a phrase or part of a word")}
          />
        </label>
        <div className="player-filters">
          <label>
            <Text source={"Search in"} />
            <select
              aria-label={tr("Search in")}
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              <option value="">{tr("All content")}</option>
              {Object.entries(kinds).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            <Text source={"Result order"} />
            <select
              aria-label={tr("Result order")}
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="relevance">{tr("Most relevant")}</option>
              <option value="recent">{tr("Recently changed")}</option>
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
            ? tr("Searching…")
            : query.trim()
              ? resultCount(results.length) +
                (results.length === 100
                  ? tr(" (limit reached: narrow your search)")
                  : "")
              : tr(
                  "Search notes, titles, aliases and character data. Everything stays on the device.",
                )}
        </p>
        <div className="search-results">
          {!loading && query.trim() && !results.length && !error ? (
            <p>
              <Text
                source={"No results. Try fewer words or a different filter."}
              />
            </p>
          ) : null}
          {results.map((r, i) => (
            <button
              key={`${r.kind}-${r.sourceId}-${r.blockId ?? i}`}
              onClick={() => onSelect(r)}
            >
              <span>{kinds[r.kind]}</span>
              <strong>{r.title}</strong>
              <p>{r.preview || tr("Open content")}</p>
            </button>
          ))}
        </div>
        <details>
          <summary>
            <Text source={"Search maintenance"} />
          </summary>
          <button
            disabled={loading}
            onClick={() => {
              setLoading(true);
              command<number>("rebuild_search_index")
                .then((count) => {
                  setNotice(
                    tr("Index rebuilt: {0} entries. Notes are kept.", [count]),
                  );
                  setRefresh((v) => v + 1);
                })
                .catch((e) => setError(errorMessage(e)))
                .finally(() => setLoading(false));
            }}
          >
            <Text source={"Rebuild local index"} />
          </button>
          <p role="status">{notice}</p>
        </details>
      </section>
    </div>
  );
}
