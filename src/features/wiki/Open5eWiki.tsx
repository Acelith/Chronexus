import { systemMessage } from "../../i18n/store";
import { localeInfo } from "../../i18n/locales";
import { getPreferences } from "../../i18n/store";
import { Text } from "../../i18n/Text";
import { localizeLabels, tr } from "../../i18n/store";
import { useEffect, useRef, useState } from "react";
import { errorMessage } from "../journal/api";
import {
  category,
  detail,
  plain,
  search,
  type Hit,
  type Detail,
  type Results,
  type Answer,
} from "./api";
const labels: Record<string, string> = localizeLabels({
  level: "Livello",
  school: "Scuola",
  casting_time: "Tempo di lancio",
  duration: "Durata",
  range_text: "Gittata",
  concentration: "Concentrazione",
  ritual: "Rituale",
  higher_level: "Ai livelli superiori",
  classes: "Classi",
  armor_class: "Classe armatura",
  hit_points: "Punti ferita",
  challenge_rating_decimal: "Grado sfida",
  actions: "Azioni",
  traits: "Tratti",
  reactions: "Reazioni",
  strength: "Forza",
  dexterity: "Destrezza",
  constitution: "Costituzione",
  intelligence: "Intelligenza",
  wisdom: "Saggezza",
  charisma: "Carisma",
  size: "Taglia",
  type: "Tipo",
});
/** Open5e view; `initialQuery` repeats a search the user agreed to move here. */
export default function Open5eWiki({
  initialQuery = "",
}: {
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery),
    [results, setResults] = useState<Answer<Results> | null>(null),
    [selected, setSelected] = useState<Hit | null>(null),
    [entry, setEntry] = useState<Answer<Detail> | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [page, setPage] = useState(1),
    [usedQuery, setUsedQuery] = useState(""),
    [filter, setFilter] = useState("");
  const version = useRef(0);
  const handoff = useRef(initialQuery.trim().length >= 2 ? initialQuery : "");
  useEffect(() => {
    const term = handoff.current;
    handoff.current = "";
    // One explicit search the user consented to when switching provider.
    if (term) void find(1, false, term);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function find(p = 1, refresh = false, term = query) {
    const id = ++version.current;
    setBusy(true);
    setError("");
    setSelected(null);
    setEntry(null);
    try {
      const r = await search(p === 1 ? term : usedQuery, p, refresh);
      if (id === version.current) {
        setResults(r);
        setPage(p);
        setUsedQuery(p === 1 ? term : usedQuery);
      }
    } catch (e) {
      if (id === version.current) setError(errorMessage(e));
    } finally {
      if (id === version.current) setBusy(false);
    }
  }
  async function open(hit: Hit, refresh = false) {
    const id = ++version.current;
    setSelected(hit);
    setEntry(null);
    setBusy(true);
    setError("");
    try {
      const r = await detail(hit, refresh);
      if (id === version.current) setEntry(r);
    } catch (e) {
      if (id === version.current) setError(errorMessage(e));
    } finally {
      if (id === version.current) setBusy(false);
    }
  }
  const kinds = [
    ...new Set(results?.payload.results.map((r) => r.object_model) ?? []),
  ];
  return (
    <>
      <p>
        <Text
          source={
            "Open5e · regole, incantesimi, creature e oggetti da più fonti."
          }
        />
      </p>
      <p className="editor-hint">
        <Text
          source={
            "I contenuti sono prevalentemente in inglese. Cerca un termine di regole, ad esempio “magic missile”. Solo quando premi Cerca o apri una voce, il termine o l'identificativo viene inviato a Open5e. Le pagine consultate rimangono disponibili offline; nessun appunto della campagna viene inviato."
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
          <Text source={"Termine nella wiki"} />
          <input
            type="search"
            minLength={2}
            maxLength={100}
            required
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <button className="primary" disabled={busy}>
          <Text source={"Cerca nella wiki"} />
        </button>
        {results ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void find(1, true)}
          >
            <Text source={"Aggiorna ricerca online"} />
          </button>
        ) : null}
      </form>
      {busy ? (
        <p role="status">
          <Text source={"Consultazione wiki…"} />
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="error">
          {error}{" "}
          <Text
            source={
              " Riprova con la stessa ricerca; le copie già consultate rimangono locali."
            }
          />
        </p>
      ) : null}
      {results?.warning ? (
        <p role="status">{systemMessage(results.warning)}</p>
      ) : null}
      {results ? (
        <>
          <div className="wiki-results-heading">
            <p>
              {results.payload.count} <Text source={" risultati per “"} />
              {usedQuery}
              <Text source={"” · pagina"} /> {page}
            </p>
            <label>
              <Text source={"Tipo nella pagina"} />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="">{tr("Tutti i tipi")}</option>
                {kinds.map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="wiki-layout">
            <div className="wiki-results">
              {results.payload.results
                .filter((h) => !filter || h.object_model === filter)
                .map((hit) => (
                  <button
                    key={`${hit.route}${hit.object_pk}`}
                    disabled={busy || !category(hit)}
                    aria-current={
                      selected?.object_pk === hit.object_pk ? "page" : undefined
                    }
                    onClick={() => void open(hit)}
                  >
                    <strong>{hit.object_name}</strong>
                    <span>
                      {hit.object_model} · {hit.document.name}
                    </span>
                    <p>{hit.text?.slice(0, 180)}</p>
                  </button>
                ))}
              {!results.payload.results.length ? (
                <p>
                  <Text
                    source={
                      "Nessuna voce trovata. Prova il nome inglese o un termine più breve."
                    }
                  />
                </p>
              ) : null}
              <div className="actions">
                <button
                  disabled={busy || page <= 1}
                  onClick={() => void find(page - 1)}
                >
                  <Text source={"Pagina precedente"} />
                </button>
                <button
                  disabled={
                    busy || page >= 100 || page * 20 >= results.payload.count
                  }
                  onClick={() => void find(page + 1)}
                >
                  <Text source={"Pagina successiva"} />
                </button>
              </div>
            </div>
            <article className="wiki-entry" aria-label={tr("Voce wiki")}>
              {entry ? (
                <>
                  <h4>{entry.payload.entry.name}</h4>
                  <p>
                    {entry.payload.document.name} ·{" "}
                    {plain(entry.payload.document.gamesystem)}
                  </p>
                  <p className="wiki-license">
                    <Text source={"Licenze dichiarate:"} />{" "}
                    {entry.payload.document.licenses
                      ?.map((l) => l.name)
                      .join("; ") || tr("Non indicate dalla fonte")}
                    <br />
                    <Text source={"Fornitore: Open5e · "} />
                    {entry.payload.document.key}
                    <br />
                    <Text source={"Copia locale del"} />{" "}
                    {new Date(entry.fetchedAt).toLocaleString(
                      localeInfo(getPreferences().locale).intl,
                    )}
                  </p>
                  {entry.warning ? (
                    <p role="status">{systemMessage(entry.warning)}</p>
                  ) : null}
                  <p className="wiki-prose">{entry.payload.entry.desc}</p>
                  <dl>
                    {Object.entries(entry.payload.entry)
                      .filter(
                        ([k, v]) =>
                          ![
                            "name",
                            "key",
                            "desc",
                            "document",
                            "crossreferences",
                          ].includes(k) &&
                          v !== null &&
                          v !== "" &&
                          (!Array.isArray(v) || v.length),
                      )
                      .map(([k, v]) => (
                        <div key={k}>
                          <dt>{labels[k] ?? k.replaceAll("_", " ")}</dt>
                          <dd>{plain(v)}</dd>
                        </div>
                      ))}
                  </dl>
                  <button
                    disabled={busy || !selected}
                    onClick={() => selected && void open(selected, true)}
                  >
                    <Text source={"Aggiorna voce online"} />
                  </button>
                </>
              ) : (
                <p>
                  <Text
                    source={
                      "Apri una voce per leggere il testo completo, la fonte e l’edizione. Le regole di editori o edizioni diverse restano separate."
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
