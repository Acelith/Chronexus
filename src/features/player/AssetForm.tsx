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
import CatalogSourceNote from "./CatalogSourceNote";
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
          <option value="">{tr("No links")}</option>
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
              <Text source={"Opening catalog…"} />
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
          details.kind === "item" ? tr("Item details") : tr("Ability details")
        }
        onSubmit={(e) => {
          e.preventDefault();
          void onSave(input);
        }}
      >
        <fieldset disabled={busy || lookup}>
          <legend>
            {initial ? tr("Edit") : tr("Add")}{" "}
            {details.kind === "item"
              ? "oggetto"
              : details.kind === "spell"
                ? "incantesimo"
                : tr("ability")}
          </legend>
          {details.kind === "spell" ? (
            <>
              <p className="muted">
                <Text
                  source={
                    "Write a custom spell or search for an English name in the SRD 2014 catalog. “Use this data in the form” replaces the spell name and fields; notes, markers and links are kept. Saving stays explicit."
                  }
                />
              </p>
              <button type="button" onClick={() => setLookup((v) => !v)}>
                <Text source={"Search this name in D&D"} />
              </button>
            </>
          ) : null}
          <div className="player-fields">
            <TextField
              label={tr("Entry name")}
              autoFocus
              value={details.name}
              required
              onChange={(name) => change({ ...details, name })}
            />
            {details.kind === "item" ? (
              <>
                <NumberField
                  label={tr("Quantity")}
                  value={details.quantity}
                  onChange={(quantity) =>
                    change({ ...details, quantity: quantity ?? 0 })
                  }
                />
                <TextField
                  label={tr("Location (backpack, pocket, worn…)")}
                  value={details.location ?? ""}
                  onChange={(location) => change({ ...details, location })}
                />
                <TextField
                  label={tr("Item category")}
                  value={details.category}
                  max={100}
                  onChange={(category) => change({ ...details, category })}
                />
                <NumberField
                  label={tr("Weight (your own unit, optional)")}
                  value={details.weight}
                  optional
                  decimal
                  onChange={(weight) => change({ ...details, weight })}
                />
                <TextField
                  label={tr("Value or currency (free text)")}
                  value={details.value}
                  onChange={(value) => change({ ...details, value })}
                />
                <div className="player-flags">
                  <Flag
                    label={tr("Equipped")}
                    value={details.equipped}
                    onChange={(equipped) => change({ ...details, equipped })}
                  />
                  <Flag
                    label={tr("Consumable")}
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
                  label={tr("Ability rules system")}
                  value={details.systemId}
                  max={80}
                  required
                  onChange={(systemId) => change({ ...details, systemId })}
                />
                <TextField
                  label={tr("Level or rank (free text)")}
                  value={details.rank}
                  onChange={(rank) => change({ ...details, rank })}
                />
                <TextField
                  label={tr("School or tradition")}
                  value={details.school}
                  onChange={(school) => change({ ...details, school })}
                />
                <TextField
                  label={tr("Activation time")}
                  value={details.castingTime}
                  onChange={(castingTime) =>
                    change({ ...details, castingTime })
                  }
                />
                <TextField
                  label={tr("Duration")}
                  value={details.duration}
                  onChange={(duration) => change({ ...details, duration })}
                />
                <TextField
                  label={tr("Range")}
                  value={details.range}
                  onChange={(range) => change({ ...details, range })}
                />
                <TextField
                  label={tr("Components")}
                  value={details.components}
                  onChange={(components) => change({ ...details, components })}
                />
                <Flag
                  label={tr("Ritual")}
                  value={details.ritual ?? false}
                  onChange={(ritual) => change({ ...details, ritual })}
                />
                <Flag
                  label={tr("Concentration")}
                  value={details.concentration ?? false}
                  onChange={(concentration) =>
                    change({ ...details, concentration })
                  }
                />
                <div className="player-flags">
                  <Flag
                    label={tr("Known")}
                    value={details.known}
                    onChange={(known) => change({ ...details, known })}
                  />
                  <Flag
                    label={tr("Prepared")}
                    value={details.prepared}
                    onChange={(prepared) => change({ ...details, prepared })}
                  />
                </div>
              </>
            )}
          </div>
          <TextField
            label={tr("Description")}
            value={details.description}
            max={16000}
            multiline
            onChange={(description) => change({ ...details, description })}
          />
          <TextField
            label={tr("Entry notes")}
            value={details.notes}
            max={16000}
            multiline
            onChange={(notes) => change({ ...details, notes })}
          />
          <h4>
            <Text source={"Links and provenance"} />
          </h4>
          <p className="muted">
            <Text
              source={
                "Link campaign pages and sessions. To add an NPC, a place or a quest, create the page in the Codex first."
              }
            />
          </p>
          <div className="player-fields">
            {pageSelector(tr("Codex page of the entry"), "pageId")}
            <label>
              <Text source={"Source session"} />
              <select
                aria-label={tr("Source session")}
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
                <option value="">{tr("No sessions")}</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {tr("Session ")}
                    {s.sequence}: {s.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <Text source={"Source block"} />
              <select
                aria-label={tr("Source block")}
                disabled={!source}
                value={links.sourceBlockId ?? ""}
                onChange={(e) => link("sourceBlockId", e.target.value || null)}
              >
                <option value="">{tr("Whole session")}</option>
                {links.sourceBlockId &&
                !blocks.some((b) => b.id === links.sourceBlockId) ? (
                  <option value={links.sourceBlockId}>
                    {tr("Block no longer present (reference kept)")}
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
                {pageSelector(tr("Linked NPC"), "npcId", "npc")}
                {pageSelector(tr("Linked place"), "placeId", "place")}
                {pageSelector(tr("Linked quest"), "questId", "quest")}
              </>
            ) : null}
          </div>
          <TextField
            label={tr("Provenance notes")}
            value={links.provenanceNotes}
            max={4000}
            multiline
            onChange={(v) => link("provenanceNotes", v)}
          />
          <div className="actions">
            <button className="primary" disabled={!details.name.trim()}>
              <Text source={"Save entry"} />
            </button>
            <button type="button" onClick={onCancel}>
              <Text source={"Discard changes"} />
            </button>
          </div>
        </fieldset>
        {details.kind !== "item" && details.catalogSource ? (
          <CatalogSourceNote source={details.catalogSource} />
        ) : null}
      </form>
    </>
  );
}
