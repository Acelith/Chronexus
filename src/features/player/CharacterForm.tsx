import { tr } from "../../i18n/store";
import { Text } from "../../i18n/Text";
import { useState } from "react";
import {
  emptyCharacter,
  statGroups,
  type Character,
  type CharacterInput,
} from "./api";
import { NumberField, TextField } from "./fields";
import { dndPreset, emptySheet, trainingLabels } from "./sheet";
import { SheetEditor } from "./SheetSections";

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
      aria-label={initial ? tr("Modifica personaggio") : tr("Crea personaggio")}
      onSubmit={(e) => {
        e.preventDefault();
        void onSave(data);
      }}
    >
      <fieldset disabled={busy}>
        <legend>
          {initial ? tr("Modifica personaggio") : tr("Il tuo personaggio")}
        </legend>
        <p className="muted">
          <Text
            source={
              "Valori manuali. Il regolamento è un’etichetta: Chronexus non calcola formule, riposi o avanzamenti."
            }
          />
        </p>
        <div className="player-fields">
          <TextField
            label={tr("Nome del personaggio")}
            autoFocus
            value={data.name}
            required
            onChange={(v) => update("name", v)}
          />
          <TextField
            label={tr("Regolamento")}
            value={data.systemId}
            max={80}
            required
            onChange={(v) => update("systemId", v)}
          />
          <TextField
            label={tr("Origine o specie")}
            value={data.ancestry}
            onChange={(v) => update("ancestry", v)}
          />
          <TextField
            label={tr("Classe o vocazione")}
            value={data.vocation}
            onChange={(v) => update("vocation", v)}
          />
          <NumberField
            label={tr("Livello (facoltativo)")}
            value={data.level}
            optional
            onChange={(v) => update("level", v)}
          />
          <NumberField
            label={tr("Esperienza (facoltativa)")}
            value={data.experience}
            optional
            onChange={(v) => update("experience", v)}
          />
        </div>
        <SheetEditor
          value={data.sheet ?? emptySheet()}
          onChange={(v) => update("sheet", v)}
        />
        <h4>
          <Text source={"Punti vita"} />
        </h4>
        <div className="player-fields">
          <NumberField
            label={tr("PF massimi")}
            value={data.hpMaximum}
            onChange={(v) => update("hpMaximum", v ?? 0)}
          />
          <NumberField
            label={tr("PF attuali")}
            value={data.hpCurrent}
            max={data.hpMaximum}
            onChange={(v) => update("hpCurrent", v ?? 0)}
          />
          <NumberField
            label={tr("PF temporanei")}
            value={data.hpTemporary}
            onChange={(v) => update("hpTemporary", v ?? 0)}
          />
        </div>
        <h4>
          <Text source={"Statistiche configurabili"} />
        </h4>
        <button type="button" onClick={() => setData(dndPreset(data))}>
          <Text source={"Aggiungi campi D&D 2014"} />
        </button>
        <p className="muted">
          <Text
            source={
              "Aggiunge le sei caratteristiche, i tiri salvezza e le abilità mancanti, senza modificare i valori già presenti."
            }
          />
        </p>
        <details open={data.stats.length < 5}>
          <summary>
            <Text source={"Modifica statistiche ("} />
            {data.stats.length})
          </summary>
          <p className="muted">
            <Text
              source={
                "Aggiungi caratteristiche, abilità, tiri, difese e movimento con le etichette del tuo sistema."
              }
            />
          </p>
          {data.stats.map((stat, index) => (
            <div className="player-edit-row" key={stat.id}>
              <TextField
                label={tr("Statistica {0}: nome", [index + 1])}
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
                <Text source={"Categoria"} />
                <select
                  aria-label={tr("Statistica {0}: categoria", [index + 1])}
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
                label={tr("Statistica {0}: valore", [index + 1])}
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
                <Text source={"Rimuovi statistica "} />
                {index + 1}
              </button>
              {stat.group === "ability" ? (
                <TextField
                  label={tr("Statistica {0}: modificatore", [index + 1])}
                  value={stat.modifier ?? ""}
                  onChange={(modifier) =>
                    update(
                      "stats",
                      data.stats.map((s) =>
                        s.id === stat.id ? { ...s, modifier } : s,
                      ),
                    )
                  }
                />
              ) : null}
              {stat.group === "skill" || stat.group === "save" ? (
                <label>
                  <Text source={"Competenza"} />
                  <select
                    aria-label={tr("Statistica {0}: competenza", [index + 1])}
                    value={stat.training ?? "none"}
                    onChange={(e) =>
                      update(
                        "stats",
                        data.stats.map((s) =>
                          s.id === stat.id
                            ? {
                                ...s,
                                training: e.target
                                  .value as typeof stat.training,
                              }
                            : s,
                        ),
                      )
                    }
                  >
                    {Object.entries(trainingLabels).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          ))}
          <button
            type="button"
            disabled={data.stats.length >= 100}
            onClick={() =>
              update("stats", [
                ...data.stats,
                {
                  id: crypto.randomUUID(),
                  label: "",
                  value: "",
                  group: "other",
                },
              ])
            }
          >
            <Text source={"Aggiungi statistica"} />
          </button>
        </details>
        <h4>
          <Text source={"Risorse e slot"} />
        </h4>
        <button
          type="button"
          disabled={data.resources.length > 41}
          onClick={() =>
            update("resources", [
              ...data.resources,
              ...Array.from({ length: 9 }, (_, i) => ({
                id: crypto.randomUUID(),
                label: `Slot ${i + 1}° livello`,
                kind: "slot" as const,
                current: 0,
                maximum: 0,
              })).filter(
                (r) => !data.resources.some((old) => old.label === r.label),
              ),
            ])
          }
        >
          <Text source={"Aggiungi slot 1°–9°"} />
        </button>
        {data.resources.map((resource, index) => (
          <div className="player-edit-row" key={resource.id}>
            <TextField
              label={tr("Risorsa {0}: nome", [index + 1])}
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
              <Text source={"Tipo"} />
              <select
                aria-label={tr("Risorsa {0}: tipo", [index + 1])}
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
                <option value="resource">{tr("Risorsa")}</option>
                <option value="slot">{tr("Slot")}</option>
              </select>
            </label>
            <NumberField
              label={tr("Risorsa {0}: massimo", [index + 1])}
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
              label={tr("Risorsa {0}: attuale", [index + 1])}
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
              <Text source={"Rimuovi risorsa "} />
              {index + 1}
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
          <Text source={"Aggiungi risorsa"} />
        </button>
        <TextField
          label={tr("Condizioni")}
          value={data.conditions}
          max={2000}
          multiline
          onChange={(v) => update("conditions", v)}
        />
        <TextField
          label={tr("Note del personaggio")}
          value={data.notes}
          max={16000}
          multiline
          onChange={(v) => update("notes", v)}
        />
        <div className="actions">
          <button className="primary" disabled={!data.name.trim()}>
            <Text source={"Salva personaggio"} />
          </button>
          <button type="button" onClick={onCancel}>
            <Text source={"Annulla modifiche"} />
          </button>
        </div>
      </fieldset>
    </form>
  );
}
