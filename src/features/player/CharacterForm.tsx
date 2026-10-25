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
      aria-label={initial ? tr("Edit character") : tr("Create character")}
      onSubmit={(e) => {
        e.preventDefault();
        void onSave(data);
      }}
    >
      <fieldset disabled={busy}>
        <legend>{initial ? tr("Edit character") : tr("Your character")}</legend>
        <p className="muted">
          <Text
            source={
              "Manual values. The rules system is a label: Chronexus does not calculate formulas, rests or advancement."
            }
          />
        </p>
        <div className="player-fields">
          <TextField
            label={tr("Character name")}
            autoFocus
            value={data.name}
            required
            onChange={(v) => update("name", v)}
          />
          <TextField
            label={tr("Rules system")}
            value={data.systemId}
            max={80}
            required
            onChange={(v) => update("systemId", v)}
          />
          <TextField
            label={tr("Origin or species")}
            value={data.ancestry}
            onChange={(v) => update("ancestry", v)}
          />
          <TextField
            label={tr("Class or calling")}
            value={data.vocation}
            onChange={(v) => update("vocation", v)}
          />
          <NumberField
            label={tr("Level (optional)")}
            value={data.level}
            optional
            onChange={(v) => update("level", v)}
          />
          <NumberField
            label={tr("Experience (optional)")}
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
          <Text source={"Hit points"} />
        </h4>
        <div className="player-fields">
          <NumberField
            label={tr("Maximum HP")}
            value={data.hpMaximum}
            onChange={(v) => update("hpMaximum", v ?? 0)}
          />
          <NumberField
            label={tr("Current HP")}
            value={data.hpCurrent}
            max={data.hpMaximum}
            onChange={(v) => update("hpCurrent", v ?? 0)}
          />
          <NumberField
            label={tr("Temporary HP")}
            value={data.hpTemporary}
            onChange={(v) => update("hpTemporary", v ?? 0)}
          />
        </div>
        <h4>
          <Text source={"Configurable statistics"} />
        </h4>
        <button type="button" onClick={() => setData(dndPreset(data))}>
          <Text source={"Add D&D 2014 fields"} />
        </button>
        <p className="muted">
          <Text
            source={
              "Adds the six ability scores, saving throws and missing skills without changing existing values."
            }
          />
        </p>
        <details open={data.stats.length < 5}>
          <summary>
            <Text source={"Edit statistics ("} />
            {data.stats.length})
          </summary>
          <p className="muted">
            <Text
              source={
                "Add ability scores, skills, rolls, defenses and movement with your system's labels."
              }
            />
          </p>
          {data.stats.map((stat, index) => (
            <div className="player-edit-row" key={stat.id}>
              <TextField
                label={tr("Statistic {0}: name", [index + 1])}
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
                <Text source={"Category"} />
                <select
                  aria-label={tr("Statistic {0}: category", [index + 1])}
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
                label={tr("Statistic {0}: value", [index + 1])}
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
                <Text source={"Remove statistic "} />
                {index + 1}
              </button>
              {stat.group === "ability" ? (
                <TextField
                  label={tr("Statistic {0}: modifier", [index + 1])}
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
                  <Text source={"Proficiency"} />
                  <select
                    aria-label={tr("Statistic {0}: proficiency", [index + 1])}
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
            <Text source={"Add statistic"} />
          </button>
        </details>
        <h4>
          <Text source={"Resources and slots"} />
        </h4>
        <button
          type="button"
          disabled={data.resources.length > 41}
          onClick={() =>
            update("resources", [
              ...data.resources,
              ...Array.from({ length: 9 }, (_, i) => ({
                id: crypto.randomUUID(),
                label: `Level ${i + 1} slots`,
                kind: "slot" as const,
                current: 0,
                maximum: 0,
              })).filter(
                (r) => !data.resources.some((old) => old.label === r.label),
              ),
            ])
          }
        >
          <Text source={"Add 1st–9th level slots"} />
        </button>
        {data.resources.map((resource, index) => (
          <div className="player-edit-row" key={resource.id}>
            <TextField
              label={tr("Resource {0}: name", [index + 1])}
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
              <Text source={"Type"} />
              <select
                aria-label={tr("Resource {0}: type", [index + 1])}
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
                <option value="resource">{tr("Resource")}</option>
                <option value="slot">{tr("Slots")}</option>
              </select>
            </label>
            <NumberField
              label={tr("Resource {0}: maximum", [index + 1])}
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
              label={tr("Resource {0}: current", [index + 1])}
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
              <Text source={"Remove resource "} />
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
          <Text source={"Add resource"} />
        </button>
        <TextField
          label={tr("Conditions")}
          value={data.conditions}
          max={2000}
          multiline
          onChange={(v) => update("conditions", v)}
        />
        <TextField
          label={tr("Character notes")}
          value={data.notes}
          max={16000}
          multiline
          onChange={(v) => update("notes", v)}
        />
        <div className="actions">
          <button className="primary" disabled={!data.name.trim()}>
            <Text source={"Save character"} />
          </button>
          <button type="button" onClick={onCancel}>
            <Text source={"Discard changes"} />
          </button>
        </div>
      </fieldset>
    </form>
  );
}
