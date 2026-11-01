import { useEffect, useRef, useState } from "react";
import { tr } from "../../i18n/store";
import { errorMessage } from "../journal/api";
import { tablesApi, type Table } from "./api";
import { syncApi } from "../sync/api";
import { useTableDock } from "./TableDock";
export default function Tables({ campaignId }: { campaignId: string }) {
  const open = useTableDock(),
    generation = useRef(0);
  const [linked, setLinked] = useState<string[]>([]),
    [loaded, setLoaded] = useState(false);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  const [tables, setTables] = useState<Table[]>([]),
    [code, setCode] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const linkedIds = new Set(linked);
  async function load() {
    setBusy(true);
    setError("");
    try {
      const stamp = generation.current;
      const [list, links, account] = await Promise.all([
        tablesApi.list(),
        tablesApi.links(campaignId),
        syncApi.account(),
      ]);
      if (stamp !== generation.current) return;
      setTables(list);
      setLinked(
        links
          .filter(
            (l) =>
              l.server === account.server && l.accountId === account.accountId,
          )
          .map((l) => l.tableId),
      );
      setLoaded(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <details>
      <summary>{tr("Tables")}</summary>
      <p>
        {tr(
          "Tables use your sharing account. Joining never shares your journal.",
        )}
      </p>
      <button type="button" disabled={busy} onClick={() => void load()}>
        {tr("Load tables")}
      </button>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await tablesApi.join(code);
            setCode("");
            setTables(await tablesApi.list());
          } catch (e) {
            setError(errorMessage(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          {tr("Invitation code")}
          <input
            required
            maxLength={512}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={busy}
          />
        </label>
        <button type="submit" disabled={busy || !code.trim()}>
          {tr("Join table")}
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {loaded && !tables.length && (
        <p>{tr("No tables yet. Join with an invitation code.")}</p>
      )}
      <ul>
        {tables.map((table) => (
          <li key={table.id}>
            <b>{table.name}</b>{" "}
            <button type="button" disabled={busy} onClick={() => open(table)}>
              {tr("Open table")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void (async () => {
                  setBusy(true);
                  try {
                    await tablesApi.link(
                      campaignId,
                      table.id,
                      !linkedIds.has(table.id),
                    );
                    await load();
                  } catch (e) {
                    setError(errorMessage(e));
                  } finally {
                    setBusy(false);
                  }
                })()
              }
            >
              {linkedIds.has(table.id)
                ? tr("Unlink table from this campaign")
                : tr("Link table to this campaign")}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
