import { systemMessage } from "../../i18n/store";
import { date as formatDateTime } from "../../i18n/store";
import { Text } from "../../i18n/Text";
import { tr } from "../../i18n/store";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { SaveGuard } from "../journal/Editor";
import { errorMessage } from "../journal/api";
import {
  backupApi,
  type ArchiveCounts,
  type BackupPreview,
  type BackupReceipt,
  type RestoreReceipt,
} from "./api";

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
  useEffect(() => {
    register({
      dirty: () => operation.current || preview !== null,
      flush: async () => {
        if (operation.current)
          throw new Error(
            tr(
              "Attendi il completamento dell'operazione di backup o ripristino.",
            ),
          );
        if (preview)
          throw new Error(
            tr(
              "Conferma o annulla il ripristino prima di cambiare vista o chiudere Chronexus.",
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
      setStatus(tr("Ripristino annullato. L'archivio corrente è invariato."));
      choose.current?.focus();
    }, tr("Annullamento…"));
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
        setStatus(tr("Ripristino completato. Copia preventiva conservata."));
      } catch (reason) {
        setPreview(null);
        choose.current?.focus();
        throw reason;
      }
    }, tr("Creazione della copia preventiva e ripristino in corso. Attendi prima di chiudere Chronexus…"));
  }
  return (
    <section
      className="backup-workspace"
      aria-labelledby="backup-title"
      aria-busy={busy}
    >
      <header className="backup-heading">
        <h2 id="backup-title">
          <Text source={"Backup e ripristino"} />
        </h2>
        <p>
          <Text
            source={
              "Porta con te tutte le campagne, gli appunti, i collegamenti e gli allegati gestiti da Chronexus."
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
          aria-label={tr("Ripristino completato")}
        >
          <h3>
            <Text source={"Archivio ripristinato"} />
          </h3>
          <p>
            <Text
              source={
                "Le campagne ripristinate sono disponibili nella barra laterale."
              }
            />
          </p>
          <ArchiveSummary counts={restored.counts} />
          <p>
            <Text
              source={
                "La copia precedente può essere recuperata selezionando questo backup:"
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
                <Text source={"Conserva una copia"} />
              </h3>
              <p>
                <Text
                  source={
                    "Un unico file .nodex contiene l’intero archivio. Scegli una cartella sul computer, su un disco esterno o su un’unità di rete montata."
                  }
                />
              </p>
              <p>
                <Text
                  source={
                    "I backup esistenti non vengono sovrascritti: scegli sempre un nuovo nome."
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
                      ? tr("Backup creato e verificato.")
                      : tr("Backup annullato. Nessun file creato."),
                  );
                }, tr("Scelta della destinazione e creazione del backup…"));
              }}
            >
              <Text source={"Crea backup"} />
            </button>
          </section>
          {backup ? (
            <section
              className="backup-receipt"
              aria-label={tr("Backup creato")}
            >
              <h3>
                <Text source={"Backup creato e verificato"} />
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
                <Text source={"Recupera un archivio"} />
              </h3>
              <p>
                <Text
                  source={
                    "Seleziona un file .nodex. Chronexus lo controlla e ti mostra il contenuto prima di chiederti conferma."
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
                      ? tr(
                          "Backup verificato. Conferma o annulla il ripristino.",
                        )
                      : tr("Selezione annullata. Archivio invariato."),
                  );
                }, tr("Selezione e verifica del backup…"));
              }}
            >
              <Text source={"Seleziona backup"} />
            </button>
          </section>
          <p className="backup-footnote">
            <Text
              source={
                "Il file .nodex non è cifrato: conservalo in una posizione privata. Sono inclusi gli allegati gestiti nella cartella dati; eventuali file esterni citati negli appunti restano esterni."
              }
            />
          </p>
        </>
      )}
    </section>
  );
}

function ArchiveSummary({ counts }: { counts: ArchiveCounts }) {
  return (
    <dl className="archive-counts">
      {(
        [
          [tr("Campagne"), counts.campaigns],
          [tr("Sessioni"), counts.sessions],
          [tr("Pagine"), counts.pages],
          [tr("Menzioni"), counts.mentions],
          [tr("Relazioni"), counts.relationships],
          [tr("Allegati"), counts.attachments],
          [tr("Personaggi"), counts.characters ?? 0],
          [tr("Oggetti"), counts.items ?? 0],
          [tr("Capacità e incantesimi"), counts.spells ?? 0],
          [tr("Tiri di dado"), counts.diceRolls ?? 0],
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
        <Text source={"Sostituire l’intero archivio?"} />
      </h3>
      <p id="restore-warning">
        {tr(
          "Tutte le campagne attuali saranno sostituite da quelle di {0}. Prima verrà salvata una copia di sicurezza dell’archivio corrente. Non verrà effettuata una fusione.",
          [preview.fileName],
        )}
      </p>
      <p>
        {tr("Backup del {0}. Integrità dei file e del database verificata.", [
          formatDateTime(preview.manifest.created_at, {
            dateStyle: "long",
            timeStyle: "short",
          }),
        ])}
      </p>
      <ArchiveSummary counts={preview.manifest.counts} />
      <div className="actions">
        <button ref={cancel} disabled={busy} onClick={onCancel}>
          <Text source={"Annulla ripristino"} />
        </button>
        <button className="danger" disabled={busy} onClick={onRestore}>
          <Text source={"Sostituisci archivio"} />
        </button>
      </div>
    </dialog>
  );
}
