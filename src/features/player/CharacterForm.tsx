import { useState } from "react";
import {
  emptyCharacter,
  statGroups,
  type Character,
  type CharacterInput,
} from "./api";
import { NumberField, TextField } from "./fields";

export default function CharacterForm({
  initial,
  busy,
  onSave,
  onCancel,
}: {
  initial: Character | null;
  busy: boolean;
  onSave: (input: CharacterInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [data, setData] = useState<CharacterInput>(
    () => initial?.data ?? emptyCharacter(),
  );
  const update = <K extends keyof CharacterInput>(
    key: K,
    value: CharacterInput[K],
  ) => setData({ ...data, [key]: value });
  return (
    <form
      className="player-form"
      aria-label={initial ? "Modifica personaggio" : "Crea personaggio"}
      onSubmit={(e) => {
        e.preventDefault();
        void onSave(data);
      }}
    >
      <fieldset disabled={busy}>
        <legend>
          {initial ? "Modifica personaggio" : "Il tuo personaggio"}
        </legend>
        <p className="muted">
          Valori manuali. Il regolamento è un’etichetta: Chronexus non calcola
          formule, riposi o avanzamenti.
        </p>
        <div className="player-fields">
          <TextField
            label="Nome del personaggio"
            autoFocus
            value={data.name}
            required
            onChange={(v) => update("name", v)}
          />
          <TextField
            label="Regolamento"
            value={data.systemId}
            max={80}
            required
            onChange={(v) => update("systemId", v)}
          />
          <TextField
            label="Origine o specie"
            value={data.ancestry}
            onChange={(v) => update("ancestry", v)}
          />
          <TextField
            label="Classe o vocazione"
            value={data.vocation}
            onChange={(v) => update("vocation", v)}
          />
          <NumberField
            label="Livello (facoltativo)"
            value={data.level}
            optional
            onChange={(v) => update("level", v)}
          />
          <NumberField
            label="Esperienza (facoltativa)"
            value={data.experience}
            optional
            onChange={(v) => update("experience", v)}
          />
        </div>
        <h4>Punti vita</h4>
        <div className="player-fields">
          <NumberField
            label="PF massimi"
            value={data.hpMaximum}
            onChange={(v) => update("hpMaximum", v ?? 0)}
          />
          <NumberField
            label="PF attuali"
            value={data.hpCurrent}
            max={data.hpMaximum}
            onChange={(v) => update("hpCurrent", v ?? 0)}
          />
          <NumberField
            label="PF temporanei"
            value={data.hpTemporary}
            onChange={(v) => update("hpTemporary", v ?? 0)}
          />
        </div>
        <h4>Statistiche configurabili</h4>
        <p className="muted">
          Aggiungi caratteristiche, abilità, tiri, difese e movimento con le
          etichette del tuo sistema.
        </p>
        {data.stats.map((stat, index) => (
          <div className="player-edit-row" key={stat.id}>
            <TextField
              label={`Statistica ${index + 1}: nome`}
              value={stat.label}
              required
              onChange={(v) =>
                update(
                  "stats",
                  data.stats.map((s) =>
                    s.id === stat.id ? { ...s, label: v } : s,
                  ),
                )
              }
            />
            <label>
              Categoria
              <select
                aria-label={`Statistica ${index + 1}: categoria`}
                value={stat.group}
                onChange={(e) =>
                  update(
                    "stats",
                    data.stats.map((s) =>
                      s.id === stat.id
                        ? {
                            ...s,
                            group: e.target.value as keyof typeof statGroups,
                          }
                        : s,
                    ),
                  )
                }
              >
                {Object.entries(statGroups).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <TextField
              label={`Statistica ${index + 1}: valore`}
              value={stat.value}
              onChange={(v) =>
                update(
                  "stats",
                  data.stats.map((s) =>
                    s.id === stat.id ? { ...s, value: v } : s,
                  ),
                )
              }
            />
            <button
              type="button"
              onClick={() =>
                update(
                  "stats",
                  data.stats.filter((s) => s.id !== stat.id),
                )
              }
            >
              Rimuovi statistica {index + 1}
            </button>
          </div>
        ))}
        <button
          type="button"
          disabled={data.stats.length >= 100}
          onClick={() =>
            update("stats", [
              ...data.stats,
              { id: crypto.randomUUID(), label: "", value: "", group: "other" },
            ])
          }
        >
          Aggiungi statistica
        </button>
        <h4>Risorse e slot</h4>
        {data.resources.map((resource, index) => (
          <div className="player-edit-row" key={resource.id}>
            <TextField
              label={`Risorsa ${index + 1}: nome`}
              value={resource.label}
              required
              onChange={(v) =>
                update(
                  "resources",
                  data.resources.map((r) =>
                    r.id === resource.id ? { ...r, label: v } : r,
                  ),
                )
              }
            />
            <label>
              Tipo
              <select
                aria-label={`Risorsa ${index + 1}: tipo`}
                value={resource.kind}
                onChange={(e) =>
                  update(
                    "resources",
                    data.resources.map((r) =>
                      r.id === resource.id
                        ? { ...r, kind: e.target.value as "resource" | "slot" }
                        : r,
                    ),
                  )
                }
              >
                <option value="resource">Risorsa</option>
                <option value="slot">Slot</option>
              </select>
            </label>
            <NumberField
              label={`Risorsa ${index + 1}: massimo`}
              value={resource.maximum}
              onChange={(v) =>
                update(
                  "resources",
                  data.resources.map((r) =>
                    r.id === resource.id ? { ...r, maximum: v ?? 0 } : r,
                  ),
                )
              }
            />
            <NumberField
              label={`Risorsa ${index + 1}: attuale`}
              value={resource.current}
              max={resource.maximum}
              onChange={(v) =>
                update(
                  "resources",
                  data.resources.map((r) =>
                    r.id === resource.id ? { ...r, current: v ?? 0 } : r,
                  ),
                )
              }
            />
            <button
              type="button"
              onClick={() =>
                update(
                  "resources",
                  data.resources.filter((r) => r.id !== resource.id),
                )
              }
            >
              Rimuovi risorsa {index + 1}
            </button>
          </div>
        ))}
        <button
          type="button"
          disabled={data.resources.length >= 50}
          onClick={() =>
            update("resources", [
              ...data.resources,
              {
                id: crypto.randomUUID(),
                label: "",
                kind: "resource",
                current: 0,
                maximum: 0,
              },
            ])
          }
        >
          Aggiungi risorsa
        </button>
        <TextField
          label="Condizioni"
          value={data.conditions}
          max={2000}
          multiline
          onChange={(v) => update("conditions", v)}
        />
        <TextField
          label="Note del personaggio"
          value={data.notes}
          max={16000}
          multiline
          onChange={(v) => update("notes", v)}
        />
        <div className="actions">
          <button className="primary" disabled={!data.name.trim()}>
            Salva personaggio
          </button>
          <button type="button" onClick={onCancel}>
            Annulla modifiche
          </button>
        </div>
      </fieldset>
    </form>
  );
}
