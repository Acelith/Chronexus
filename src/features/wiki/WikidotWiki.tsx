import WikiTranslation, { WikiBlock as BlockView } from "./WikiTranslation";
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
            "No entry matches «{0}» in the Wikidot index of this category.",
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
            "The Wikidot page does not contain, in a recognizable form: {0}.",
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
            "English content from the public dnd5e.wikidot.com wiki (2014 rules). Chronexus downloads the category index only when you press Search and filters the name on the device: the search term is not sent. Opened pages stay available offline."
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
          <Text source={"Wikidot category"} />
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
          <Text source={"Name in the wiki"} />
          <input
            type="search"
            maxLength={100}
            value={query}
            placeholder={tr("e.g. Magic Missile")}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <button className="primary" disabled={busy}>
          <Text source={"Search Wikidot"} />
        </button>
        {result ? (
          <button type="button" disabled={busy} onClick={() => void find(true)}>
            <Text source={"Refresh online index"} />
          </button>
        ) : null}
        {busy ? (
          <button type="button" onClick={cancel}>
            <Text source={"Cancel request"} />
          </button>
        ) : null}
      </form>
      {busy ? (
        <p role="status">
          <Text
            source={
              "Reading Wikidot… Requests are spaced out to respect the site."
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
              {tr("{0} of {1} entries · {2} · {3}", [
                result.total,
                result.indexSize,
                result.cached ? tr("local copy") : tr("downloaded now"),
                when(result.fetchedAt),
              ])}
            </p>
            <label>
              <Text source={"Origin"} />
              <select
                value={origin}
                onChange={(e) => setOrigin(e.target.value as "" | Origin)}
              >
                <option value="">{tr("All origins")}</option>
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
                      "No entries found. Try the English name, a shorter term or another category."
                    }
                  />
                </p>
              ) : null}
              {result.total > result.rows.length ? (
                <p className="muted">
                  <Text
                    source={
                      "Showing the first 200 entries. Narrow the search by name."
                    }
                  />
                </p>
              ) : null}
            </div>
            <article className="wiki-entry" aria-label={tr("Wiki entry")}>
              {page && entry ? (
                <>
                  <h4>{page.title}</h4>
                  <p className="wiki-license">
                    {[
                      page.source
                        ? tr("Declared source: {0}", [page.source])
                        : tr("Source not stated on the page"),
                      originLabels[page.origin],
                      tr("D&D 5e (2014)"),
                    ].join(" · ")}
                    <br />
                    {page.url}
                    <br />
                    {page.license}
                    <br />
                    {entry.cached
                      ? tr("Local copy from {0}", [when(entry.fetchedAt)])
                      : tr("Downloaded on {0}", [when(entry.fetchedAt)])}
                  </p>
                  {entry.warning ? (
                    <p role="status">{systemMessage(entry.warning)}</p>
                  ) : null}
                  {page.missing.length ? (
                    <p role="status" className="error">
                      {tr(
                        "Unrecognized fields on the page: {0}. No value was invented; read the original text below.",
                        [
                          page.missing
                            .map((m) => missingLabels[m] ?? m)
                            .join(", "),
                        ],
                      )}
                    </p>
                  ) : null}
                  <WikiTranslation
                    provider="wikidot"
                    sourceKey={page.page}
                    sourceVersion={entry.fetchedAt}
                  >
                    {page.blocks.map((block, i) => (
                      <BlockView key={i} block={block} />
                    ))}
                  </WikiTranslation>
                  {page.truncated ? (
                    <p className="muted">
                      <Text
                        source={
                          "The page was shortened to the safety limits: open the original address for the rest."
                        }
                      />
                    </p>
                  ) : null}
                  <div className="actions">
                    <button
                      disabled={busy || !selected}
                      onClick={() => selected && void open(selected, true)}
                    >
                      <Text source={"Refresh online entry"} />
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
                        <Text source={"Prepare import into the sheet"} />
                      </button>
                    ) : null}
                  </div>
                  {page.category === "spells" && onImportSpell ? (
                    <p className="muted">
                      <Text
                        source={
                          "Importing opens an editable form in Spells: the entry is saved only when you press Save entry. Wiki rules never become campaign facts."
                        }
                      />
                    </p>
                  ) : null}
                </>
              ) : (
                <p>
                  <Text
                    source={
                      "Open an entry to read its text, declared source and origin. Unearthed Arcana and homebrew are labelled as such."
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
