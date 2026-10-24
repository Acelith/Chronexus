import { localeInfo } from "../../i18n/locales";
import { getPreferences } from "../../i18n/store";
import { tr, localizeLabels } from "../../i18n/store";
import { Text } from "../../i18n/Text";
import { useEffect, useRef, useState } from "react";
import { errorMessage } from "../journal/api";
import type { AbilityDetails } from "./api";
import {
  catalogBase,
  catalogCategories,
  loadCatalog,
  parseDocument,
  parseIndex,
  spellFromCatalog,
  srdAttribution,
  textContent,
  validCatalogPath,
  type CatalogCategory,
  type CatalogDocument,
  type CatalogIndexEntry,
  type CatalogResult,
} from "./catalog";

export default function DndCatalog({
  initialQuery = "",
  onImport,
  onClose,
}: {
  initialQuery?: string;
  onImport?: (spell: AbilityDetails) => void;
  onClose: () => void;
}) {
  const [category, setCategory] = useState<CatalogCategory>("spells");
  const [query, setQuery] = useState(initialQuery);
  const [level, setLevel] = useState("");
  const [rows, setRows] = useState<CatalogIndexEntry[] | null>(null);
  const [document, setDocument] = useState<{
    path: string;
    data: CatalogDocument;
    receipt: CatalogResult;
  } | null>(null);
  const [receipt, setReceipt] = useState<CatalogResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  async function load(path: string, refresh = false) {
    const request = ++generation.current;
    setBusy(true);
    setError("");
    try {
      const result = await loadCatalog(path, refresh);
      if (request !== generation.current) return;
      if (path.includes("/"))
        setDocument({
          path,
          data: parseDocument(path, result.payload),
          receipt: result,
        });
      else {
        setRows(parseIndex(result.payload));
        setReceipt(result);
        setDocument(null);
      }
    } catch (reason) {
      if (request === generation.current) setError(errorMessage(reason));
    } finally {
      if (request === generation.current) setBusy(false);
    }
  }
  const results = rows?.filter(
    (r) =>
      r.name
        .toLocaleLowerCase("en")
        .includes(query.trim().toLocaleLowerCase("en")) &&
      (!level || r.level === Number(level)),
  );
  return (
    <section
      className="dnd-catalog"
      aria-label={tr("Catalogo D&D")}
      aria-busy={busy}
    >
      <header className="player-heading">
        <div>
          <span className="eyebrow">
            <Text source={"Compendio SRD · 2014"} />
          </span>
          <h4>
            <Text source={"Cerca in D&D"} />
          </h4>
        </div>
        <button type="button" onClick={onClose}>
          <Text source={"Chiudi catalogo"} />
        </button>
      </header>
      <p className="muted">
        <Text
          source={
            "Contenuti in inglese. La connessione serve solo per le voci non ancora consultate o per aggiornarle. La ricerca per nome resta sul dispositivo. Nessun dato della campagna viene inviato."
          }
        />
      </p>
      <form
        className="player-filters"
        onSubmit={(e) => {
          e.preventDefault();
          void load(category);
        }}
      >
        <label>
          <Text source={"Categoria D&D"} />
          <select
            aria-label={tr("Categoria D&D")}
            disabled={busy}
            value={category}
            onChange={(e) => {
              generation.current++;
              setCategory(e.target.value as CatalogCategory);
              setRows(null);
              setDocument(null);
              setReceipt(null);
              setLevel("");
              setError("");
            }}
          >
            {Object.entries(catalogCategories).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <Text source={"Nome nel catalogo"} />
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tr("Es. Magic Missile")}
            maxLength={200}
          />
        </label>
        {category === "spells" ? (
          <label>
            <Text source={"Livello incantesimo"} />
            <select
              aria-label={tr("Livello incantesimo")}
              value={level}
              onChange={(e) => setLevel(e.target.value)}
            >
              <option value="">{tr("Tutti")}</option>
              {Array.from({ length: 10 }, (_, i) => (
                <option key={i} value={i}>
                  {i === 0 ? tr("Trucchetti") : tr("{0}° livello", [i])}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <button type="submit" className="primary" disabled={busy}>
          <Text source={"Cerca nell’API"} />
        </button>
        {rows ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void load(category, true)}
          >
            <Text source={"Aggiorna indice online"} />
          </button>
        ) : null}
      </form>
      {error ? (
        <p role="alert" className="error">
          {error}
        </p>
      ) : null}
      <p role="status">
        {busy
          ? tr("Consultazione catalogo…")
          : receipt
            ? tr("{0} · {1} · {2} risultati", [
                receipt.cached ? tr("Copia locale") : tr("Scaricato dall’API"),
                new Date(receipt.fetchedAt).toLocaleString(
                  localeInfo(getPreferences().locale).intl,
                ),
                results?.length ?? 0,
              ])
            : tr(
                "Premi Cerca nell’API per caricare l’indice. Non vengono effettuate richieste all’apertura.",
              )}
      </p>
      {receipt?.warning ? <p role="status">{receipt.warning}</p> : null}
      {rows ? (
        <div className="catalog-layout">
          <nav className="player-asset-list" aria-label={tr("Risultati D&D")}>
            {!results?.length ? (
              <p>
                <Text
                  source={
                    "Nessun risultato. Prova il nome inglese o un’altra categoria. I tuoi incantesimi personalizzati restano disponibili nel grimorio."
                  }
                />
              </p>
            ) : null}
            {results?.slice(0, 100).map((row) => (
              <button
                type="button"
                key={row.index}
                disabled={busy}
                aria-current={
                  document?.data.index === row.index ? "page" : undefined
                }
                onClick={() => void load(`${category}/${row.index}`)}
              >
                <strong>{row.name}</strong>
                {row.level !== undefined ? (
                  <span>
                    {row.level === 0
                      ? tr("Trucchetto")
                      : tr("Livello {0}", [row.level])}
                  </span>
                ) : null}
              </button>
            ))}
            {(results?.length ?? 0) > 100 ? (
              <p className="muted">
                <Text
                  source={
                    "Mostrate le prime 100 voci. Restringi la ricerca per nome o livello."
                  }
                />
              </p>
            ) : null}
          </nav>
          <article
            className="catalog-document"
            aria-label={tr("Anteprima D&D")}
          >
            {document ? (
              <>
                <h4>{document.data.name}</h4>
                <p className="muted">
                  {document.receipt.cached
                    ? tr("Copia locale")
                    : tr("Dall’API")}{" "}
                  ·{" "}
                  {new Date(document.receipt.fetchedAt).toLocaleString(
                    localeInfo(getPreferences().locale).intl,
                  )}
                </p>
                {document.receipt.warning ? (
                  <p role="status">{document.receipt.warning}</p>
                ) : null}
                {textContent(document.data.desc) ? (
                  <p className="player-text">
                    {textContent(document.data.desc)}
                  </p>
                ) : null}
                {textContent(document.data.higher_level) ? (
                  <>
                    <h5>
                      <Text source={"A livelli superiori"} />
                    </h5>
                    <p className="player-text">
                      {textContent(document.data.higher_level)}
                    </p>
                  </>
                ) : null}
                <dl className="catalog-metadata">
                  {Object.entries(document.data)
                    .filter(([key]) => quickFields.has(key))
                    .filter(
                      ([key]) =>
                        ![
                          "index",
                          "name",
                          "url",
                          "desc",
                          "higher_level",
                          "updated_at",
                        ].includes(key),
                    )
                    .map(([key, value]) => (
                      <div key={key}>
                        <dt>{fieldLabel(key)}</dt>
                        <dd>
                          <CatalogValue value={value} />
                        </dd>
                      </div>
                    ))}
                </dl>
                <details className="catalog-extra">
                  <summary>
                    <Text source={"Altri dettagli della fonte"} />
                  </summary>
                  <dl className="catalog-metadata">
                    {Object.entries(document.data)
                      .filter(
                        ([key]) =>
                          !quickFields.has(key) &&
                          ![
                            "index",
                            "name",
                            "url",
                            "desc",
                            "higher_level",
                            "updated_at",
                            "children",
                          ].includes(key),
                      )
                      .map(([key, value]) => (
                        <div key={key}>
                          <dt>{fieldLabel(key)}</dt>
                          <dd>
                            <CatalogValue value={value} />
                          </dd>
                        </div>
                      ))}
                  </dl>
                </details>
                <p className="muted">
                  <Text source={"Fonte: "} />
                  {catalogBase + document.path}
                </p>
                <div className="actions">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void load(document.path, true)}
                  >
                    <Text source={"Aggiorna voce online"} />
                  </button>
                  {document.path.startsWith("spells/") && onImport ? (
                    <button
                      type="button"
                      className="primary"
                      disabled={busy}
                      onClick={() => {
                        try {
                          onImport(spellFromCatalog(document.data));
                        } catch (reason) {
                          setError(errorMessage(reason));
                        }
                      }}
                    >
                      <Text source={"Usa questi dati nel modulo"} />
                    </button>
                  ) : null}
                </div>
                <p className="muted">
                  <Text
                    source={
                      "L’importazione prepara un modulo modificabile. La voce viene salvata solo premendo Salva voce. L’API non pubblica incantesimi personalizzati."
                    }
                  />
                </p>
                {Array.isArray(document.data.children) ? (
                  <div className="actions">
                    {document.data.children.map((child, i) => {
                      if (
                        typeof child !== "object" ||
                        child === null ||
                        !("url" in child) ||
                        typeof child.url !== "string"
                      )
                        return null;
                      const path = child.url.startsWith("/api/2014/")
                        ? child.url.slice(10)
                        : "";
                      return validCatalogPath(path) ? (
                        <button
                          type="button"
                          key={i}
                          disabled={busy}
                          onClick={() => void load(path)}
                        >
                          {"name" in child ? String(child.name) : path}
                        </button>
                      ) : null;
                    })}
                  </div>
                ) : null}
              </>
            ) : (
              <p className="muted">
                <Text source={"Seleziona una voce per leggerne i dettagli."} />
              </p>
            )}
          </article>
        </div>
      ) : null}
      <footer className="catalog-license">
        <p>{srdAttribution}</p>
        <p>
          <Text
            source={
              "System Reference Document 5.1: https://dnd.wizards.com/resources/systems-reference-document · Licenza: https://creativecommons.org/licenses/by/4.0/"
            }
          />
        </p>
      </footer>
    </section>
  );
}
function CatalogValue({
  value,
  depth = 0,
}: {
  value: unknown;
  depth?: number;
}) {
  if (value === null || value === undefined) return <>—</>;
  if (typeof value === "string" || typeof value === "number")
    return <>{String(value)}</>;
  if (typeof value === "boolean") return <>{value ? tr("Sì") : tr("No")}</>;
  if (depth > 3)
    return (
      <span className="muted">
        <Text source={"Dettagli annidati nella fonte API."} />
      </span>
    );
  if (Array.isArray(value))
    return (
      <>
        {value.slice(0, 40).map((v, i) => (
          <div key={i}>
            <CatalogValue value={v} depth={depth + 1} />
          </div>
        ))}
        {value.length > 40 ? (
          <p>
            <Text source={"Altre "} />
            {value.length - 40} <Text source={" voci nella fonte API."} />
          </p>
        ) : null}
      </>
    );
  if (
    typeof value === "object" &&
    "name" in value &&
    typeof value.name === "string"
  )
    return <>{value.name}</>;
  if (typeof value === "object")
    return (
      <>
        {Object.entries(value)
          .filter(([k]) => k !== "url" && k !== "index")
          .map(([key, v]) => (
            <div key={key}>
              <span className="muted">{fieldLabel(key)}: </span>
              <CatalogValue value={v} depth={depth + 1} />
            </div>
          ))}
      </>
    );
  return null;
}
const quickFields = new Set([
  "casting_time",
  "duration",
  "range",
  "components",
  "concentration",
  "ritual",
  "level",
  "school",
  "hit_die",
  "alignment",
  "size",
  "speed",
  "cost",
  "weight",
  "equipment_category",
]);
const fieldLabels: Record<string, string> = localizeLabels({
  casting_time: "Tempo di lancio",
  duration: "Durata",
  range: "Portata",
  components: "Componenti",
  concentration: "Concentrazione",
  ritual: "Rituale",
  level: "Livello",
  school: "Scuola",
  hit_die: "Dado vita",
  alignment: "Allineamento",
  size: "Taglia",
  speed: "Velocità",
  cost: "Costo",
  weight: "Peso",
  equipment_category: "Categoria",
  classes: "Classi",
  subclasses: "Sottoclassi",
  material: "Materiali",
  damage: "Danni",
  damage_type: "Tipo di danno",
  damage_at_slot_level: "Danno per livello dello slot",
  damage_at_character_level: "Danno per livello del personaggio",
  attack_type: "Tipo di attacco",
  proficiencies: "Competenze",
  proficiency_choices: "Scelte di competenza",
  saving_throws: "Tiri salvezza",
  starting_equipment: "Equipaggiamento iniziale",
  starting_equipment_options: "Scelte equipaggiamento iniziale",
  multi_classing: "Multiclasse",
  spellcasting: "Lancio incantesimi",
  spellcasting_ability: "Caratteristica da incantatore",
  desc: "Descrizione",
  name: "Nome",
  traits: "Tratti",
  languages: "Linguaggi",
  language_desc: "Lingue",
  age: "Età",
  size_description: "Descrizione taglia",
  ability_bonuses: "Bonus caratteristiche",
  ability_score: "Caratteristica",
  bonus: "Bonus",
  quantity: "Quantità",
  unit: "Unità",
  normal: "Normale",
  long: "Lunga",
  damage_dice: "Dadi di danno",
  properties: "Proprietà",
  weapon_category: "Categoria arma",
  weapon_range: "Tipo arma",
  category_range: "Categoria e portata",
  two_handed_damage: "Danno a due mani",
  special: "Speciale",
  rarity: "Rarità",
  subraces: "Sottospecie",
  choice: "Scelta",
  choose: "Numero da scegliere",
  from: "Opzioni",
  options: "Opzioni",
  count: "Numero",
  feature: "Privilegio",
  prerequisites: "Prerequisiti",
  class: "Classe",
  race: "Specie",
});
function fieldLabel(key: string) {
  return fieldLabels[key] ?? key.replaceAll("_", " ");
}
