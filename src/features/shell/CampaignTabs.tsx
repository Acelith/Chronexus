import type { ReactNode } from "react";
import { Text } from "../../i18n/Text";
import { tr } from "../../i18n/store";
import { Icon } from "../../components/Ornaments";
import type { View } from "./views";

/** Campaign workspaces; the parent decides what changing view resets. */
export function CampaignTabs({
  view,
  busy,
  onShow,
}: {
  view: View;
  busy: boolean;
  onShow: (view: View) => void;
}) {
  const tabs: [View, string, ReactNode][] = [
    ["overview", "document", <Text source={"Overview"} />],
    ["journal", "book", <Text source={"Journal"} />],
    ["codex", "books", <Text source={"Codex"} />],
    ["graph", "graph", <Text source={"Graph"} />],
    ["clues", "document", <Text source={"Clue board"} />],
    ["party", "party", <Text source={"Party"} />],
    ["character", "helmet", tr("Character")],
    ["inventory", "bag", tr("Inventory")],
    ["abilities", "star", tr("Spells")],
    ["wiki", "wiki", <Text source={"D&D Wiki"} />],
  ];
  return (
    <nav className="view-tabs" aria-label={tr("Campaign views")}>
      {tabs.map(([id, icon, label]) => (
        <button
          key={id}
          aria-current={view === id ? "page" : undefined}
          disabled={busy}
          onClick={() => onShow(id)}
        >
          <Icon name={icon} />
          {label}
        </button>
      ))}
    </nav>
  );
}
