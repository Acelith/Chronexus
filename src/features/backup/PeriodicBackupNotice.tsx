import { tr } from "../../i18n/store";
import type { PeriodicOutcome } from "./api";

/** Result of the last periodic backup; failures are alerts, never silent. */
export function PeriodicBackupNotice({
  outcome,
  onClose,
}: {
  outcome: PeriodicOutcome | null;
  onClose: () => void;
}) {
  if (!outcome) return null;
  return (
    <div
      className={
        outcome.error
          ? "periodic-backup-notice error"
          : "periodic-backup-notice"
      }
      role={outcome.error ? "alert" : "status"}
    >
      <p>
        {outcome.error
          ? tr("Periodic backup failed: {0}", [outcome.error])
          : tr("Periodic backup created and verified.")}
      </p>
      <button onClick={onClose}>{tr("Close")}</button>
    </div>
  );
}
