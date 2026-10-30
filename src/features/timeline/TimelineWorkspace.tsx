import { useEffect, useState } from "react";
import { tr } from "../../i18n/store";
import { errorMessage, type Session } from "../journal/api";
import type { KnowledgePage } from "../knowledge/api";
import { clueApi, type Clue } from "../clues/api";
import { timelineApi, type Calendar, type Entry, type EntryInput } from "./api";

const empty = (calendar?: Calendar | null): EntryInput => ({
  sourceKind: "session",
  sourceId: "",
  era: calendar?.eras[0] ?? "",
  year: null,
  month: null,
  day: null,
  precision: "exact",
  note: "",
});
const names = (value: string) =>
  value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
function dateLabel(entry: Entry, calendar: Calendar) {
  const { precision, day, month, year, era } = entry.input;
  if (precision === "unknown") return tr("Unknown date");
  const date = tr("{0} {1} {2}, {3}", [
    day ?? "?",
    calendar.months[(month ?? 1) - 1]?.name ?? "?",
    year ?? "?",
    era,
  ]);
  return precision === "approximate" ? tr("About {0}", [date]) : date;
}
export default function TimelineWorkspace({
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
  const [calendar, setCalendar] = useState<Calendar | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [clues, setClues] = useState<Clue[]>([]);
  const [months, setMonths] = useState("");
  const [weekdays, setWeekdays] = useState("");
  const [eras, setEras] = useState("");
  const [draft, setDraft] = useState<EntryInput>(empty());
  const [editing, setEditing] = useState<Entry | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    Promise.all([
      timelineApi.calendar(campaignId),
      timelineApi.list(campaignId),
      clueApi.list(campaignId),
    ])
      .then(([cal, items, clueItems]) => {
        if (!live) return;
        setCalendar(cal);
        setEntries(items);
        setClues(clueItems);
        setMonths(
          cal?.months.map((m) => `${m.name}:${m.days}`).join("\n") ?? "",
        );
        setWeekdays(cal?.weekdays.join(", ") ?? "");
        setEras(cal?.eras.join(", ") ?? "");
        setDraft(empty(cal));
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
  const sources = [
    ...sessions.map((s) => ({
      kind: "session" as const,
      id: s.id,
      title: s.title,
    })),
    ...pages.map((p) => ({ kind: "page" as const, id: p.id, title: p.title })),
    ...clues.map((c) => ({ kind: "clue" as const, id: c.id, title: c.title })),
  ];
  const source = (entry: Entry) =>
    sources.find(
      (s) => s.kind === entry.input.sourceKind && s.id === entry.input.sourceId,
    );
  async function saveCalendar() {
    setBusy(true);
    setError("");
    try {
      const parsed: Calendar = {
        months: months
          .split(/\r?\n/)
          .filter(Boolean)
          .map((line) => {
            const pos = line.lastIndexOf(":");
            return {
              name: line.slice(0, pos).trim(),
              days: Number(line.slice(pos + 1)),
            };
          }),
        weekdays: names(weekdays),
        eras: names(eras),
      };
      const result = await timelineApi.saveCalendar(campaignId, parsed);
      setCalendar(result);
      setDraft(empty(result));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function saveEntry() {
    setBusy(true);
    setError("");
    try {
      await timelineApi.save(campaignId, draft, editing ?? undefined);
      setEntries(await timelineApi.list(campaignId));
      setEditing(null);
      setDraft(empty(calendar));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!editing || !window.confirm(tr("Delete this timeline date?"))) return;
    setBusy(true);
    setError("");
    try {
      await timelineApi.remove(campaignId, editing);
      setEntries(await timelineApi.list(campaignId));
      setEditing(null);
      setDraft(empty(calendar));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  function open(entry: Entry) {
    const item = source(entry);
    if (!item) return;
    if (item.kind === "session") {
      const s = sessions.find((s) => s.id === item.id);
      if (s) onSession(s);
    } else if (item.kind === "page") {
      const p = pages.find((p) => p.id === item.id);
      if (p) onPage(p);
    } else onClue(item.id);
  }
  return (
    <section className="language-settings" aria-label={tr("Campaign timeline")}>
      <h4>{tr("Campaign timeline")}</h4>
      {loading ? (
        <p role="status">{tr("Opening timeline…")}</p>
      ) : (
        <>
          <details open={!calendar}>
            <summary>{tr("World calendar")}</summary>
            <label>
              {tr("Months and days (one name:days per line)")}
              <textarea
                value={months}
                onChange={(e) => setMonths(e.target.value)}
                disabled={busy}
              />
            </label>
            <label>
              {tr("Weekdays (comma-separated)")}
              <input
                value={weekdays}
                onChange={(e) => setWeekdays(e.target.value)}
                disabled={busy}
              />
            </label>
            <label>
              {tr("Eras (comma-separated)")}
              <input
                value={eras}
                onChange={(e) => setEras(e.target.value)}
                disabled={busy}
              />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() => void saveCalendar()}
            >
              {tr("Save calendar")}
            </button>
          </details>
          {calendar && (
            <>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void saveEntry();
                }}
              >
                <label>
                  {tr("Timeline source")}
                  <select
                    value={
                      draft.sourceId
                        ? `${draft.sourceKind}:${draft.sourceId}`
                        : ""
                    }
                    onChange={(e) => {
                      const [sourceKind, sourceId = ""] =
                        e.target.value.split(":");
                      setDraft({
                        ...draft,
                        sourceKind: (sourceKind ||
                          "session") as EntryInput["sourceKind"],
                        sourceId,
                      });
                    }}
                    disabled={busy}
                    required
                  >
                    <option value="">{tr("Select an entry")}</option>
                    {sources.map((s) => (
                      <option
                        key={`${s.kind}:${s.id}`}
                        value={`${s.kind}:${s.id}`}
                      >
                        {s.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {tr("Date certainty")}
                  <select
                    value={draft.precision}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        precision: e.target.value as EntryInput["precision"],
                        ...(e.target.value === "unknown"
                          ? { year: null, month: null, day: null }
                          : {}),
                      })
                    }
                    disabled={busy}
                  >
                    <option value="exact">{tr("Exact")}</option>
                    <option value="approximate">{tr("Approximate")}</option>
                    <option value="unknown">{tr("Unknown")}</option>
                  </select>
                </label>
                {draft.precision !== "unknown" && (
                  <>
                    <label>
                      {tr("Era")}
                      <select
                        value={draft.era}
                        onChange={(e) =>
                          setDraft({ ...draft, era: e.target.value })
                        }
                        disabled={busy}
                      >
                        {calendar.eras.map((era) => (
                          <option key={era} value={era}>
                            {era}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {tr("Year")}
                      <input
                        type="number"
                        value={draft.year ?? ""}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            year: e.target.value
                              ? Number(e.target.value)
                              : null,
                          })
                        }
                        disabled={busy}
                        required
                      />
                    </label>
                    <label>
                      {tr("Month")}
                      <select
                        value={draft.month ?? ""}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            month: Number(e.target.value),
                            day: null,
                          })
                        }
                        disabled={busy}
                        required
                      >
                        <option value="">{tr("Select month")}</option>
                        {calendar.months.map((m, i) => (
                          <option key={i} value={i + 1}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {tr("Day")}
                      <input
                        type="number"
                        min={1}
                        max={
                          calendar.months[(draft.month ?? 1) - 1]?.days ?? 366
                        }
                        value={draft.day ?? ""}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            day: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                        disabled={busy}
                        required
                      />
                    </label>
                  </>
                )}
                <label>
                  {tr("Date note")}
                  <textarea
                    value={draft.note}
                    maxLength={1000}
                    onChange={(e) =>
                      setDraft({ ...draft, note: e.target.value })
                    }
                    disabled={busy}
                  />
                </label>
                <button type="submit" disabled={busy || !draft.sourceId}>
                  {tr("Save date")}
                </button>
                {editing && (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void remove()}
                    >
                      {tr("Delete date")}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setEditing(null);
                        setDraft(empty(calendar));
                      }}
                    >
                      {tr("Cancel")}
                    </button>
                  </>
                )}
              </form>
              {entries.length === 0 ? (
                <p>{tr("No world dates yet.")}</p>
              ) : (
                <ol>
                  {entries.map((entry) => (
                    <li key={entry.id}>
                      <span>{dateLabel(entry, calendar)}</span>
                      {" · "}
                      <button type="button" onClick={() => open(entry)}>
                        <bdi>{source(entry)?.title ?? tr("Missing entry")}</bdi>
                      </button>
                      {" · "}
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(entry);
                          setDraft(entry.input);
                        }}
                      >
                        {tr("Edit date")}
                      </button>
                      {entry.input.note && <p>{entry.input.note}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
