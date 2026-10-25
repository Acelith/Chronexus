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
  if (outcome.error)
    return tr("Backup periodico non riuscito: {0}", [outcome.error]);
  let message = tr("Backup periodico creato e verificato.");
  if (outcome.removed)
    message +=
      " " +
      tr("Copie periodiche precedenti eliminate: {0}.", [outcome.removed]);
  if (outcome.keptUnverified)
    message +=
      " " +
      tr(
        "{0} copie modificate fuori da Chronexus sono state lasciate intatte.",
        [outcome.keptUnverified],
      );
  return message;
}
/** M19: global backup folder and periodic schedule; available without a campaign. */
export default function BackupSettings({ disabled }: { disabled: boolean }) {
  const [status, setStatus] = useState<BackupFolderStatus | null>(null);
  const [draft, setDraft] = useState<BackupSchedule | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
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
  }, []);
  const busy = disabled || pending;
  async function perform(action: () => Promise<string | void>) {
    if (busy) return;
    setPending(true);
    setError("");
    setNotice("");
    try {
      const message = await action();
      if (message) setNotice(message);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setPending(false);
    }
  }
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
          "Chronexus può salvare copie verificate di tutte le campagne, con immagini e allegati, nella cartella Chronexus dei tuoi Documenti. La cartella viene creata solo al primo backup.",
        )}
      </p>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      <p role="status" className="muted">
        {pending ? tr("Operazione sui backup in corso…") : notice}
      </p>
      {!status && !error ? (
        <p role="status">{tr("Lettura delle impostazioni…")}</p>
      ) : null}
      {status && draft ? (
        <>
          <dl className="ai-setup-status backup-folder-status">
            <div>
              <dt>{tr("Backup periodici")}</dt>
              <dd>
                <bdi>{status.periodicFolder ?? tr("Non disponibile")}</bdi>
                {status.preferences.destination
                  ? ` · ${tr("cartella scelta da te")}`
                  : ""}
              </dd>
            </div>
            <div>
              <dt>{tr("Backup aggiornamenti")}</dt>
              <dd>
                <bdi>
                  {status.updatesFolder ?? tr("Cartella dati di Chronexus")}
                </bdi>
              </dd>
            </div>
            <div>
              <dt>{tr("Ultimo backup periodico")}</dt>
              <dd>{when(status.lastSuccess, tr("Nessuno finora"))}</dd>
            </div>
            <div>
              <dt>{tr("Prossimo backup")}</dt>
              <dd>
                {!status.preferences.enabled
                  ? tr("Backup periodici disattivati")
                  : status.dueNow
                    ? tr("Al prossimo momento di inattività")
                    : when(status.nextDue, "—")}
              </dd>
            </div>
            <div>
              <dt>{tr("Copie registrate")}</dt>
              <dd>{status.registered}</dd>
            </div>
          </dl>
          {status.lastError ? (
            <p className="error backup-last-error">
              {tr("Ultimo tentativo non riuscito ({0}): {1}", [
                when(status.lastAttempt, "—"),
                status.lastError,
              ])}{" "}
              {tr(
                "Chronexus riproverà al prossimo intervallo; puoi anche scegliere un’altra cartella o eseguire un backup ora.",
              )}
            </p>
          ) : null}
          {status.cloudSynced ? (
            <p className="backup-cloud-warning" role="note">
              {tr(
                "Attenzione: la cartella sembra sincronizzata con un servizio cloud (per esempio OneDrive). I file .nodex non sono cifrati e verrebbero caricati online insieme alle campagne.",
              )}
            </p>
          ) : null}
          <form
            className="backup-schedule"
            onSubmit={(event) => {
              event.preventDefault();
              void perform(async () => {
                adopt(await backupFolderApi.saveSchedule(draft));
                return tr("Pianificazione dei backup salvata.");
              });
            }}
          >
            <fieldset disabled={busy}>
              <legend>{tr("Backup periodici")}</legend>
              <label className="language-checkbox">
                <input
                  type="checkbox"
                  checked={draft.enabled}
                  onChange={(e) =>
                    setDraft({ ...draft, enabled: e.target.checked })
                  }
                />
                {tr(
                  "Crea backup periodici mentre Chronexus è aperto e inattivo",
                )}
              </label>
              <label>
                {tr("Frequenza")}
                <select
                  value={draft.frequency}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      frequency: e.target.value as BackupFrequency,
                    })
                  }
                >
                  <option value="daily">{tr("Ogni giorno")}</option>
                  <option value="weekly">{tr("Ogni settimana")}</option>
                  <option value="hours">{tr("Ogni N ore")}</option>
                </select>
              </label>
              {draft.frequency === "hours" ? (
                <label>
                  {tr("Ore tra un backup e il successivo (2–72)")}
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
                {tr("Copie periodiche da conservare (1–60)")}
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
                  "Il backup parte solo quando non stai scrivendo e non sono in corso salvataggi, ripristini, aggiornamenti o operazioni AI. Dopo un nuovo backup verificato Chronexus elimina solo le copie periodiche più vecchie che ha creato e registrato; backup manuali, copie di sicurezza e backup di aggiornamento non vengono mai toccati.",
                )}
              </p>
              <div className="actions">
                <button className="primary" type="submit" disabled={!changed}>
                  {tr("Salva pianificazione")}
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
              {tr("Esegui backup ora")}
            </button>
            <button
              disabled={busy}
              onClick={() =>
                void perform(async () => {
                  const next = await backupFolderApi.chooseDestination();
                  if (!next) return tr("Nessuna cartella scelta.");
                  adopt(next);
                  return tr(
                    "Cartella dei backup periodici cambiata. I backup già creati restano dove sono.",
                  );
                })
              }
            >
              {tr("Scegli un’altra cartella…")}
            </button>
            {status.preferences.destination ? (
              <button
                disabled={busy}
                onClick={() =>
                  void perform(async () => {
                    adopt(await backupFolderApi.resetDestination());
                    return tr(
                      "I prossimi backup periodici andranno nei Documenti. I backup già creati restano dove sono.",
                    );
                  })
                }
              >
                {tr("Usa la cartella Documenti")}
              </button>
            ) : null}
            <button
              disabled={busy}
              onClick={() =>
                void perform(async () => {
                  const path = await backupFolderApi.open(
                    status.preferences.destination ? "custom" : "periodic",
                  );
                  return tr("Cartella aperta: {0}", [path]);
                })
              }
            >
              {tr("Apri cartella dei backup")}
            </button>
          </div>
          <p className="muted">
            {tr(
              "Le preferenze dei backup valgono per tutte le campagne, restano invariate dopo un ripristino e sono incluse nella ricevuta dei backup di aggiornamento.",
            )}
          </p>
        </>
      ) : null}
    </section>
  );
}
