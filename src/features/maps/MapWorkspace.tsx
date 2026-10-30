import { useEffect, useRef, useState } from "react";
import { tr } from "../../i18n/store";
import { errorMessage, type Session } from "../journal/api";
import type { KnowledgePage } from "../knowledge/api";
import { clueApi, type Clue } from "../clues/api";
import {
  mapsApi,
  type MapImage,
  type Pin,
  type PinInput,
  type Route,
} from "./api";
import "./maps.css";

const blank = (): PinInput => ({
  sourceKind: "page",
  sourceId: "",
  label: "",
  x: 500000,
  y: 500000,
});
const coordinate = (
  event: PointerEvent | React.PointerEvent,
  rect: DOMRect,
) => ({
  x: Math.max(
    0,
    Math.min(
      1000000,
      Math.round(((event.clientX - rect.left) / rect.width) * 1000000),
    ),
  ),
  y: Math.max(
    0,
    Math.min(
      1000000,
      Math.round(((event.clientY - rect.top) / rect.height) * 1000000),
    ),
  ),
});
export default function MapWorkspace({
  campaignId,
  sessions,
  pages,
  onSession,
  onPage,
  onClue,
}: {
  campaignId: string;
  sessions: Session[];
  pages: KnowledgePage[];
  onSession: (session: Session) => void;
  onPage: (page: KnowledgePage) => void;
  onClue: (id: string) => void;
}) {
  const [images, setImages] = useState<MapImage[]>([]),
    [selected, setSelected] = useState("");
  const [url, setUrl] = useState(""),
    [pins, setPins] = useState<Pin[]>([]),
    [routes, setRoutes] = useState<Route[]>([]);
  const [clues, setClues] = useState<Clue[]>([]),
    [draft, setDraft] = useState<PinInput>(blank()),
    [editing, setEditing] = useState<Pin | null>(null);
  const [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [routeLabel, setRouteLabel] = useState("");
  const [relinkTo, setRelinkTo] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const stage = useRef<HTMLDivElement>(null),
    drag = useRef<{ pin: Pin; x: number; y: number } | null>(null);
  useEffect(() => {
    let live = true;
    Promise.all([mapsApi.images(campaignId), clueApi.list(campaignId)])
      .then(([rows, items]) => {
        if (!live) return;
        setImages(rows);
        setClues(items);
        setSelected((previous) =>
          previous && rows.some((row) => row.id === previous)
            ? previous
            : (rows[0]?.id ?? ""),
        );
      })
      .catch((e) => {
        if (live) setError(errorMessage(e));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [campaignId]);
  useEffect(() => {
    if (!selected) return;
    let live = true;
    Promise.all([
      mapsApi.image(campaignId, selected),
      mapsApi.pins(campaignId, selected),
      mapsApi.routes(campaignId, selected),
    ])
      .then(([image, items, lines]) => {
        if (live) {
          setUrl(image);
          setPins(items);
          setRoutes(lines);
        }
      })
      .catch((e) => {
        if (live) setError(errorMessage(e));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [campaignId, selected]);
  const sources = [
    ...pages.map((p) => ({ kind: "page" as const, id: p.id, title: p.title })),
    ...sessions.map((s) => ({
      kind: "session" as const,
      id: s.id,
      title: s.title,
    })),
    ...clues.map((c) => ({ kind: "clue" as const, id: c.id, title: c.title })),
  ];
  const source = (pin: Pin) =>
    sources.find(
      (s) => s.kind === pin.input.sourceKind && s.id === pin.input.sourceId,
    );
  async function refresh() {
    setPins(await mapsApi.pins(campaignId, selected));
    setRoutes(await mapsApi.routes(campaignId, selected));
  }
  async function save() {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await mapsApi.savePin(campaignId, selected, draft, editing ?? undefined);
      await refresh();
      setEditing(null);
      setDraft(blank());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!editing || !window.confirm(tr("Delete this map pin?"))) return;
    setBusy(true);
    setError("");
    try {
      await mapsApi.deletePin(campaignId, selected, editing);
      await refresh();
      setEditing(null);
      setDraft(blank());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function addRoute() {
    setBusy(true);
    setError("");
    try {
      await mapsApi.addRoute(campaignId, selected, from, to, routeLabel);
      await refresh();
      setFrom("");
      setTo("");
      setRouteLabel("");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function removeRoute(route: Route) {
    if (!window.confirm(tr("Delete this map route?"))) return;
    setBusy(true);
    setError("");
    try {
      await mapsApi.deleteRoute(campaignId, selected, route);
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function relink() {
    setBusy(true);
    setError("");
    try {
      await mapsApi.relink(campaignId, selected, relinkTo);
      setSelected(relinkTo);
      setRelinkTo("");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  function open(pin: Pin) {
    const item = source(pin);
    if (!item) return;
    if (item.kind === "page") {
      const p = pages.find((p) => p.id === item.id);
      if (p) onPage(p);
    } else if (item.kind === "session") {
      const s = sessions.find((s) => s.id === item.id);
      if (s) onSession(s);
    } else onClue(item.id);
  }
  function move(event: React.PointerEvent, pin: Pin) {
    if (busy) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pin, x: pin.input.x, y: pin.input.y };
    setEditing(pin);
    setDraft({ ...pin.input });
  }
  function moving(event: React.PointerEvent) {
    if (!drag.current || !stage.current) return;
    const next = coordinate(event, stage.current.getBoundingClientRect());
    drag.current.x = next.x;
    drag.current.y = next.y;
    setDraft((current) => ({ ...current, ...next }));
  }
  async function moved() {
    const current = drag.current;
    drag.current = null;
    if (
      !current ||
      busy ||
      (current.x === current.pin.input.x && current.y === current.pin.input.y)
    )
      return;
    setBusy(true);
    setError("");
    try {
      await mapsApi.savePin(
        campaignId,
        selected,
        { ...current.pin.input, x: current.x, y: current.y },
        current.pin,
      );
      await refresh();
      setEditing(null);
      setDraft(blank());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const chosen = images.find((image) => image.id === selected);
  return (
    <section
      className="language-settings map-workspace"
      aria-label={tr("Campaign maps")}
    >
      <h4>{tr("Campaign maps")}</h4>
      <p>
        {tr(
          "Add a map image to a Codex page, then place pins linked to campaign entries. Pins do not assert relationships.",
        )}
      </p>
      {loading && <p role="status">{tr("Opening maps…")}</p>}
      {!loading && images.length === 0 && <p>{tr("No map images yet.")}</p>}
      {images.length > 0 && (
        <>
          <label>
            {tr("Map image")}
            <select
              value={selected}
              onChange={(e) => {
                setLoading(true);
                setUrl("");
                setSelected(e.target.value);
                setEditing(null);
                setDraft(blank());
              }}
              disabled={busy}
            >
              {images.map((image) => (
                <option key={image.id} value={image.id}>
                  {image.caption}
                </option>
              ))}
            </select>
          </label>
          {url && (
            <div
              className="map-stage"
              ref={stage}
              onPointerDown={(e) => {
                if (
                  e.target === stage.current ||
                  e.target instanceof HTMLImageElement
                ) {
                  setDraft((current) => ({
                    ...current,
                    ...coordinate(e, stage.current!.getBoundingClientRect()),
                  }));
                  setEditing(null);
                }
              }}
            >
              <img
                src={url}
                alt={chosen?.caption ?? tr("Map image")}
                draggable={false}
              />
              <svg
                className="map-routes"
                aria-hidden="true"
                viewBox="0 0 1000000 1000000"
                preserveAspectRatio="none"
              >
                {routes.map((route) => {
                  const a = pins.find((p) => p.id === route.fromPinId),
                    b = pins.find((p) => p.id === route.toPinId);
                  return a && b ? (
                    <line
                      key={route.id}
                      x1={a.input.x}
                      y1={a.input.y}
                      x2={b.input.x}
                      y2={b.input.y}
                    />
                  ) : null;
                })}
              </svg>
              {pins.map((pin) => (
                <button
                  key={pin.id}
                  type="button"
                  className="map-pin"
                  style={{
                    left: `${pin.input.x / 10000}%`,
                    top: `${pin.input.y / 10000}%`,
                  }}
                  aria-label={tr("Move pin: {0}", [pin.input.label])}
                  onPointerDown={(e) => move(e, pin)}
                  onPointerMove={moving}
                  onPointerUp={() => void moved()}
                  onClick={() => {
                    setEditing(pin);
                    setDraft(pin.input);
                  }}
                  disabled={busy}
                >
                  {pin.input.label}
                </button>
              ))}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <label>
              {tr("Pin label")}
              <input
                value={draft.label}
                maxLength={200}
                onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                disabled={busy}
                required
              />
            </label>
            <label>
              {tr("Linked entry")}
              <select
                value={
                  draft.sourceId ? `${draft.sourceKind}:${draft.sourceId}` : ""
                }
                onChange={(e) => {
                  const [sourceKind, sourceId = ""] = e.target.value.split(":");
                  setDraft({
                    ...draft,
                    sourceKind: (sourceKind ||
                      "page") as PinInput["sourceKind"],
                    sourceId,
                  });
                }}
                disabled={busy}
                required
              >
                <option value="">{tr("Select an entry")}</option>
                {sources.map((s) => (
                  <option key={`${s.kind}:${s.id}`} value={`${s.kind}:${s.id}`}>
                    {s.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {tr("Horizontal position (%)")}
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={draft.x / 10000}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    x: Math.round(Number(e.target.value) * 10000),
                  })
                }
                disabled={busy}
              />
            </label>
            <label>
              {tr("Vertical position (%)")}
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={draft.y / 10000}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    y: Math.round(Number(e.target.value) * 10000),
                  })
                }
                disabled={busy}
              />
            </label>
            <button type="submit" disabled={busy || !draft.sourceId}>
              {editing ? tr("Save pin position") : tr("Add pin")}
            </button>
            {editing && (
              <>
                <button type="button" onClick={() => open(editing)}>
                  {tr("Open linked entry")}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void remove()}
                >
                  {tr("Delete pin")}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setEditing(null);
                    setDraft(blank());
                  }}
                >
                  {tr("Cancel")}
                </button>
              </>
            )}
          </form>
          {pins.length > 0 && (
            <ol>
              {pins.map((pin) => (
                <li key={pin.id}>
                  <button type="button" onClick={() => open(pin)}>
                    {pin.input.label} ·{" "}
                    {source(pin)?.title ?? tr("Missing entry")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(pin);
                      setDraft(pin.input);
                    }}
                  >
                    {tr("Edit pin")}
                  </button>
                </li>
              ))}
            </ol>
          )}
          {pins.length >= 2 && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void addRoute();
              }}
            >
              <h5>{tr("Map routes")}</h5>
              <label>
                {tr("From pin")}
                <select
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  required
                >
                  <option value="">{tr("Select pin")}</option>
                  {pins.map((pin) => (
                    <option key={pin.id} value={pin.id}>
                      {pin.input.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {tr("To pin")}
                <select
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  required
                >
                  <option value="">{tr("Select pin")}</option>
                  {pins.map((pin) => (
                    <option key={pin.id} value={pin.id}>
                      {pin.input.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {tr("Route label")}
                <input
                  value={routeLabel}
                  maxLength={200}
                  onChange={(e) => setRouteLabel(e.target.value)}
                />
              </label>
              <button
                type="submit"
                disabled={busy || !from || !to || from === to}
              >
                {tr("Add route")}
              </button>
              {routes.length > 0 && (
                <ul>
                  {routes.map((route) => (
                    <li key={route.id}>
                      {route.label ||
                        `${pins.find((p) => p.id === route.fromPinId)?.input.label} → ${pins.find((p) => p.id === route.toPinId)?.input.label}`}{" "}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void removeRoute(route)}
                      >
                        {tr("Delete route")}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </form>
          )}
          {images.length > 1 && (
            <div>
              <label>
                {tr("Move pins to equal-size map")}
                <select
                  value={relinkTo}
                  onChange={(e) => setRelinkTo(e.target.value)}
                >
                  <option value="">{tr("Select map")}</option>
                  {images
                    .filter(
                      (image) =>
                        image.id !== selected &&
                        image.width === chosen?.width &&
                        image.height === chosen?.height,
                    )
                    .map((image) => (
                      <option key={image.id} value={image.id}>
                        {image.caption}
                      </option>
                    ))}
                </select>
              </label>
              <button
                type="button"
                disabled={busy || !relinkTo}
                onClick={() => void relink()}
              >
                {tr("Move pins")}
              </button>
            </div>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </section>
  );
}
