import { useContext, useState, useMemo } from "react";
import { tr, usePreferences } from "../../i18n/store";
import { OperationContext } from "../../operations";
import { playerApi } from "../player/api";
import { tablesApi, type ProjectionPreview } from "./api";
import type { BoardWidget } from "../../../vendor/table-runtime/index.js";
export default function CharacterProjection({
  campaignId,
  tableId,
  online,
  getWidget,
  ask,
}: {
  campaignId: string;
  tableId: string;
  online: boolean;
  getWidget: () => BoardWidget | null;
  ask: (title: string, lines: string[], accept: string) => Promise<boolean>;
}) {
  const [preview, setPreview] = useState<ProjectionPreview | null>(null),
    [copyName, setCopyName] = useState(false),
    [vitals, setVitals] = useState(false),
    [ac, setAc] = useState(""),
    [portrait, setPortrait] = useState(""),
    [speed, setSpeed] = useState(""),
    [unit, setUnit] = useState("ft"),
    [factor, setFactor] = useState(0.3),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const through = useContext(OperationContext),
    prefs = usePreferences();
  const number = useMemo(
    () => new Intl.NumberFormat(prefs.locale, { maximumFractionDigits: 2 }),
    [prefs.locale],
  );
  const value = Number(speed),
    feet = unit === "ft" ? value : value / factor,
    metres = unit === "m" ? value : value * factor;
  async function load() {
    setBusy(true);
    try {
      setPreview(await tablesApi.character(campaignId));
      const b = getWidget()?.snapshot;
      setFactor(
        b?.scenes.find((s) => s.id === b.activeScene)?.grid.conversion ===
          "exact"
          ? 0.3048
          : 0.3,
      );
      setError("");
    } catch {
      setError(
        tr("Table unavailable. Your journal remains available offline."),
      );
    } finally {
      setBusy(false);
    }
  }
  async function project() {
    const w = getWidget(),
      board = w?.snapshot;
    if (!w?.selected || !board || !preview) {
      setError(tr("Select your own token first."));
      return;
    }
    if (!copyName && !vitals && !portrait && !speed.trim()) return;
    if (
      !(await ask(
        tr("Copy selected character values to this token?"),
        [
          preview.name,
          ...(copyName ? [tr("Name")] : []),
          ...(vitals ? [tr("HP and optional AC")] : []),
          ...(portrait ? [tr("Portrait")] : []),
          ...(speed
            ? [`${number.format(feet)} ft · ${number.format(metres)} m`]
            : []),
        ],
        tr("Copy"),
      ))
    )
      return;
    setBusy(true);
    try {
      await tablesApi.project(campaignId, tableId, w.selected, board.revision, {
        characterId: preview.id,
        characterRevision: preview.revision,
        name: copyName,
        vitals,
        ac: ac.trim() ? Number(ac) : null,
        portrait: portrait || null,
        speed: speed.trim() ? { value: Number(speed), unit } : null,
      });
      await w.refresh();
      setError("");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : tr("Table unavailable. Your journal remains available offline."),
      );
    } finally {
      setBusy(false);
    }
  }
  async function pull() {
    await through(async () => {
      const w = getWidget(),
        board = w?.snapshot,
        local = await playerApi.character(campaignId);
      const token = board?.tokens.find((t) => t.id === w?.selected),
        hp = board?.vitals.find((v) => v.tokenId === token?.id);
      if (
        !local ||
        token?.characterId !== local.id ||
        typeof hp?.hp !== "number" ||
        typeof hp.maxHp !== "number"
      ) {
        setError(
          tr("Select a token linked to this character with visible HP."),
        );
        return;
      }
      if (
        !(await ask(
          tr("Apply token HP to the local sheet?"),
          [`${local.data.name}: ${hp.hp} / ${hp.maxHp}`],
          tr("Apply"),
        ))
      )
        return;
      setBusy(true);
      try {
        await playerApi.saveCharacter(campaignId, local, {
          ...local.data,
          hpCurrent: hp.hp,
          hpMaximum: hp.maxHp,
        });
        setError("");
      } catch {
        setError(
          tr("The character changed. Reload the sheet before retrying."),
        );
      } finally {
        setBusy(false);
      }
    });
  }
  return (
    <details>
      <summary>{tr("Character projection")}</summary>
      <p>
        {tr(
          "Choose each value explicitly. Notes, resources and the full sheet stay local.",
        )}
      </p>
      <button type="button" disabled={busy} onClick={() => void load()}>
        {tr("Review character values")}
      </button>
      {preview && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void project();
          }}
        >
          <p>
            {preview.name} · {preview.hp} / {preview.maxHp}
          </p>
          <label>
            <input
              type="checkbox"
              checked={copyName}
              onChange={(e) => setCopyName(e.target.checked)}
            />
            {tr("Name")}
          </label>
          <label>
            <input
              type="checkbox"
              checked={vitals}
              onChange={(e) => setVitals(e.target.checked)}
            />
            {tr("HP and optional AC")}
          </label>
          <label>
            {tr("Armor class")}
            <input
              type="number"
              min="0"
              max="100"
              disabled={!vitals}
              value={ac}
              onChange={(e) => setAc(e.target.value)}
            />
          </label>
          <label>
            {tr("Portrait")}
            <select
              value={portrait}
              onChange={(e) => setPortrait(e.target.value)}
            >
              <option value="">{tr("Do not copy")}</option>
              {preview.portraits.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.caption || tr("Portrait")}
                </option>
              ))}
            </select>
          </label>
          <label>
            {tr("Manual speed")}
            <input
              type="number"
              min="0"
              max="10000"
              value={speed}
              onChange={(e) => setSpeed(e.target.value)}
            />
          </label>
          <select
            aria-label={tr("Distance unit")}
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          >
            <option value="ft">ft</option>
            <option value="m">m</option>
          </select>
          {speed && (
            <output>
              {number.format(feet)} ft · {number.format(metres)} m
            </output>
          )}
          <button
            type="submit"
            disabled={
              busy ||
              !online ||
              (!copyName && !vitals && !portrait && !speed.trim())
            }
          >
            {tr("Copy selected values")}
          </button>
        </form>
      )}
      <button
        type="button"
        disabled={busy || !online}
        onClick={() =>
          void pull().catch(() =>
            setError(
              tr("The character changed. Reload the sheet before retrying."),
            ),
          )
        }
      >
        {tr("Apply token HP to the local sheet")}
      </button>
      {error && <p role="alert">{error}</p>}
    </details>
  );
}
