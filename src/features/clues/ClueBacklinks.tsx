import { useEffect, useState } from "react";
import { tr } from "../../i18n/store";
import { clueApi, type Clue } from "./api";

export default function ClueBacklinks({
  campaignId,
  sourceKind,
  sourceId,
  onOpen,
}: {
  campaignId: string;
  sourceKind: "session" | "page";
  sourceId: string;
  onOpen: (id: string) => void;
}) {
  const [items, setItems] = useState<Clue[]>([]);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    clueApi
      .list(campaignId)
      .then((rows) => {
        if (active) {
          setFailed(false);
          setItems(
            rows.filter((item) =>
              item.sources.some(
                (source) =>
                  source.kind === sourceKind && source.id === sourceId,
              ),
            ),
          );
        }
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [campaignId, sourceKind, sourceId]);
  if (failed)
    return (
      <p role="alert" className="error">
        {tr("Cannot load clue backlinks. Open the clue board to retry.")}
      </p>
    );
  if (!items.length) return null;
  return (
    <aside className="clue-backlinks" aria-label={tr("Clues from this note")}>
      <strong>{tr("Clues from this note")}</strong>
      {items.map((item) => (
        <button key={item.id} onClick={() => onOpen(item.id)}>
          {item.title}
        </button>
      ))}
    </aside>
  );
}
