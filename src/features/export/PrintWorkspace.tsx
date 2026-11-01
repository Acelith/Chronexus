import CatalogSourceNote from "../player/CatalogSourceNote";
import type { AssetDetails } from "../player/api";
import { trainingLabels } from "../player/sheet";
import { useState } from "react";
import { createPortal } from "react-dom";
import { tr } from "../../i18n/store";
import { errorMessage, type Session } from "../journal/api";
import type { KnowledgePage } from "../knowledge/api";
import { playerApi, type Character, type Asset } from "../player/api";
import { sheetSections } from "../player/sheet";
import { documentText } from "../recap/text";
export default function PrintWorkspace({
  campaignId,
  sessions,
  pages,
}: {
  campaignId: string;
  sessions: Session[];
  pages: KnowledgePage[];
}) {
  const [selected, setSelected] = useState<string[]>([]),
    [sheet, setSheet] = useState(false),
    [character, setCharacter] = useState<Character | null>(null),
    [assets, setAssets] = useState<Asset[]>([]),
    [preview, setPreview] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const toggle = (id: string) => {
    setPreview(false);
    setSelected((v) =>
      v.includes(id) ? v.filter((x) => x !== id) : [...v, id],
    );
  };
  return (
    <details className="print-controls">
      <summary>{tr("Print and PDF")}</summary>
      <p>
        {tr(
          "Select only the content to include. Save as PDF from the system print dialog.",
        )}
      </p>
      <label>
        <input
          type="checkbox"
          checked={sheet}
          onChange={(e) => {
            setSheet(e.target.checked);
            setPreview(false);
          }}
        />
        {tr("Character sheet")}
      </label>
      <fieldset>
        <legend>{tr("Sessions")}</legend>
        {sessions.map((s) => (
          <label key={s.id}>
            <input
              type="checkbox"
              checked={selected.includes(s.id)}
              onChange={() => toggle(s.id)}
            />
            {s.sequence}: {s.title}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>{tr("Codex pages")}</legend>
        {pages.map((p) => (
          <label key={p.id}>
            <input
              type="checkbox"
              checked={selected.includes(p.id)}
              onChange={() => toggle(p.id)}
            />
            {p.title}
          </label>
        ))}
      </fieldset>
      <button
        disabled={busy || (!sheet && !selected.length)}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            if (sheet) {
              const c = await playerApi.character(campaignId);
              if (!c)
                throw new Error(tr("No character created for this campaign."));
              setCharacter(c);
              setAssets(await playerApi.assets(campaignId, c.id));
            }
            setPreview(true);
          } catch (e) {
            setError(errorMessage(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {tr("Preview")}
      </button>
      {error && <p role="alert">{error}</p>}
      {preview && (
        <>
          <button onClick={() => window.print()}>{tr("Print and PDF")}</button>
          <div className="print-preview">
            <PrintContent />
          </div>
          {createPortal(
            <article className="chronexus-print">
              <PrintContent />
            </article>,
            document.body,
          )}
        </>
      )}
    </details>
  );
  function PrintContent() {
    return (
      <>
        {sheet && character && (
          <section>
            <h1>{character.data.name}</h1>
            <p>
              {character.data.ancestry} · {character.data.vocation} ·{" "}
              {character.data.systemId}
            </p>
            <dl>
              {[
                [tr("Level"), character.data.level],
                [tr("Experience"), character.data.experience],
                [
                  tr("Hit points"),
                  `${character.data.hpCurrent}/${character.data.hpMaximum} (+${character.data.hpTemporary})`,
                ],
                [tr("Conditions"), character.data.conditions],
                [tr("Notes"), character.data.notes],
              ].map(([k, v]) => (
                <div key={String(k)}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
              {character.data.stats.map((s) => (
                <div key={s.id}>
                  <dt>{s.label}</dt>
                  <dd>
                    {s.value} {s.modifier}{" "}
                    {s.training ? trainingLabels[s.training] : ""}
                  </dd>
                </div>
              ))}
              {character.data.resources.map((r) => (
                <div key={r.id}>
                  <dt>{r.label}</dt>
                  <dd>
                    {r.current}/{r.maximum}
                  </dd>
                </div>
              ))}
            </dl>
            {sheetSections.map((section) => (
              <section key={section.title}>
                <h2>{section.title}</h2>
                <dl>
                  {Object.entries(section.fields).map(([key, label]) => (
                    <div key={key}>
                      <dt>{label}</dt>
                      <dd>
                        {
                          character.data.sheet.fields[
                            key as keyof typeof character.data.sheet.fields
                          ]
                        }
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
            <dl>
              {[
                [
                  tr("Inspiration"),
                  character.data.sheet.inspiration ? tr("Yes") : tr("No"),
                ],
                [
                  tr("Death save successes"),
                  character.data.sheet.deathSuccesses,
                ],
                [tr("Death save failures"), character.data.sheet.deathFailures],
              ].map(([k, v]) => (
                <div key={String(k)}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <h2>{tr("Attacks")}</h2>
            {character.data.sheet.attacks.map((a) => (
              <p key={a.id}>
                {[a.name, a.bonus, a.damage, a.range, a.weight, a.ammunition]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ))}
            <h2>{tr("Equipment and spells")}</h2>
            {assets.map((a) => (
              <section key={a.id}>
                <h3>{a.input.details.name}</h3>
                <AssetFields details={a.input.details} />
                <p>{a.input.details.description}</p>
                <p>{a.input.details.notes}</p>
              </section>
            ))}
          </section>
        )}
        {sessions
          .filter((s) => selected.includes(s.id))
          .map((s) => (
            <section key={s.id}>
              <h1>
                {s.sequence}: {s.title}
              </h1>
              <p>{s.playedOn}</p>
              <div className="recap-text">{documentText(s.document)}</div>
            </section>
          ))}
        {pages
          .filter((p) => selected.includes(p.id))
          .map((p) => (
            <section key={p.id}>
              <h1>{p.title}</h1>
              <div className="recap-text">{documentText(p.document)}</div>
            </section>
          ))}
      </>
    );
  }
}

function AssetFields({ details: d }: { details: AssetDetails }) {
  const yes = (v: boolean | undefined) => (v ? tr("Yes") : tr("No"));
  const fields: (readonly [string, string | number | null | undefined])[] =
    d.kind === "item"
      ? [
          [tr("Quantity"), d.quantity],
          [tr("Location (backpack, pocket, worn…)"), d.location],
          [tr("Item category"), d.category],
          [tr("Weight (your own unit, optional)"), d.weight],
          [tr("Value or currency (free text)"), d.value],
          [tr("Equipped"), yes(d.equipped)],
          [tr("Consumable"), yes(d.consumable)],
        ]
      : [
          [tr("Ability rules system"), d.systemId],
          [tr("Level or rank (free text)"), d.rank],
          [tr("School or tradition"), d.school],
          [tr("Activation time"), d.castingTime],
          [tr("Duration"), d.duration],
          [tr("Range"), d.range],
          [tr("Components"), d.components],
          [tr("Ritual"), yes(d.ritual)],
          [tr("Concentration"), yes(d.concentration)],
          [tr("Known"), yes(d.known)],
          [tr("Prepared"), yes(d.prepared)],
        ];
  return (
    <>
      <dl>
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {d.kind !== "item" && d.catalogSource && (
        <CatalogSourceNote source={d.catalogSource} />
      )}
    </>
  );
}
