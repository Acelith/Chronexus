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
  const confirmation = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const choose = useRef<HTMLButtonElement>(null);
  const hadPreview = useRef(false);
  useEffect(() => {
    register({
      dirty: () => operation.current || preview !== null,
      flush: async () => {
        if (operation.current)
          throw new Error(
            "Attendi il completamento dell'operazione di backup o ripristino.",
          );
        if (preview)
          throw new Error(
            "Conferma o annulla il ripristino prima di cambiare vista o chiudere Nodex.",
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
      setStatus("Ripristino annullato. L'archivio corrente è invariato.");
      choose.current?.focus();
    }, "Annullamento…");
  }
  function confirmationKeys(event: KeyboardEvent<HTMLDivElement>) {
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
  return (
    <section
      className="backup-workspace"
      aria-labelledby="backup-title"
      aria-busy={busy}
    >
      <header className="backup-heading">
        <h2 id="backup-title">Backup e ripristino</h2>
        <p>
          Porta con te tutte le campagne, gli appunti, i collegamenti e gli
          allegati gestiti da Nodex.
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
        <section className="backup-receipt" aria-label="Ripristino completato">
          <h3>Archivio ripristinato</h3>
          <p>Le campagne ripristinate sono disponibili nella barra laterale.</p>
          <ArchiveSummary counts={restored.counts} />
          <p>
            La copia precedente può essere recuperata selezionando questo
            backup:
          </p>
          <p className="archive-path">{restored.safetyPath}</p>
          {restored.warning ? <p role="alert">{restored.warning}</p> : null}
        </section>
      ) : null}
      {preview ? (
        <div
          className="restore-confirmation"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="restore-title"
          aria-describedby="restore-warning"
          ref={confirmation}
          onKeyDown={confirmationKeys}
        >
          <h3 id="restore-title">Sostituire l’intero archivio?</h3>
          <p id="restore-warning">
            Tutte le campagne attuali saranno sostituite da quelle di{" "}
            <strong>{preview.fileName}</strong>. Prima verrà salvata una copia
            di sicurezza dell’archivio corrente. Non verrà effettuata una
            fusione.
          </p>
          <p>
            Backup del{" "}
            {new Intl.DateTimeFormat("it-IT", {
              dateStyle: "long",
              timeStyle: "short",
            }).format(new Date(preview.manifest.created_at))}
            . Integrità dei file e del database verificata.
          </p>
          <ArchiveSummary counts={preview.manifest.counts} />
          <div className="actions">
            <button ref={cancel} disabled={busy} onClick={cancelRestore}>
              Annulla ripristino
            </button>
            <button
              className="danger"
              disabled={busy}
              onClick={() => {
                void perform(async () => {
                  try {
                    const receipt = await backupApi.restore(preview.token);
                    setRestored(receipt);
                    setBackup(null);
                    setPreview(null);
                    await onRestored();
                    setStatus(
                      "Ripristino completato. Copia preventiva conservata.",
                    );
                  } catch (reason) {
                    setPreview(null);
                    choose.current?.focus();
                    throw reason;
                  }
                }, "Creazione della copia preventiva e ripristino in corso. Attendi prima di chiudere Nodex…");
              }}
            >
              Sostituisci archivio
            </button>
          </div>
        </div>
      ) : (
        <>
          <section
            className="backup-action"
            aria-labelledby="create-backup-title"
          >
            <div>
              <h3 id="create-backup-title">Conserva una copia</h3>
              <p>
                Un unico file .nodex contiene l’intero archivio. Scegli una
                cartella sul computer, su un disco esterno o su un’unità di rete
                montata.
              </p>
              <p>
                I backup esistenti non vengono sovrascritti: scegli sempre un
                nuovo nome.
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
                      ? "Backup creato e verificato."
                      : "Backup annullato. Nessun file creato.",
                  );
                }, "Scelta della destinazione e creazione del backup…");
              }}
            >
              Crea backup
            </button>
          </section>
          {backup ? (
            <section className="backup-receipt" aria-label="Backup creato">
              <h3>Backup creato e verificato</h3>
              <p className="archive-path">{backup.path}</p>
              <ArchiveSummary counts={backup.counts} />
            </section>
          ) : null}
          <section
            className="backup-action"
            aria-labelledby="choose-backup-title"
          >
            <div>
              <h3 id="choose-backup-title">Recupera un archivio</h3>
              <p>
                Seleziona un file .nodex. Nodex lo controlla e ti mostra il
                contenuto prima di chiederti conferma.
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
                      ? "Backup verificato. Conferma o annulla il ripristino."
                      : "Selezione annullata. Archivio invariato.",
                  );
                }, "Selezione e verifica del backup…");
              }}
            >
              Seleziona backup
            </button>
          </section>
          <p className="backup-footnote">
            Il file .nodex non è cifrato: conservalo in una posizione privata.
            Sono inclusi gli allegati gestiti nella cartella dati; eventuali
            file esterni citati negli appunti restano esterni.
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
          ["Campagne", counts.campaigns],
          ["Sessioni", counts.sessions],
          ["Pagine", counts.pages],
          ["Menzioni", counts.mentions],
          ["Relazioni", counts.relationships],
          ["Allegati", counts.attachments],
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
