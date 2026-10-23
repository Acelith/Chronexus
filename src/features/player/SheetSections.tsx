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
        Apri le sezioni che usi. Valori e unità di misura sono manuali; nessun
        calcolo o conversione automatica.
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
                label="Ispirazione"
                value={value.inspiration}
                onChange={(inspiration) => onChange({ ...value, inspiration })}
              />
              <NumberField
                label="Successi contro morte"
                value={value.deathSuccesses}
                max={3}
                onChange={(n) => onChange({ ...value, deathSuccesses: n ?? 0 })}
              />
              <NumberField
                label="Fallimenti contro morte"
                value={value.deathFailures}
                max={3}
                onChange={(n) => onChange({ ...value, deathFailures: n ?? 0 })}
              />
            </div>
          ) : null}
        </details>
      ))}
      <details>
        <summary>Armi, attacchi e munizioni ({value.attacks.length})</summary>
        {value.attacks.map((attack, index) => (
          <fieldset className="sheet-attack" key={attack.id}>
            <legend>Attacco {index + 1}</legend>
            <div className="player-fields">
              {Object.entries({
                name: "Arma o attacco",
                bonus: "Bonus attacco",
                damage: "Danno e tipo",
                range: "Gittata",
                weight: "Peso dell’arma",
                ammunition: "Munizioni",
              }).map(([key, label]) => (
                <TextField
                  key={key}
                  label={`${label} ${index + 1}`}
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
              Rimuovi attacco {index + 1}
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
          Aggiungi attacco
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
            <p className="muted">Nessun valore annotato in questa sezione.</p>
          ) : null}
          {section.title === "Combattimento e sensi" ? (
            <p>
              Ispirazione: {value.inspiration ? "sì" : "no"} · Tiri contro
              morte: {value.deathSuccesses} successi / {value.deathFailures}{" "}
              fallimenti
            </p>
          ) : null}
        </details>
      ))}
      <details open={value.attacks.length > 0}>
        <summary>Armi e munizioni ({value.attacks.length})</summary>
        {value.attacks.map((a) => (
          <article className="sheet-attack" key={a.id}>
            <h5>{a.name}</h5>
            <p>
              Attacco {a.bonus || "—"} · Danno {a.damage || "—"} · Gittata{" "}
              {a.range || "—"}
            </p>
            <p>
              Peso {a.weight || "—"} · Munizioni {a.ammunition || "—"}
            </p>
          </article>
        ))}
        {!value.attacks.length ? (
          <p className="muted">Nessun attacco annotato.</p>
        ) : null}
      </details>
    </div>
  );
}
