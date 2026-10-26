import { Text } from "../../i18n/Text";
import { tr } from "../../i18n/store";
import type { ReactNode } from "react";
import { Icon } from "../../components/Ornaments";
import { appText } from "../../strings";
import type { Campaign } from "../journal/api";
import type { View } from "./views";

// M21: herald logo chosen by the user (assets/brand/README.md); the name stays in alt.
const brandLogo = new URL(
  "../../../assets/brand/chronexus-logo.webp",
  import.meta.url,
).href;
const castle = new URL("../../../assets/gui/castle.png", import.meta.url).href;

export function AppSidebar({
  campaigns,
  campaignId,
  hasCampaign,
  backupOpen,
  view,
  busy,
  loading,
  onSelectCampaign,
  onNewCampaign,
  onOpenBackup,
  onShow,
}: {
  campaigns: Campaign[];
  campaignId: string | null;
  hasCampaign: boolean;
  backupOpen: boolean;
  view: View;
  busy: boolean;
  loading: boolean;
  onSelectCampaign: (id: string) => void;
  onNewCampaign: () => void;
  onOpenBackup: () => void;
  onShow: (view: View) => void;
}) {
  const item = (
    target: View,
    icon: string,
    label: ReactNode,
    disabled = busy,
  ) => (
    <button
      disabled={disabled}
      aria-current={!backupOpen && view === target ? "page" : undefined}
      onClick={() => onShow(target)}
    >
      <Icon name={icon} />
      {label}
    </button>
  );
  return (
    <aside>
      <div className="brand">
        <h1>
          <img className="brand-logo" src={brandLogo} alt={appText.appName} />
        </h1>
        <p>
          <Text source={"Your stories live on"} />
        </p>
      </div>
      <nav className="sidebar-menu" aria-label={appText.campaigns}>
        <label className="campaign-picker">
          <Text source={"Current campaign"} />
          <select
            aria-label={tr("Current campaign")}
            value={backupOpen ? "" : (campaignId ?? "")}
            disabled={busy || loading}
            onChange={(e) => onSelectCampaign(e.target.value)}
          >
            {backupOpen ? (
              <option value="">{tr("Select campaign")}</option>
            ) : null}
            {!campaigns.length ? (
              <option value="">{tr("No campaign")}</option>
            ) : null}
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
              </option>
            ))}
          </select>
        </label>
        <button disabled={busy || loading} onClick={onNewCampaign}>
          <Icon name="plus" />
          {appText.newCampaign}
        </button>
        <button
          disabled={busy || loading}
          aria-current={backupOpen ? "page" : undefined}
          onClick={onOpenBackup}
        >
          <Icon name="backup" />
          <Text source={"Backup and restore"} />
        </button>
        {hasCampaign ? (
          <>
            {item(
              "settings",
              "settings",
              <Text source={"Campaign settings"} />,
            )}
            {item("assistant", "star", <Text source={"Local assistant"} />)}
            {item("dice", "dice", <Text source={"Dice roller"} />)}
          </>
        ) : null}
        {item("preferences", "settings", tr("App settings"), busy || loading)}
      </nav>
      <div className="local-mark">
        <img src={castle} alt="" />
        <p>
          <Text source={"People, places, ideas."} />
          <br />
          <Text source={"Everything is connected."} />
        </p>
        <span aria-hidden="true">— ◈ —</span>
      </div>
    </aside>
  );
}
