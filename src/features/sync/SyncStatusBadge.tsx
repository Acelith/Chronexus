import { tr } from "../../i18n/store";
import { useSyncStatus, type SyncStatus } from "./api";

/** One honest sentence for the save state; local and server saves are never conflated. */
export function stateText(status: SyncStatus): string {
  switch (status.state) {
    case "saved":
      return tr("Saved on this device and on the server");
    case "pending":
      return tr("Saved on this device · waiting to be sent ({0})", [
        status.pending,
      ]);
    case "syncing":
      return tr("Saved on this device · synchronizing…");
    case "offline":
      return status.retryInSeconds
        ? tr(
            "Saved on this device · server not reachable, trying again in {0} s",
            [status.retryInSeconds],
          )
        : tr("Saved on this device · server not reachable, trying again");
    case "conflict":
      return tr("Saved on this device · {0} conflicts need your decision", [
        status.conflicts,
      ]);
    case "attention":
      return tr("Synchronization stopped: {0}", [
        status.message ?? tr("see the Sharing view"),
      ]);
    case "paused":
      return status.pending
        ? tr("Paused · {0} changes stay on this device", [status.pending])
        : tr("Paused · everything is saved on this device");
    default:
      return tr("Not synchronized automatically");
  }
}

/** Compact indicator in the campaign header; invisible for campaigns that do not sync. */
export default function SyncStatusBadge({
  campaignId,
  onOpen,
}: {
  campaignId: string;
  onOpen: () => void;
}) {
  const status = useSyncStatus(campaignId);
  if (!status || status.state === "off") return null;
  return (
    <button
      type="button"
      className="sync-badge"
      data-state={status.state}
      onClick={onOpen}
      title={tr("Open the Sharing view")}
    >
      <span aria-hidden="true" className="sync-dot" />
      <span role="status" aria-live="polite">
        {stateText(status)}
      </span>
    </button>
  );
}
