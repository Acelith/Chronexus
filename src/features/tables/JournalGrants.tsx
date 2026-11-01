import { useState } from "react";
import { tr } from "../../i18n/store";
import { syncApi, type SyncItem } from "../sync/api";
import { tablesApi } from "./api";
export default function JournalGrants({
  campaignId,
  tableId,
  online,
  canGrant,
  ask,
  setError,
}: {
  campaignId: string;
  tableId: string;
  online: boolean;
  canGrant: boolean;
  ask: (title: string, lines: string[], accept: string) => Promise<boolean>;
  setError: (message: string) => void;
}) {
  const [items, setItems] = useState<SyncItem[]>([]),
    [item, setItem] = useState("");
  return (
    <details>
      <summary>{tr("Share selected journal items with the GM")}</summary>
      <p>
        {tr(
          "Only items already shared and synchronized can be granted to this GM.",
        )}
      </p>
      <button
        type="button"
        onClick={() =>
          void syncApi
            .items(campaignId)
            .then((v) =>
              setItems(
                v.filter((i) => i.scope === "shared" && i.status === "synced"),
              ),
            )
            .catch(() =>
              setError(
                tr(
                  "Table unavailable. Your journal remains available offline.",
                ),
              ),
            )
        }
      >
        {tr("Load items")}
      </button>
      <select
        aria-label={tr("Journal item")}
        value={item}
        onChange={(e) => setItem(e.target.value)}
      >
        <option value="">{tr("Choose an item")}</option>
        {items.map((i) => (
          <option key={i.kind + i.itemId} value={i.kind + "/" + i.itemId}>
            {i.title}
          </option>
        ))}
      </select>
      {[true, false].map((enabled) => (
        <button
          type="button"
          key={String(enabled)}
          disabled={!item || !online || !canGrant}
          onClick={() =>
            void (async () => {
              if (
                enabled &&
                !(await ask(
                  tr("Share with the GM?"),
                  [
                    items.find((i) => i.kind + "/" + i.itemId === item)
                      ?.title ?? "",
                  ],
                  tr("Share"),
                ))
              )
                return;
              const [kind, itemId] = item.split("/");
              try {
                await tablesApi.grant(
                  campaignId,
                  tableId,
                  kind,
                  itemId,
                  enabled,
                );
                setError("");
              } catch (e) {
                setError(e instanceof Error ? e.message : "");
              }
            })()
          }
        >
          {enabled ? tr("Share with the GM") : tr("Revoke GM access")}
        </button>
      ))}
    </details>
  );
}
