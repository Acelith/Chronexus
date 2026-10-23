import { useState } from "react";
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

export default function AssetForm({
  initial,
  kind,
  systemId,
  pages,
  sessions,
  busy,
  onSave,
  onCancel,
}: {
  initial: Asset | null;
  kind: AssetDetails["kind"];
  systemId: string;
  pages: KnowledgePage[];
  sessions: Session[];
  busy: boolean;
  onSave: (input: AssetInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [input, setInput] = useState<AssetInput>(
    () => initial?.input ?? emptyAsset(kind, systemId),
  );
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
          <option value="">Nessun collegamento</option>
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
    <form
      className="player-form"
      aria-label={
        details.kind === "item" ? "Dettagli oggetto" : "Dettagli capacità"
      }
      onSubmit={(e) => {
        e.preventDefault();
        void onSave(input);
      }}
    >
      <fieldset disabled={busy}>
        <legend>
          {initial ? "Modifica" : "Aggiungi"}{" "}
          {details.kind === "item"
            ? "oggetto"
            : details.kind === "spell"
              ? "incantesimo"
              : "capacità"}
        </legend>
        <div className="player-fields">
          <TextField
            label="Nome della voce"
            autoFocus
            value={details.name}
            required
            onChange={(name) => change({ ...details, name })}
          />
          {details.kind === "item" ? (
            <>
              <NumberField
                label="Quantità"
                value={details.quantity}
                onChange={(quantity) =>
                  change({ ...details, quantity: quantity ?? 0 })
                }
              />
              <TextField
                label="Categoria oggetto"
                value={details.category}
                max={100}
                onChange={(category) => change({ ...details, category })}
              />
              <NumberField
                label="Peso (unità personale, facoltativo)"
                value={details.weight}
                optional
                decimal
                onChange={(weight) => change({ ...details, weight })}
              />
              <TextField
                label="Valore o valuta (testo libero)"
                value={details.value}
                onChange={(value) => change({ ...details, value })}
              />
              <div className="player-flags">
                <Flag
                  label="Equipaggiato"
                  value={details.equipped}
                  onChange={(equipped) => change({ ...details, equipped })}
                />
                <Flag
                  label="Consumabile"
                  value={details.consumable}
                  onChange={(consumable) => change({ ...details, consumable })}
                />
              </div>
            </>
          ) : (
            <>
              <TextField
                label="Regolamento della capacità"
                value={details.systemId}
                max={80}
                required
                onChange={(systemId) => change({ ...details, systemId })}
              />
              <TextField
                label="Livello o rango (testo libero)"
                value={details.rank}
                onChange={(rank) => change({ ...details, rank })}
              />
              <TextField
                label="Scuola o tradizione"
                value={details.school}
                onChange={(school) => change({ ...details, school })}
              />
              <TextField
                label="Tempo di attivazione"
                value={details.castingTime}
                onChange={(castingTime) => change({ ...details, castingTime })}
              />
              <TextField
                label="Durata"
                value={details.duration}
                onChange={(duration) => change({ ...details, duration })}
              />
              <TextField
                label="Portata"
                value={details.range}
                onChange={(range) => change({ ...details, range })}
              />
              <TextField
                label="Componenti"
                value={details.components}
                onChange={(components) => change({ ...details, components })}
              />
              <div className="player-flags">
                <Flag
                  label="Conosciuta"
                  value={details.known}
                  onChange={(known) => change({ ...details, known })}
                />
                <Flag
                  label="Preparata"
                  value={details.prepared}
                  onChange={(prepared) => change({ ...details, prepared })}
                />
              </div>
            </>
          )}
        </div>
        <TextField
          label="Descrizione"
          value={details.description}
          max={16000}
          multiline
          onChange={(description) => change({ ...details, description })}
        />
        <TextField
          label="Note della voce"
          value={details.notes}
          max={16000}
          multiline
          onChange={(notes) => change({ ...details, notes })}
        />
        <h4>Collegamenti e provenienza</h4>
        <p className="muted">
          Collega pagine e sessioni della campagna. Per aggiungere un PNG, un
          luogo o una missione, crea prima la pagina nel Codex.
        </p>
        <div className="player-fields">
          {pageSelector("Pagina della voce nel Codex", "pageId")}
          <label>
            Sessione fonte
            <select
              aria-label="Sessione fonte"
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
              <option value="">Nessuna sessione</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  Sessione {s.sequence}: {s.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Blocco fonte
            <select
              aria-label="Blocco fonte"
              disabled={!source}
              value={links.sourceBlockId ?? ""}
              onChange={(e) => link("sourceBlockId", e.target.value || null)}
            >
              <option value="">Intera sessione</option>
              {links.sourceBlockId &&
              !blocks.some((b) => b.id === links.sourceBlockId) ? (
                <option value={links.sourceBlockId}>
                  Blocco non più presente (riferimento conservato)
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
              {pageSelector("PNG collegato", "npcId", "npc")}
              {pageSelector("Luogo collegato", "placeId", "place")}
              {pageSelector("Missione collegata", "questId", "quest")}
            </>
          ) : null}
        </div>
        <TextField
          label="Note di provenienza"
          value={links.provenanceNotes}
          max={4000}
          multiline
          onChange={(v) => link("provenanceNotes", v)}
        />
        <div className="actions">
          <button className="primary" disabled={!details.name.trim()}>
            Salva voce
          </button>
          <button type="button" onClick={onCancel}>
            Annulla modifiche
          </button>
        </div>
      </fieldset>
    </form>
  );
}
