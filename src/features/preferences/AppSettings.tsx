import { useState } from "react";
import { Icon } from "../../components/Ornaments";
import { tr } from "../../i18n/store";
import type { UpdateOffer } from "../updates/api";
import AiSetupSettings from "../ai-setup/AiSetupSettings";
import BackupSettings from "../backup/BackupSettings";
import SyncSettings from "../sync/SyncSettings";
import UpdateSettings from "../updates/UpdateSettings";
import WikiSettings from "../wiki/WikiSettings";
import LanguageSettings from "./LanguageSettings";
import GettingStarted from "../onboarding/GettingStarted";
import "./app-settings.css";

const sections = [
  { id: "start", label: "Getting started", icon: "scroll" },
  { id: "language", label: "Language and script", icon: "book" },
  { id: "backup", label: "Backup", icon: "backup" },
  { id: "wiki", label: "D&D sources / Wiki", icon: "wiki" },
  { id: "ai", label: "Local AI: components", icon: "star" },
  { id: "sharing", label: "Campaign sharing", icon: "party" },
  { id: "updates", label: "App updates", icon: "scroll" },
] as const;
type Section = (typeof sections)[number]["id"];

/** Keep panels mounted so switching sections never discards an unfinished form. */
export default function AppSettings({
  busy,
  run,
  initialOffer,
  onHandoffUsed,
  onCampaignAdded,
  onOpenTour = () => undefined,
  onDemoChanged = () => undefined,
}: {
  busy: boolean;
  run: (action: () => Promise<void>) => Promise<unknown>;
  initialOffer: UpdateOffer | null;
  onHandoffUsed: () => void;
  onCampaignAdded: () => void;
  onOpenTour?: () => void;
  onDemoChanged?: (campaignId: string | null) => void | Promise<void>;
}) {
  const [active, setActive] = useState<Section>(
    initialOffer ? "updates" : "language",
  );
  const selected = initialOffer ? "updates" : active;
  return (
    <div className="app-settings-layout">
      <nav className="app-settings-nav" aria-label={tr("App settings")}>
        {sections.map(({ id, label, icon }) => (
          <button
            key={id}
            id={`app-settings-link-${id}`}
            type="button"
            aria-current={selected === id ? "page" : undefined}
            aria-controls={`app-settings-panel-${id}`}
            onClick={() => setActive(id)}
          >
            <Icon name={icon} />
            <span>{tr(label)}</span>
          </button>
        ))}
      </nav>
      <div className="app-settings-content">
        {sections.map(({ id }) => (
          <div
            key={id}
            id={`app-settings-panel-${id}`}
            className="app-settings-panel"
            role="region"
            aria-labelledby={`app-settings-link-${id}`}
            hidden={selected !== id}
          >
            {id === "start" ? (
              <GettingStarted
                disabled={busy}
                onOpenTour={onOpenTour}
                onDemoChanged={onDemoChanged}
              />
            ) : id === "language" ? (
              <LanguageSettings disabled={busy} />
            ) : id === "backup" ? (
              <BackupSettings disabled={busy} />
            ) : id === "wiki" ? (
              <WikiSettings disabled={busy} />
            ) : id === "ai" ? (
              <AiSetupSettings disabled={busy} />
            ) : id === "sharing" ? (
              <SyncSettings disabled={busy} onCampaignAdded={onCampaignAdded} />
            ) : (
              <UpdateSettings
                busy={busy}
                run={run}
                initialOffer={initialOffer}
                onHandoffUsed={() => {
                  setActive("updates");
                  onHandoffUsed();
                }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
