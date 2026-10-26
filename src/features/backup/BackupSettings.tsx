import { usePendingAction } from "../../usePendingAction";
import { useEffect, useState } from "react";
import { date as formatDateTime, tr } from "../../i18n/store";
import { errorMessage } from "../journal/api";
import {
  BACKUP_STATUS_EVENT,
  backupFolderApi,
  type BackupFolderStatus,
  type BackupFrequency,
  type BackupSchedule,
  type PeriodicOutcome,
} from "./api";

const when = (value: string | null, empty: string) =>
  value
    ? formatDateTime(value, { dateStyle: "medium", timeStyle: "short" })
    : empty;
export function outcomeMessage(outcome: PeriodicOutcome) {
  if (outcome.error) return tr("Periodic backup failed: {0}", [outcome.error]);
  let message = tr("Periodic backup created and verified.");
  if (outcome.removed)
    message +=
      " " + tr("Older periodic copies deleted: {0}.", [outcome.removed]);
  if (outcome.keptUnverified)
    message +=
      " " +
      tr("{0} copies changed outside Chronexus were left untouched.", [
        outcome.keptUnverified,
      ]);
  return message;
}
/** M19: global backup folder and periodic schedule; available without a campaign. */
export default function BackupSettings({ disabled }: { disabled: boolean }) {
  const [status, setStatus] = useState<BackupFolderStatus | null>(null);
  const [draft, setDraft] = useState<BackupSchedule | null>(null);
  const { pending, error, notice, setError, perform: act } = usePendingAction();
  function adopt(next: BackupFolderStatus) {
    setStatus(next);
    const { enabled, frequency, hours, keep } = next.preferences;
    setDraft({ enabled, frequency, hours, keep });
  }
  useEffect(() => {
    let active = true;
    const load = () =>
      backupFolderApi
        .status()
        .then((next) => {
          if (active) adopt(next);
        })
        .catch((reason) => {
          if (active) setError(errorMessage(reason));
        });
    void load();
    window.addEventListener(BACKUP_STATUS_EVENT, load);
    return () => {
      active = false;
      window.removeEventListener(BACKUP_STATUS_EVENT, load);
    };
  }, [setError]);
  const busy = disabled || pending;
  const perform = (action: () => Promise<string | void>) =>
    act(action, { blocked: busy });
  const prefs = status?.preferences;
  const changed =
    !!draft &&
    !!prefs &&
    (draft.enabled !== prefs.enabled ||
      draft.frequency !== prefs.frequency ||
      draft.hours !== prefs.hours ||
      draft.keep !== prefs.keep);
  return (
    <section
      className="language-settings backup-settings"
      aria-label={tr("Backup")}
    >
      <h3>{tr("Backup")}</h3>
      <p>
        {tr(
          "Chronexus can save verified copies of all campaigns, with images and attachments, in the Chronexus folder in your Documents. The folder is created only at the first backup.",
        )}
      </p>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      <p role="status" className="muted">
        {pending ? tr("Backup operation in progress…") : notice}
      </p>
      {!status && !error ? (
        <p role="status">{tr("Reading settings…")}</p>
      ) : null}
      {status && draft ? (
        <>
          <dl className="ai-setup-status backup-folder-status">
            <div>
              <dt>{tr("Periodic backups")}</dt>
              <dd>
                <bdi>{status.periodicFolder ?? tr("Not available")}</bdi>
                {status.preferences.destination
                  ? ` · ${tr("folder chosen by you")}`
                  : ""}
              </dd>
            </div>
            <div>
              <dt>{tr("Update backups")}</dt>
              <dd>
                <bdi>{status.updatesFolder ?? tr("Chronexus data folder")}</bdi>
              </dd>
            </div>
            <div>
              <dt>{tr("Last periodic backup")}</dt>
              <dd>{when(status.lastSuccess, tr("None so far"))}</dd>
            </div>
            <div>
              <dt>{tr("Next backup")}</dt>
              <dd>
                {!status.preferences.enabled
                  ? tr("Periodic backups off")
                  : status.dueNow
                    ? tr("At the next idle moment")
                    : when(status.nextDue, "—")}
              </dd>
            </div>
            <div>
              <dt>{tr("Registered copies")}</dt>
              <dd>{status.registered}</dd>
            </div>
          </dl>
          {status.lastError ? (
            <p className="error backup-last-error">
              {tr("Last attempt failed ({0}): {1}", [
                when(status.lastAttempt, "—"),
                status.lastError,
              ])}{" "}
              {tr(
                "Chronexus will try again at the next interval; you can also choose another folder or run a backup now.",
              )}
            </p>
          ) : null}
          {status.cloudSynced ? (
            <p className="backup-cloud-warning" role="note">
              {tr(
                "Warning: the folder seems to be synced with a cloud service (for example OneDrive). .nodex files are not encrypted and would be uploaded online together with your campaigns.",
              )}
            </p>
          ) : null}
          <form
            className="backup-schedule"
            onSubmit={(event) => {
              event.preventDefault();
              void perform(async () => {
                adopt(await backupFolderApi.saveSchedule(draft));
                return tr("Backup schedule saved.");
              });
            }}
          >
            <fieldset disabled={busy}>
              <legend>{tr("Periodic backups")}</legend>
              <label className="language-checkbox">
                <input
                  type="checkbox"
                  checked={draft.enabled}
                  onChange={(e) =>
                    setDraft({ ...draft, enabled: e.target.checked })
                  }
                />
                {tr("Create periodic backups while Chronexus is open and idle")}
              </label>
              <label>
                {tr("Frequency")}
                <select
                  value={draft.frequency}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      frequency: e.target.value as BackupFrequency,
                    })
                  }
                >
                  <option value="daily">{tr("Every day")}</option>
                  <option value="weekly">{tr("Every week")}</option>
                  <option value="hours">{tr("Every N hours")}</option>
                </select>
              </label>
              {draft.frequency === "hours" ? (
                <label>
                  {tr("Hours between backups (2–72)")}
                  <input
                    type="number"
                    min={2}
                    max={72}
                    required
                    value={draft.hours}
                    onChange={(e) =>
                      setDraft({ ...draft, hours: Number(e.target.value) })
                    }
                  />
                </label>
              ) : null}
              <label>
                {tr("Periodic copies to keep (1–60)")}
                <input
                  type="number"
                  min={1}
                  max={60}
                  required
                  value={draft.keep}
                  onChange={(e) =>
                    setDraft({ ...draft, keep: Number(e.target.value) })
                  }
                />
              </label>
              <p className="muted">
                {tr(
                  "The backup starts only when you are not writing and no save, restore, update or AI operation is running. After a new verified backup Chronexus deletes only the oldest periodic copies it created and registered; manual backups, safety copies and update backups are never touched.",
                )}
              </p>
              <div className="actions">
                <button className="primary" type="submit" disabled={!changed}>
                  {tr("Save schedule")}
                </button>
              </div>
            </fieldset>
          </form>
          <div className="actions backup-folder-actions">
            <button
              disabled={busy}
              onClick={() =>
                void perform(async () => {
                  const outcome = await backupFolderApi.runNow();
                  adopt(await backupFolderApi.status());
                  if (outcome.error) throw new Error(outcomeMessage(outcome));
                  return outcomeMessage(outcome);
                })
              }
            >
              {tr("Run backup now")}
            </button>
            <button
              disabled={busy}
              onClick={() =>
                void perform(async () => {
                  const next = await backupFolderApi.chooseDestination();
                  if (!next) return tr("No folder chosen.");
                  adopt(next);
                  return tr(
                    "Periodic backup folder changed. Backups already created stay where they are.",
                  );
                })
              }
            >
              {tr("Choose another folder…")}
            </button>
            {status.preferences.destination ? (
              <button
                disabled={busy}
                onClick={() =>
                  void perform(async () => {
                    adopt(await backupFolderApi.resetDestination());
                    return tr(
                      "The next periodic backups will go to Documents. Backups already created stay where they are.",
                    );
                  })
                }
              >
                {tr("Use the Documents folder")}
              </button>
            ) : null}
            <button
              disabled={busy}
              onClick={() =>
                void perform(async () => {
                  const path = await backupFolderApi.open(
                    status.preferences.destination ? "custom" : "periodic",
                  );
                  return tr("Folder opened: {0}", [path]);
                })
              }
            >
              {tr("Open backup folder")}
            </button>
          </div>
          <p className="muted">
            {tr(
              "Backup preferences apply to all campaigns, stay unchanged after a restore and are included in the update backup receipt.",
            )}
          </p>
        </>
      ) : null}
    </section>
  );
}
