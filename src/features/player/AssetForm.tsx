import { Text } from "../../i18n/Text";
import { tr } from "../../i18n/store";
import { lazy, Suspense, useState } from "react";
import type { Session } from "../journal/api";
import type { KnowledgePage } from "../knowledge/api";
import { blockOptions } from "../knowledge/blocks";
import {
  emptyAsset,
  type Asset,
  type AssetInput,
  type AssetDetails,
  type AssetLinks,
} from "./api";
import { Flag, NumberField, TextField } from "./fields";
import { catalogBase, srdAttribution } from "./catalog";
const DndCatalog = lazy(() => import("./DndCatalog"));

export default function AssetForm({
  initial,
  draft,
  kind,
  systemId,
  pages,
  sessions,
  busy,
  onSave,
  onCancel,
}: {
  initial: Asset | null;
  draft?: AssetInput;
  kind: AssetDetails["kind"];
  systemId: string;
  pages: KnowledgePage[];
  sessions: Session[];
  busy: boolean;
  onSave: (input: AssetInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [input, setInput] = useState<AssetInput>(
    () => initial?.input ?? draft ?? emptyAsset(kind, systemId),
  );
  const [lookup, setLookup] = useState(false);
  const details = input.details;
  const change = (details: AssetDetails) => setInput({ ...input, details });
  const links = input.links;
  const link = <K extends keyof AssetLinks>(key: K, value: AssetLinks[K]) =>
    setInput({ ...input, links: { ...links, [key]: value } });
  const source = sessions.find((s) => s.id === links.sourceSessionId);
  const blocks = source ? blockOptions(source.document) : [];
  function pageSelector(
    label: string,
    key: "pageId" | "npcId" | "placeId" | "questId",
    pageKind?: string,
  ) {
    const options = pages.filter(
      (p) => !pageKind || p.kind === pageKind || p.id === links[key],
    );
    return (
      <label>
        {label}
        <select
          aria-label={label}
          value={links[key] ?? ""}
          onChange={(e) => link(key, e.target.value || null)}
        >
          <option value="">{tr("Nessun collegamento")}</option>
          {options.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <>
      {lookup && details.kind === "spell" ? (
        <Suspense
          fallback={
            <p role="status">
              <Text source={"Apertura catalogo…"} />
            </p>
          }
        >
          <DndCatalog
            initialQuery={details.name}
            onClose={() => setLookup(false)}
            onImport={(spell) => {
              change({
                ...spell,
                known: details.known,
                prepared: details.prepared,
                notes: details.notes,
              });
              setLookup(false);
            }}
          />
        </Suspense>
      ) : null}
      <form
        className="player-form"
        aria-label={
          details.kind === "item"
            ? tr("Dettagli oggetto")
            : tr("Dettagli capacità")
        }
        onSubmit={(e) => {
          e.preventDefault();
          void onSave(input);
        }}
      >
        <fieldset disabled={busy || lookup}>
          <legend>
            {initial ? tr("Modifica") : tr("Aggiungi")}{" "}
            {details.kind === "item"
              ? "oggetto"
              : details.kind === "spell"
                ? "incantesimo"
                : tr("capacità")}
          </legend>
          {details.kind === "spell" ? (
            <>
              <p className="muted">
                <Text
                  source={
                    "Scrivi un incantesimo personalizzato o cerca un nome inglese nel catalogo SRD 2014. “Usa questi dati nel modulo” sostituisce nome e campi dell’incantesimo; conserva note, marcatori e collegamenti. Il salvataggio resta esplicito."
                  }
                />
              </p>
              <button type="button" onClick={() => setLookup((v) => !v)}>
                <Text source={"Cerca questo nome in D&D"} />
              </button>
            </>
          ) : null}
          <div className="player-fields">
            <TextField
              label={tr("Nome della voce")}
              autoFocus
              value={details.name}
              required
              onChange={(name) => change({ ...details, name })}
            />
            {details.kind === "item" ? (
              <>
                <NumberField
                  label={tr("Quantità")}
                  value={details.quantity}
                  onChange={(quantity) =>
                    change({ ...details, quantity: quantity ?? 0 })
                  }
                />
                <TextField
                  label={tr("Collocazione (zaino, tasca, indossato…)")}
                  value={details.location ?? ""}
                  onChange={(location) => change({ ...details, location })}
                />
                <TextField
                  label={tr("Categoria oggetto")}
                  value={details.category}
                  max={100}
                  onChange={(category) => change({ ...details, category })}
                />
                <NumberField
                  label={tr("Peso (unità personale, facoltativo)")}
                  value={details.weight}
                  optional
                  decimal
                  onChange={(weight) => change({ ...details, weight })}
                />
                <TextField
                  label={tr("Valore o valuta (testo libero)")}
                  value={details.value}
                  onChange={(value) => change({ ...details, value })}
                />
                <div className="player-flags">
                  <Flag
                    label={tr("Equipaggiato")}
                    value={details.equipped}
                    onChange={(equipped) => change({ ...details, equipped })}
                  />
                  <Flag
                    label={tr("Consumabile")}
                    value={details.consumable}
                    onChange={(consumable) =>
                      change({ ...details, consumable })
                    }
                  />
                </div>
              </>
            ) : (
              <>
                <TextField
                  label={tr("Regolamento della capacità")}
                  value={details.systemId}
                  max={80}
                  required
                  onChange={(systemId) => change({ ...details, systemId })}
                />
                <TextField
                  label={tr("Livello o rango (testo libero)")}
                  value={details.rank}
                  onChange={(rank) => change({ ...details, rank })}
                />
                <TextField
                  label={tr("Scuola o tradizione")}
                  value={details.school}
                  onChange={(school) => change({ ...details, school })}
                />
                <TextField
                  label={tr("Tempo di attivazione")}
                  value={details.castingTime}
                  onChange={(castingTime) =>
                    change({ ...details, castingTime })
                  }
                />
                <TextField
                  label={tr("Durata")}
                  value={details.duration}
                  onChange={(duration) => change({ ...details, duration })}
                />
                <TextField
                  label={tr("Portata")}
                  value={details.range}
                  onChange={(range) => change({ ...details, range })}
                />
                <TextField
                  label={tr("Componenti")}
                  value={details.components}
                  onChange={(components) => change({ ...details, components })}
                />
                <Flag
                  label={tr("Rituale")}
                  value={details.ritual ?? false}
                  onChange={(ritual) => change({ ...details, ritual })}
                />
                <Flag
                  label={tr("Concentrazione")}
                  value={details.concentration ?? false}
                  onChange={(concentration) =>
                    change({ ...details, concentration })
                  }
                />
                <div className="player-flags">
                  <Flag
                    label={tr("Conosciuta")}
                    value={details.known}
                    onChange={(known) => change({ ...details, known })}
                  />
                  <Flag
                    label={tr("Preparata")}
                    value={details.prepared}
                    onChange={(prepared) => change({ ...details, prepared })}
                  />
                </div>
              </>
            )}
          </div>
          <TextField
            label={tr("Descrizione")}
            value={details.description}
            max={16000}
            multiline
            onChange={(description) => change({ ...details, description })}
          />
          <TextField
            label={tr("Note della voce")}
            value={details.notes}
            max={16000}
            multiline
            onChange={(notes) => change({ ...details, notes })}
          />
          <h4>
            <Text source={"Collegamenti e provenienza"} />
          </h4>
          <p className="muted">
            <Text
              source={
                "Collega pagine e sessioni della campagna. Per aggiungere un PNG, un luogo o una missione, crea prima la pagina nel Codex."
              }
            />
          </p>
          <div className="player-fields">
            {pageSelector(tr("Pagina della voce nel Codex"), "pageId")}
            <label>
              <Text source={"Sessione fonte"} />
              <select
                aria-label={tr("Sessione fonte")}
                value={links.sourceSessionId ?? ""}
                onChange={(e) =>
                  setInput({
                    ...input,
                    links: {
                      ...links,
                      sourceSessionId: e.target.value || null,
                      sourceBlockId: null,
                    },
                  })
                }
              >
                <option value="">{tr("Nessuna sessione")}</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {tr("Sessione ")}
                    {s.sequence}: {s.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <Text source={"Blocco fonte"} />
              <select
                aria-label={tr("Blocco fonte")}
                disabled={!source}
                value={links.sourceBlockId ?? ""}
                onChange={(e) => link("sourceBlockId", e.target.value || null)}
              >
                <option value="">{tr("Intera sessione")}</option>
                {links.sourceBlockId &&
                !blocks.some((b) => b.id === links.sourceBlockId) ? (
                  <option value={links.sourceBlockId}>
                    {tr("Blocco non più presente (riferimento conservato)")}
                  </option>
                ) : null}
                {blocks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.text}
                  </option>
                ))}
              </select>
            </label>
            {details.kind === "item" ? (
              <>
                {pageSelector(tr("PNG collegato"), "npcId", "npc")}
                {pageSelector(tr("Luogo collegato"), "placeId", "place")}
                {pageSelector(tr("Missione collegata"), "questId", "quest")}
              </>
            ) : null}
          </div>
          <TextField
            label={tr("Note di provenienza")}
            value={links.provenanceNotes}
            max={4000}
            multiline
            onChange={(v) => link("provenanceNotes", v)}
          />
          <div className="actions">
            <button className="primary" disabled={!details.name.trim()}>
              <Text source={"Salva voce"} />
            </button>
            <button type="button" onClick={onCancel}>
              <Text source={"Annulla modifiche"} />
            </button>
          </div>
        </fieldset>
        {details.kind !== "item" && details.catalogSource ? (
          <aside className="catalog-license">
            <p>
              <Text source={"Base: "} />
              {details.catalogSource.name} ·{" "}
              {catalogBase + details.catalogSource.path}
            </p>
            <p>{srdAttribution}</p>
            <p>
              <Text
                source={
                  "SRD 5.1: https://dnd.wizards.com/resources/systems-reference-document · CC BY 4.0: https://creativecommons.org/licenses/by/4.0/"
                }
              />
            </p>
          </aside>
        ) : null}
      </form>
    </>
  );
}
