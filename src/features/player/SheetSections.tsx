import { Text } from "../../i18n/Text";
import { tr } from "../../i18n/store";
import { Flag, NumberField, TextField } from "./fields";
import { sheetSections, type SheetDetails, type SheetField } from "./sheet";

const longFields = new Set([
  "background",
  "armor",
  "resistances",
  "appearance",
  "personality",
  "ideals",
  "bonds",
  "flaws",
  "allies",
  "enemies",
  "proficiencies",
  "languages",
  "ancestryTraits",
  "classFeatures",
  "feats",
  "gems",
  "valuables",
  "mount",
  "encumbrance",
]);
export function SheetEditor({
  value,
  onChange,
}: {
  value: SheetDetails;
  onChange: (value: SheetDetails) => void;
}) {
  return (
    <div className="sheet-sections">
      <p className="muted">
        <Text
          source={
            "Open the sections you use. Values and units are manual; nothing is calculated or converted automatically."
          }
        />
      </p>
      {sheetSections.map((section) => (
        <details key={section.title}>
          <summary>{section.title}</summary>
          <div className="player-fields">
            {Object.entries(section.fields).map(([key, label]) => (
              <TextField
                key={key}
                label={label}
                value={value.fields[key as SheetField] ?? ""}
                max={4000}
                multiline={longFields.has(key)}
                onChange={(v) =>
                  onChange({ ...value, fields: { ...value.fields, [key]: v } })
                }
              />
            ))}
          </div>
          {"armorClass" in section.fields ? (
            <div className="player-fields">
              <Flag
                label={tr("Inspiration")}
                value={value.inspiration}
                onChange={(inspiration) => onChange({ ...value, inspiration })}
              />
              <NumberField
                label={tr("Death save successes")}
                value={value.deathSuccesses}
                max={3}
                onChange={(n) => onChange({ ...value, deathSuccesses: n ?? 0 })}
              />
              <NumberField
                label={tr("Death save failures")}
                value={value.deathFailures}
                max={3}
                onChange={(n) => onChange({ ...value, deathFailures: n ?? 0 })}
              />
            </div>
          ) : null}
        </details>
      ))}
      <details>
        <summary>
          <Text source={"Weapons, attacks and ammunition ("} />
          {value.attacks.length})
        </summary>
        {value.attacks.map((attack, index) => (
          <fieldset className="sheet-attack" key={attack.id}>
            <legend>
              <Text source={"Attack "} />
              {index + 1}
            </legend>
            <div className="player-fields">
              {Object.entries({
                name: tr("Weapon or attack"),
                bonus: tr("Attack bonus"),
                damage: tr("Damage and type"),
                range: tr("Range"),
                weight: tr("Weapon weight"),
                ammunition: tr("Ammunition"),
              }).map(([key, label]) => (
                <TextField
                  key={key}
                  label={tr("{0} {1}", [label, index + 1])}
                  value={attack[key as keyof typeof attack]}
                  required={key === "name"}
                  onChange={(v) =>
                    onChange({
                      ...value,
                      attacks: value.attacks.map((a) =>
                        a.id === attack.id ? { ...a, [key]: v } : a,
                      ),
                    })
                  }
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...value,
                  attacks: value.attacks.filter((a) => a.id !== attack.id),
                })
              }
            >
              <Text source={"Remove attack "} />
              {index + 1}
            </button>
          </fieldset>
        ))}
        <button
          type="button"
          disabled={value.attacks.length >= 30}
          onClick={() =>
            onChange({
              ...value,
              attacks: [
                ...value.attacks,
                {
                  id: crypto.randomUUID(),
                  name: "",
                  bonus: "",
                  damage: "",
                  range: "",
                  weight: "",
                  ammunition: "",
                },
              ],
            })
          }
        >
          <Text source={"Add attack"} />
        </button>
      </details>
    </div>
  );
}
export function SheetSummary({ value }: { value: SheetDetails }) {
  return (
    <div className="sheet-sections">
      {sheetSections.map((section) => (
        <details key={section.title} open={"armorClass" in section.fields}>
          <summary>{section.title}</summary>
          <dl className="sheet-summary">
            {Object.entries(section.fields)
              .filter(([key]) => value.fields[key as SheetField])
              .map(([key, label]) => (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd className="player-text">
                    {value.fields[key as SheetField]}
                  </dd>
                </div>
              ))}
          </dl>
          {!Object.keys(section.fields).some(
            (key) => value.fields[key as SheetField],
          ) ? (
            <p className="muted">
              <Text source={"No values noted in this section."} />
            </p>
          ) : null}
          {"armorClass" in section.fields ? (
            <p>
              <Text source={"Inspiration: "} />
              {value.inspiration ? tr("Yes") : tr("No")}{" "}
              <Text source={" · Death saves: "} />
              {value.deathSuccesses} <Text source={" successes / "} />
              {value.deathFailures} <Text source={" failures"} />
            </p>
          ) : null}
        </details>
      ))}
      <details open={value.attacks.length > 0}>
        <summary>
          <Text source={"Weapons and ammunition ("} />
          {value.attacks.length})
        </summary>
        {value.attacks.map((a) => (
          <article className="sheet-attack" key={a.id}>
            <h5>{a.name}</h5>
            <p>
              <Text source={"Attack "} />
              {a.bonus || "—"} <Text source={" · Damage "} />
              {a.damage || "—"} <Text source={" · Range"} /> {a.range || "—"}
            </p>
            <p>
              <Text source={"Weight "} />
              {a.weight || "—"} <Text source={" · Ammunition "} />
              {a.ammunition || "—"}
            </p>
          </article>
        ))}
        {!value.attacks.length ? (
          <p className="muted">
            <Text source={"No attacks noted."} />
          </p>
        ) : null}
      </details>
    </div>
  );
}
