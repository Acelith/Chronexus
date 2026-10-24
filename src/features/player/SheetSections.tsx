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
            "Apri le sezioni che usi. Valori e unità di misura sono manuali; nessun calcolo o conversione automatica."
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
          {section.title === "Combattimento e sensi" ? (
            <div className="player-fields">
              <Flag
                label={tr("Ispirazione")}
                value={value.inspiration}
                onChange={(inspiration) => onChange({ ...value, inspiration })}
              />
              <NumberField
                label={tr("Successi contro morte")}
                value={value.deathSuccesses}
                max={3}
                onChange={(n) => onChange({ ...value, deathSuccesses: n ?? 0 })}
              />
              <NumberField
                label={tr("Fallimenti contro morte")}
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
          <Text source={"Armi, attacchi e munizioni ("} />
          {value.attacks.length})
        </summary>
        {value.attacks.map((attack, index) => (
          <fieldset className="sheet-attack" key={attack.id}>
            <legend>
              <Text source={"Attacco "} />
              {index + 1}
            </legend>
            <div className="player-fields">
              {Object.entries({
                name: tr("Arma o attacco"),
                bonus: tr("Bonus attacco"),
                damage: tr("Danno e tipo"),
                range: tr("Gittata"),
                weight: tr("Peso dell’arma"),
                ammunition: tr("Munizioni"),
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
              <Text source={"Rimuovi attacco "} />
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
          <Text source={"Aggiungi attacco"} />
        </button>
      </details>
    </div>
  );
}
export function SheetSummary({ value }: { value: SheetDetails }) {
  return (
    <div className="sheet-sections">
      {sheetSections.map((section) => (
        <details
          key={section.title}
          open={section.title === "Combattimento e sensi"}
        >
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
              <Text source={"Nessun valore annotato in questa sezione."} />
            </p>
          ) : null}
          {section.title === "Combattimento e sensi" ? (
            <p>
              <Text source={"Ispirazione: "} />
              {value.inspiration ? tr("sì") : "no"}{" "}
              <Text source={" · Tiri contro morte: "} />
              {value.deathSuccesses} <Text source={" successi / "} />
              {value.deathFailures} <Text source={" fallimenti"} />
            </p>
          ) : null}
        </details>
      ))}
      <details open={value.attacks.length > 0}>
        <summary>
          <Text source={"Armi e munizioni ("} />
          {value.attacks.length})
        </summary>
        {value.attacks.map((a) => (
          <article className="sheet-attack" key={a.id}>
            <h5>{a.name}</h5>
            <p>
              <Text source={"Attacco "} />
              {a.bonus || "—"} <Text source={" · Danno "} />
              {a.damage || "—"} <Text source={" · Gittata"} /> {a.range || "—"}
            </p>
            <p>
              <Text source={"Peso "} />
              {a.weight || "—"} <Text source={" · Munizioni "} />
              {a.ammunition || "—"}
            </p>
          </article>
        ))}
        {!value.attacks.length ? (
          <p className="muted">
            <Text source={"Nessun attacco annotato."} />
          </p>
        ) : null}
      </details>
    </div>
  );
}
