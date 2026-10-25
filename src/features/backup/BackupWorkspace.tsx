import { systemMessage } from "../../i18n/store";
import { date as formatDateTime } from "../../i18n/store";
import { Text } from "../../i18n/Text";
import { tr } from "../../i18n/store";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { SaveGuard } from "../journal/Editor";
import { errorMessage } from "../journal/api";
import {
  BACKUP_STATUS_EVENT,
  backupApi,
  backupFolderApi,
  type ArchiveCounts,
  type BackupListing,
  type BackupPreview,
  type BackupReceipt,
  type ListedBackup,
  type RestoreReceipt,
} from "./api";

const kindLabels: Record<ListedBackup["kind"], string> = {
  periodic: "Periodic",
  update: "Before an update",
  other: "Other backup",
};
const locationLabels: Record<ListedBackup["location"], string> = {
  periodic: "Documents · Periodic backups",
  updates: "Documents · Update backups",
  custom: "Folder chosen by you",
  legacy: "Chronexus data folder",
};
function megabytes(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KiB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}

export default function BackupWorkspace({
  register,
  onRestored,
}: {
  register: (guard: SaveGuard | null) => void;
  onRestored: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [backup, setBackup] = useState<BackupReceipt | null>(null);
  const [restored, setRestored] = useState<RestoreReceipt | null>(null);
  const operation = useRef(false);
  const confirmation = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const choose = useRef<HTMLButtonElement>(null);
  const hadPreview = useRef(false);
  const [listing, setListing] = useState<BackupListing | null>(null);
  const [listError, setListError] = useState("");
  async function refreshListing() {
    try {
      setListing(await backupFolderApi.list());
      setListError("");
    } catch (reason) {
      setListError(errorMessage(reason));
    }
  }
  useEffect(() => {
    let active = true;
    const load = () =>
      backupFolderApi
        .list()
        .then((next) => {
          if (!active) return;
          setListing(next);
          setListError("");
        })
        .catch((reason) => {
          if (active) setListError(errorMessage(reason));
        });
    void load();
    window.addEventListener(BACKUP_STATUS_EVENT, load);
    return () => {
      active = false;
      window.removeEventListener(BACKUP_STATUS_EVENT, load);
    };
  }, []);
  useEffect(() => {
    register({
      dirty: () => operation.current || preview !== null,
      flush: async () => {
        if (operation.current)
          throw new Error(
            tr("Wait for the backup or restore operation to finish."),
          );
        if (preview)
          throw new Error(
            tr(
              "Confirm or cancel the restore before changing view or closing Chronexus.",
            ),
          );
      },
    });
    return () => register(null);
  }, [register, preview]);
  useEffect(() => {
    if (preview) {
      hadPreview.current = true;
      if (!busy) cancel.current?.focus();
    } else if (hadPreview.current && !busy) {
      choose.current?.focus();
      hadPreview.current = false;
    }
  }, [preview, busy]);

  async function perform(action: () => Promise<void>, message: string) {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    setError("");
    setStatus(message);
    try {
      await action();
    } catch (reason) {
      setError(errorMessage(reason));
      setStatus("");
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }
  function cancelRestore() {
    void perform(async () => {
      await backupApi.cancel();
      setPreview(null);
      setStatus(tr("Restore cancelled. The current archive is unchanged."));
      choose.current?.focus();
    }, tr("Cancelling…"));
  }
  function confirmationKeys(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key === "Escape" && !busy) {
      event.preventDefault();
      cancelRestore();
    }
    if (event.key !== "Tab") return;
    const buttons = confirmation.current?.querySelectorAll<HTMLButtonElement>(
      "button:not(:disabled)",
    );
    if (!buttons?.length) {
      event.preventDefault();
      return;
    }
    const first = buttons[0],
      last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
  function confirmRestore() {
    if (!preview) return;
    void perform(async () => {
      try {
        const receipt = await backupApi.restore(preview.token);
        setRestored(receipt);
        setBackup(null);
        setPreview(null);
        await onRestored();
        setStatus(tr("Restore completed. Safety copy kept."));
      } catch (reason) {
        setPreview(null);
        choose.current?.focus();
        throw reason;
      }
    }, tr("Creating the safety copy and restoring. Wait before closing Chronexus…"));
  }
  return (
    <section
      className="backup-workspace"
      aria-labelledby="backup-title"
      aria-busy={busy}
    >
      <header className="backup-heading">
        <h2 id="backup-title">
          <Text source={"Backup and restore"} />
        </h2>
        <p>
          <Text
            source={
              "Take with you all the campaigns, notes, links and attachments managed by Chronexus."
            }
          />
        </p>
      </header>
      {error ? (
        <div className="error" role="alert">
          {error}
        </div>
      ) : null}
      <p role="status" className="backup-status">
        {status}
      </p>
      {restored ? (
        <section
          className="backup-receipt"
          aria-label={tr("Restore completed")}
        >
          <h3>
            <Text source={"Archive restored"} />
          </h3>
          <p>
            <Text
              source={"The restored campaigns are available in the sidebar."}
            />
          </p>
          <ArchiveSummary counts={restored.counts} />
          <p>
            <Text
              source={
                "The previous copy can be recovered by selecting this backup:"
              }
            />
          </p>
          <p className="archive-path">{restored.safetyPath}</p>
          {systemMessage(restored.warning) ? (
            <p role="alert">{systemMessage(restored.warning)}</p>
          ) : null}
        </section>
      ) : null}
      {preview ? (
        <RestoreConfirmation
          preview={preview}
          busy={busy}
          confirmation={confirmation}
          cancel={cancel}
          onKeys={confirmationKeys}
          onCancel={cancelRestore}
          onRestore={confirmRestore}
        />
      ) : (
        <>
          <section
            className="backup-action"
            aria-labelledby="create-backup-title"
          >
            <div>
              <h3 id="create-backup-title">
                <Text source={"Keep a copy"} />
              </h3>
              <p>
                <Text
                  source={
                    "A single .nodex file holds the whole archive. Choose a folder on the computer, an external disk or a mounted network drive."
                  }
                />
              </p>
              <p>
                <Text
                  source={
                    "Existing backups are never overwritten: always choose a new name."
                  }
                />
              </p>
            </div>
            <button
              className="primary"
              disabled={busy}
              onClick={() => {
                void perform(async () => {
                  const result = await backupApi.create();
                  setBackup(result);
                  setStatus(
                    result
                      ? tr("Backup created and verified.")
                      : tr("Backup cancelled. No file created."),
                  );
                }, tr("Choosing the destination and creating the backup…"));
              }}
            >
              <Text source={"Create backup"} />
            </button>
          </section>
          {backup ? (
            <section
              className="backup-receipt"
              aria-label={tr("Backup created")}
            >
              <h3>
                <Text source={"Backup created and verified"} />
              </h3>
              <p className="archive-path">{backup.path}</p>
              <ArchiveSummary counts={backup.counts} />
            </section>
          ) : null}
          <section
            className="backup-action"
            aria-labelledby="choose-backup-title"
          >
            <div>
              <h3 id="choose-backup-title">
                <Text source={"Recover an archive"} />
              </h3>
              <p>
                <Text
                  source={
                    "Select a .nodex file. Chronexus checks it and shows you its content before asking for confirmation."
                  }
                />
              </p>
            </div>
            <button
              ref={choose}
              disabled={busy}
              onClick={() => {
                void perform(async () => {
                  const result = await backupApi.inspect();
                  setPreview(result);
                  setStatus(
                    result
                      ? tr("Backup verified. Confirm or cancel the restore.")
                      : tr("Selection cancelled. Archive unchanged."),
                  );
                }, tr("Selecting and verifying the backup…"));
              }}
            >
              <Text source={"Select backup"} />
            </button>
          </section>
          <BackupList
            listing={listing}
            error={listError}
            busy={busy}
            onRefresh={() =>
              void perform(refreshListing, tr("Reading folders…"))
            }
            onRestore={(item) =>
              void perform(async () => {
                setPreview(
                  await backupFolderApi.inspect(item.location, item.name),
                );
                setStatus(
                  tr("Backup verified. Confirm or cancel the restore."),
                );
              }, tr("Selecting and verifying the backup…"))
            }
            onCopy={(item) =>
              void perform(async () => {
                const path = await backupFolderApi.copyLegacy(item.name);
                await refreshListing();
                setStatus(
                  tr(
                    "Copy verified with SHA-256 in {0}. The original stays in the data folder.",
                    [path],
                  ),
                );
              }, tr("Verified copy in progress…"))
            }
          />
          <p className="backup-footnote">
            <Text
              source={
                "The .nodex file is not encrypted: keep it somewhere private. Attachments managed in the data folder are included; external files mentioned in notes stay external."
              }
            />
          </p>
        </>
      )}
    </section>
  );
}

function BackupList({
  listing,
  error,
  busy,
  onRefresh,
  onRestore,
  onCopy,
}: {
  listing: BackupListing | null;
  error: string;
  busy: boolean;
  onRefresh: () => void;
  onRestore: (item: ListedBackup) => void;
  onCopy: (item: ListedBackup) => void;
}) {
  return (
    <section
      className="backup-action backup-available"
      aria-labelledby="available-backups-title"
    >
      <div>
        <h3 id="available-backups-title">
          <Text source={"Backups in the Chronexus folders"} />
        </h3>
        <p>
          <Text
            source={
              "Periodic and update backups found in Documents, in the chosen folder and in the data folder. Restoring follows the same checks as a file selected by hand."
            }
          />
        </p>
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        {listing?.folders
          .filter((folder) => folder.error)
          .map((folder) => (
            <p key={folder.location} className="error">
              {folder.error}
            </p>
          ))}
        {listing && !listing.backups.length ? (
          <p className="muted">
            <Text source={"No backups in the Chronexus folders yet."} />
          </p>
        ) : null}
        {listing?.backups.length ? (
          <ul className="backup-list">
            {listing.backups.map((item) => (
              <li key={`${item.location}/${item.name}`}>
                <div>
                  <strong>
                    <bdi>{item.name}</bdi>
                  </strong>
                  <br />
                  <span className="muted">
                    {[
                      tr(kindLabels[item.kind]),
                      tr(locationLabels[item.location]),
                      item.modified
                        ? formatDateTime(item.modified, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })
                        : "",
                      megabytes(item.size),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </div>
                <div className="actions">
                  {item.location === "legacy" ? (
                    <button disabled={busy} onClick={() => onCopy(item)}>
                      {tr("Copy to Documents")}
                    </button>
                  ) : null}
                  <button
                    disabled={busy}
                    onClick={() => onRestore(item)}
                    aria-label={tr("Verify and restore {0}", [item.name])}
                  >
                    {tr("Verify and restore…")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        {listing?.truncated ? (
          <p className="muted">
            {tr("List limited to the first 500 files per folder.")}
          </p>
        ) : null}
      </div>
      <button disabled={busy} onClick={onRefresh}>
        <Text source={"Refresh list"} />
      </button>
    </section>
  );
}

function ArchiveSummary({ counts }: { counts: ArchiveCounts }) {
  return (
    <dl className="archive-counts">
      {(
        [
          [tr("Campaigns"), counts.campaigns],
          [tr("Sessions"), counts.sessions],
          [tr("Pages"), counts.pages],
          [tr("Mentions"), counts.mentions],
          [tr("Relationships"), counts.relationships],
          [tr("Attachments"), counts.attachments],
          [tr("Characters"), counts.characters ?? 0],
          [tr("Items"), counts.items ?? 0],
          [tr("Abilities and spells"), counts.spells ?? 0],
          [tr("Dice rolls"), counts.diceRolls ?? 0],
        ] as const
      ).map(([label, count]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{count}</dd>
        </div>
      ))}
    </dl>
  );
}

function RestoreConfirmation({
  preview,
  busy,
  confirmation,
  cancel,
  onKeys,
  onCancel,
  onRestore,
}: {
  preview: BackupPreview;
  busy: boolean;
  confirmation: React.RefObject<HTMLDialogElement | null>;
  cancel: React.RefObject<HTMLButtonElement | null>;
  onKeys: (event: KeyboardEvent<HTMLDialogElement>) => void;
  onCancel: () => void;
  onRestore: () => void;
}) {
  useEffect(() => {
    const dialog = confirmation.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
    };
  }, [confirmation]);
  return (
    <dialog
      className="restore-confirmation"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="restore-title"
      aria-describedby="restore-warning"
      ref={confirmation}
      onKeyDown={onKeys}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <h3 id="restore-title">
        <Text source={"Replace the whole archive?"} />
      </h3>
      <p id="restore-warning">
        {tr(
          "All current campaigns will be replaced by those in {0}. A safety copy of the current archive is saved first. No merge is performed.",
          [preview.fileName],
        )}
      </p>
      <p>
        {tr("Backup from {0}. File and database integrity verified.", [
          formatDateTime(preview.manifest.created_at, {
            dateStyle: "long",
            timeStyle: "short",
          }),
        ])}
      </p>
      <ArchiveSummary counts={preview.manifest.counts} />
      <div className="actions">
        <button ref={cancel} disabled={busy} onClick={onCancel}>
          <Text source={"Cancel restore"} />
        </button>
        <button className="danger" disabled={busy} onClick={onRestore}>
          <Text source={"Replace archive"} />
        </button>
      </div>
    </dialog>
  );
}
