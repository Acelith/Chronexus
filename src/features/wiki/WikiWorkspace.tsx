import { useRef, useState } from "react";
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
const labels: Record<string, string> = {
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
};
export default function WikiWorkspace() {
  const [query, setQuery] = useState(""),
    [results, setResults] = useState<Answer<Results> | null>(null),
    [selected, setSelected] = useState<Hit | null>(null),
    [entry, setEntry] = useState<Answer<Detail> | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [page, setPage] = useState(1),
    [usedQuery, setUsedQuery] = useState(""),
    [filter, setFilter] = useState("");
  const version = useRef(0);
  async function find(p = 1, refresh = false) {
    const id = ++version.current;
    setBusy(true);
    setError("");
    setSelected(null);
    setEntry(null);
    try {
      const r = await search(p === 1 ? query : usedQuery, p, refresh);
      if (id === version.current) {
        setResults(r);
        setPage(p);
        setUsedQuery(p === 1 ? query : usedQuery);
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
    <section className="wiki-workspace" aria-label="Wiki Dungeons & Dragons">
      <h3>Biblioteca delle regole</h3>
      <p>Open5e · regole, incantesimi, creature e oggetti da più fonti.</p>
      <p className="editor-hint">
        I contenuti sono prevalentemente in inglese. Cerca un termine di regole,
        ad esempio “magic missile”. Solo quando premi Cerca o apri una voce, il
        termine o l'identificativo viene inviato a Open5e. Le pagine consultate
        rimangono disponibili offline; nessun appunto della campagna viene
        inviato.
      </p>
      <form
        className="wiki-search"
        onSubmit={(e) => {
          e.preventDefault();
          void find();
        }}
      >
        <label>
          Termine nella wiki
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
          Cerca nella wiki
        </button>
        {results ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void find(1, true)}
          >
            Aggiorna ricerca online
          </button>
        ) : null}
      </form>
      {busy ? <p role="status">Consultazione wiki…</p> : null}
      {error ? (
        <p role="alert" className="error">
          {error} Riprova con la stessa ricerca; le copie già consultate
          rimangono locali.
        </p>
      ) : null}
      {results?.warning ? <p role="status">{results.warning}</p> : null}
      {results ? (
        <>
          <div className="wiki-results-heading">
            <p>
              {results.payload.count} risultati per “{usedQuery}” · pagina{" "}
              {page}
            </p>
            <label>
              Tipo nella pagina
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="">Tutti i tipi</option>
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
                  Nessuna voce trovata. Prova il nome inglese o un termine più
                  breve.
                </p>
              ) : null}
              <div className="actions">
                <button
                  disabled={busy || page <= 1}
                  onClick={() => void find(page - 1)}
                >
                  Pagina precedente
                </button>
                <button
                  disabled={
                    busy || page >= 100 || page * 20 >= results.payload.count
                  }
                  onClick={() => void find(page + 1)}
                >
                  Pagina successiva
                </button>
              </div>
            </div>
            <article className="wiki-entry" aria-label="Voce wiki">
              {entry ? (
                <>
                  <h4>{entry.payload.entry.name}</h4>
                  <p>
                    {entry.payload.document.name} ·{" "}
                    {plain(entry.payload.document.gamesystem)}
                  </p>
                  <p className="wiki-license">
                    Licenze dichiarate:{" "}
                    {entry.payload.document.licenses
                      ?.map((l) => l.name)
                      .join("; ") || "Non indicate dalla fonte"}
                    <br />
                    Fornitore: Open5e · {entry.payload.document.key}
                    <br />
                    Copia locale del{" "}
                    {new Date(entry.fetchedAt).toLocaleString("it-IT")}
                  </p>
                  {entry.warning ? <p role="status">{entry.warning}</p> : null}
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
                    Aggiorna voce online
                  </button>
                </>
              ) : (
                <p>
                  Apri una voce per leggere il testo completo, la fonte e
                  l’edizione. Le regole di editori o edizioni diverse restano
                  separate.
                </p>
              )}
            </article>
          </div>
        </>
      ) : null}
    </section>
  );
}
