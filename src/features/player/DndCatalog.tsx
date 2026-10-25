import { systemMessage } from "../../i18n/store";
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
      aria-label={tr("D&D catalog")}
      aria-busy={busy}
    >
      <header className="player-heading">
        <div>
          <span className="eyebrow">
            <Text source={"SRD compendium · 2014"} />
          </span>
          <h4>
            <Text source={"Search D&D"} />
          </h4>
        </div>
        <button type="button" onClick={onClose}>
          <Text source={"Close catalog"} />
        </button>
      </header>
      <p className="muted">
        <Text
          source={
            "English content. The connection is needed only for entries not yet viewed or to refresh them. Name search stays on the device. No campaign data is sent."
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
          <Text source={"D&D category"} />
          <select
            aria-label={tr("D&D category")}
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
          <Text source={"Catalog name"} />
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tr("e.g. Magic Missile")}
            maxLength={200}
          />
        </label>
        {category === "spells" ? (
          <label>
            <Text source={"Spell level"} />
            <select
              aria-label={tr("Spell level")}
              value={level}
              onChange={(e) => setLevel(e.target.value)}
            >
              <option value="">{tr("All")}</option>
              {Array.from({ length: 10 }, (_, i) => (
                <option key={i} value={i}>
                  {i === 0 ? tr("Cantrips") : tr("Level {0}", [i])}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <button type="submit" className="primary" disabled={busy}>
          <Text source={"Search the API"} />
        </button>
        {rows ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void load(category, true)}
          >
            <Text source={"Refresh online index"} />
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
          ? tr("Reading catalog…")
          : receipt
            ? tr("{0} · {1} · {2} results", [
                receipt.cached
                  ? tr("Local copy")
                  : tr("Downloaded from the API"),
                new Date(receipt.fetchedAt).toLocaleString(
                  localeInfo(getPreferences().locale).intl,
                ),
                results?.length ?? 0,
              ])
            : tr(
                "Press Search the API to load the index. No requests are made on opening.",
              )}
      </p>
      {receipt?.warning ? (
        <p role="status">{systemMessage(receipt.warning)}</p>
      ) : null}
      {rows ? (
        <div className="catalog-layout">
          <nav className="player-asset-list" aria-label={tr("D&D results")}>
            {!results?.length ? (
              <p>
                <Text
                  source={
                    "No results. Try the English name or another category. Your custom spells stay available in the spellbook."
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
                      ? tr("Cantrip")
                      : tr("Level {0}", [row.level])}
                  </span>
                ) : null}
              </button>
            ))}
            {(results?.length ?? 0) > 100 ? (
              <p className="muted">
                <Text
                  source={
                    "Showing the first 100 entries. Narrow the search by name or level."
                  }
                />
              </p>
            ) : null}
          </nav>
          <article className="catalog-document" aria-label={tr("D&D preview")}>
            {document ? (
              <>
                <h4>{document.data.name}</h4>
                <p className="muted">
                  {document.receipt.cached
                    ? tr("Local copy")
                    : tr("From the API")}{" "}
                  ·{" "}
                  {new Date(document.receipt.fetchedAt).toLocaleString(
                    localeInfo(getPreferences().locale).intl,
                  )}
                </p>
                {document.receipt.warning ? (
                  <p role="status">{systemMessage(document.receipt.warning)}</p>
                ) : null}
                {textContent(document.data.desc) ? (
                  <p className="player-text">
                    {textContent(document.data.desc)}
                  </p>
                ) : null}
                {textContent(document.data.higher_level) ? (
                  <>
                    <h5>
                      <Text source={"At higher levels"} />
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
                    <Text source={"More source details"} />
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
                  <Text source={"Source: "} />
                  {catalogBase + document.path}
                </p>
                <div className="actions">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void load(document.path, true)}
                  >
                    <Text source={"Refresh online entry"} />
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
                      <Text source={"Use this data in the form"} />
                    </button>
                  ) : null}
                </div>
                <p className="muted">
                  <Text
                    source={
                      "Importing prepares an editable form. The entry is saved only when you press Save entry. The API does not publish custom spells."
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
                <Text source={"Select an entry to read its details."} />
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
              "System Reference Document 5.1: https://dnd.wizards.com/resources/systems-reference-document · License: https://creativecommons.org/licenses/by/4.0/"
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
  if (typeof value === "boolean") return <>{value ? tr("Yes") : tr("No")}</>;
  if (depth > 3)
    return (
      <span className="muted">
        <Text source={"Nested details in the API source."} />
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
            <Text source={"Others "} />
            {value.length - 40} <Text source={" entries in the API source."} />
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
  casting_time: "Casting time",
  duration: "Duration",
  range: "Range",
  components: "Components",
  concentration: "Concentration",
  ritual: "Ritual",
  level: "Level",
  school: "School",
  hit_die: "Hit die",
  alignment: "Alignment",
  size: "Size",
  speed: "Speed",
  cost: "Cost",
  weight: "Weight",
  equipment_category: "Category",
  classes: "Classes",
  subclasses: "Subclasses",
  material: "Materials",
  damage: "Damage",
  damage_type: "Damage type",
  damage_at_slot_level: "Damage by slot level",
  damage_at_character_level: "Damage by character level",
  attack_type: "Attack type",
  proficiencies: "Proficiencies",
  proficiency_choices: "Proficiency choices",
  saving_throws: "Saving throws",
  starting_equipment: "Starting equipment",
  starting_equipment_options: "Starting equipment choices",
  multi_classing: "Multiclass",
  spellcasting: "Spellcasting",
  spellcasting_ability: "Spellcasting ability",
  desc: "Description",
  name: "Name",
  traits: "Traits",
  languages: "Languages",
  language_desc: "Languages",
  age: "Age",
  size_description: "Size description",
  ability_bonuses: "Ability score bonuses",
  ability_score: "Ability score",
  bonus: "Bonus",
  quantity: "Quantity",
  unit: "Unit",
  normal: "Normal",
  long: "Long",
  damage_dice: "Damage dice",
  properties: "Properties",
  weapon_category: "Weapon category",
  weapon_range: "Weapon type",
  category_range: "Category and range",
  two_handed_damage: "Two-handed damage",
  special: "Special",
  rarity: "Rarity",
  subraces: "Subspecies",
  choice: "Choice",
  choose: "Number to choose",
  from: "Options",
  options: "Options",
  count: "Number",
  feature: "Feature",
  prerequisites: "Prerequisites",
  class: "Class",
  race: "Species",
});
function fieldLabel(key: string) {
  return fieldLabels[key] ?? key.replaceAll("_", " ");
}
