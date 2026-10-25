import { useState } from "react";
import { localeInfo } from "../../i18n/locales";
import { getPreferences, tr } from "../../i18n/store";
import { errorMessage } from "../journal/api";
import {
  aiSetupApi,
  OLLAMA_SOURCE,
  type ModelState,
  type SetupProgress,
  type SetupStatus,
} from "./api";

function gb(bytes: number) {
  return new Intl.NumberFormat(localeInfo(getPreferences().locale).intl, {
    maximumFractionDigits: 1,
  }).format(bytes / 1e9);
}
const stateLabels: Record<ModelState["state"], string> = {
  ready: "Pronto",
  absent: "Non presente",
  unqualified: "Presente ma con pesi non qualificati",
  unknown: "Da verificare (runtime non attivo)",
};
type Confirm = "runtime" | "model" | "remove" | null;
/** M22: guided local AI setup. Opening it reads nothing from the network. */
export default function AiSetupSettings({ disabled }: { disabled: boolean }) {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [role, setRole] = useState<ModelState["role"]>("primary");
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [progress, setProgress] = useState<SetupProgress | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const busy = disabled || !!pending;
  async function perform(name: string, action: () => Promise<string | void>) {
    if (busy) return;
    setPending(name);
    setError("");
    setNotice("");
    setConfirm(null);
    try {
      const message = await action();
      if (message) setNotice(message);
      setStatus(await aiSetupApi.status());
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setPending(null);
      setProgress(null);
    }
  }
  const model = status?.models.find((m) => m.role === role);
  const runtimeReady = status?.runtime === "ready";
  const percent =
    progress?.total && progress.total > 0
      ? Math.min(100, Math.round((progress.done / progress.total) * 100))
      : null;
  return (
    <section
      className="language-settings ai-setup"
      aria-label={tr("AI locale: componenti")}
    >
      <h3>{tr("AI locale: componenti")}</h3>
      <p>
        {tr(
          "Prepara qui Ollama e il modello per l’assistente e la traduzione della wiki. È facoltativo: Chronexus funziona anche senza AI. Nulla viene scaricato o avviato senza il tuo clic, e queste operazioni non inviano dati delle campagne.",
        )}
      </p>
      <div className="actions">
        <button
          disabled={busy}
          onClick={() => void perform("status", async () => undefined)}
        >
          {pending === "status"
            ? tr("Controllo in corso…")
            : tr("Controlla componenti")}
        </button>
      </div>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {status ? (
        <>
          {!status.supportedPlatform ? (
            <p className="muted">
              {tr(
                "L’installazione guidata di Ollama è disponibile per ora solo su Windows x64. Su questo sistema installa Ollama manualmente con OLLAMA_NO_CLOUD=1; il download del modello resta disponibile qui.",
              )}
            </p>
          ) : null}
          <dl className="ai-setup-status">
            <div>
              <dt>{tr("Ollama")}</dt>
              <dd>
                {status.runtime === "ready"
                  ? tr("Attivo in locale, cloud disabilitato · versione {0}", [
                      status.runtimeVersion ?? "?",
                    ])
                  : status.runtime === "cloud"
                    ? tr(
                        "Attivo ma senza cloud disabilitato: Chronexus non lo usa. Riavvialo con OLLAMA_NO_CLOUD=1.",
                      )
                    : status.managedInstalled
                      ? tr("Installato da Chronexus, non avviato")
                      : tr("Non attivo su questo computer")}
                {status.managedRunning
                  ? " · " + tr("avviato da Chronexus")
                  : ""}
              </dd>
            </div>
            <div>
              <dt>{tr("Scheda grafica")}</dt>
              <dd>
                {status.gpus.length
                  ? status.gpus
                      .map((g) =>
                        tr("{0} · {1} GB di memoria video", [
                          g.name,
                          gb(Math.round(g.memoryMib / 1024) * 1e9),
                        ]),
                      )
                      .join("; ")
                  : tr(
                      "Nessuna GPU NVIDIA rilevata: senza GPU l’assistente non viene attivato.",
                    )}
              </dd>
            </div>
            <div>
              <dt>{tr("Spazio libero")}</dt>
              <dd>
                {status.freeBytes === null
                  ? tr("Non rilevabile")
                  : tr("{0} GB", [gb(status.freeBytes)])}
              </dd>
            </div>
            {status.models.map((m) => (
              <div key={m.role}>
                <dt>
                  {m.label} ·{" "}
                  {m.role === "primary" ? tr("Principale") : tr("Secondario")}
                </dt>
                <dd>{tr(stateLabels[m.state])}</dd>
              </div>
            ))}
          </dl>
          <div className="actions">
            {!status.managedInstalled &&
            status.runtime === "stopped" &&
            status.supportedPlatform ? (
              <button
                className="primary"
                disabled={busy}
                onClick={() => setConfirm("runtime")}
              >
                {tr("Installa Ollama…")}
              </button>
            ) : null}
            {status.managedInstalled && status.runtime === "stopped" ? (
              <button
                className="primary"
                disabled={busy}
                onClick={() => void perform("start", aiSetupApi.start)}
              >
                {pending === "start"
                  ? tr("Avvio in corso…")
                  : tr("Avvia Ollama")}
              </button>
            ) : null}
            {status.managedRunning ? (
              <button
                disabled={busy}
                onClick={() =>
                  void perform("stop", async () => {
                    await aiSetupApi.stop();
                    return tr("Ollama arrestato.");
                  })
                }
              >
                {tr("Arresta Ollama")}
              </button>
            ) : null}
            {status.managedInstalled && !status.managedRunning ? (
              <button disabled={busy} onClick={() => setConfirm("remove")}>
                {tr("Rimuovi il runtime gestito…")}
              </button>
            ) : null}
          </div>
          {status.managedInstalled ? (
            <p className="muted">
              {tr(
                "Il runtime gestito resta attivo finché Chronexus è aperto e si arresta alla chiusura. Cartella: {0}",
                [status.runtimeDir],
              )}
            </p>
          ) : null}
          {confirm === "runtime" ? (
            <div
              className="wiki-confirm"
              role="group"
              aria-label={tr("Conferma installazione di Ollama")}
            >
              <h4>{tr("Installare Ollama 0.40.10?")}</h4>
              <ul>
                <li>
                  {tr("Download: {0} GB dall’archivio ufficiale su GitHub", [
                    gb(status.runtimeDownloadBytes),
                  ])}
                </li>
                <li>
                  {tr(
                    "Spazio necessario durante l’installazione: circa {0} GB",
                    [gb(status.runtimeInstallBytes)],
                  )}
                </li>
                <li>{tr("Destinazione: {0}", [status.runtimeDir])}</li>
                <li>{tr("Fonte: {0}", [OLLAMA_SOURCE])}</li>
                <li>
                  {tr(
                    "Licenza MIT. Impronta SHA-256 verificata prima di installare; nessun servizio di sistema e nessun permesso di amministratore.",
                  )}
                </li>
              </ul>
              <div className="actions">
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() =>
                    void perform("runtime", async () => {
                      await aiSetupApi.installRuntime(setProgress);
                      return tr(
                        "Ollama installato e verificato. Premi Avvia Ollama quando vuoi usarlo.",
                      );
                    })
                  }
                >
                  {tr("Scarica e installa")}
                </button>
                <button onClick={() => setConfirm(null)}>
                  {tr("Annulla")}
                </button>
              </div>
            </div>
          ) : null}
          {confirm === "remove" ? (
            <div
              className="wiki-confirm"
              role="group"
              aria-label={tr("Conferma rimozione")}
            >
              <p>
                {tr(
                  "Rimuovere il runtime installato da Chronexus? I modelli scaricati, le campagne e le altre installazioni di Ollama non vengono toccati.",
                )}
              </p>
              <div className="actions">
                <button
                  className="danger"
                  disabled={busy}
                  onClick={() =>
                    void perform("remove", async () => {
                      await aiSetupApi.removeRuntime();
                      return tr("Runtime gestito rimosso.");
                    })
                  }
                >
                  {tr("Rimuovi")}
                </button>
                <button onClick={() => setConfirm(null)}>
                  {tr("Annulla")}
                </button>
              </div>
            </div>
          ) : null}
          <fieldset disabled={busy} className="ai-setup-models">
            <legend>{tr("Modello da scaricare")}</legend>
            {status.models.map((m) => (
              <label key={m.role} className="checkbox-row">
                <input
                  type="radio"
                  name="ai-model"
                  checked={role === m.role}
                  onChange={() => setRole(m.role)}
                />
                {m.role === "primary"
                  ? tr(
                      "{0} · Principale · circa {1} GB · assistente e traduzioni; su 16 GB di VRAM il caricamento è misto GPU/CPU",
                      [m.label, gb(m.downloadBytes)],
                    )
                  : tr(
                      "{0} · Secondario · circa {1} GB · alternativa facoltativa, anche per il riaddestramento",
                      [m.label, gb(m.downloadBytes)],
                    )}
              </label>
            ))}
          </fieldset>
          {model?.state === "ready" ? (
            <p role="status">
              {tr(
                "{0} è pronto. Attivalo in Impostazioni della campagna → AI locale; la traduzione della wiki lo usa quando la richiedi.",
                [model.label],
              )}
            </p>
          ) : (
            <div className="actions">
              <button
                className="primary"
                disabled={busy || !runtimeReady}
                onClick={() => setConfirm("model")}
              >
                {tr("Scarica modello…")}
              </button>
              {!runtimeReady ? (
                <span className="muted">
                  {tr("Avvia prima Ollama con il cloud disabilitato.")}
                </span>
              ) : null}
            </div>
          )}
          {confirm === "model" && model ? (
            <div
              className="wiki-confirm"
              role="group"
              aria-label={tr("Conferma download del modello")}
            >
              <h4>{tr("Scaricare {0}?", [model.label])}</h4>
              <ul>
                <li>
                  {tr("Dimensione: circa {0} GB", [gb(model.downloadBytes)])}
                </li>
                <li>
                  {tr(
                    "Scaricato da Ollama dal suo registro pubblico; Chronexus verifica poi l’impronta dei pesi qualificati.",
                  )}
                </li>
                <li>
                  {tr(
                    "Destinazione: la cartella modelli del runtime attivo ({0} per il runtime gestito).",
                    [status.modelsDir],
                  )}
                </li>
                <li>
                  {tr(
                    "Nessuna campagna viene modificata o attivata automaticamente.",
                  )}
                </li>
              </ul>
              <div className="actions">
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() =>
                    void perform("model", async () => {
                      const ready = await aiSetupApi.pull(role, setProgress);
                      return tr("{0} scaricato e verificato.", [ready.label]);
                    })
                  }
                >
                  {tr("Scarica")}
                </button>
                <button onClick={() => setConfirm(null)}>
                  {tr("Annulla")}
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
      {pending === "runtime" || pending === "model" ? (
        <div aria-live="polite">
          <p role="status">
            {progress?.phase === "verify"
              ? tr("Verifica dell’integrità…")
              : progress?.phase === "extract"
                ? tr("Estrazione…")
                : tr("Download in corso…")}
            {percent !== null ? ` ${percent}%` : ""}
          </p>
          <progress
            aria-label={tr("Avanzamento")}
            max={progress?.total ?? undefined}
            value={progress?.total ? progress.done : undefined}
          />
          <button onClick={() => void aiSetupApi.cancel()}>
            {tr("Annulla download")}
          </button>
        </div>
      ) : null}
      {notice ? <p role="status">{notice}</p> : null}
    </section>
  );
}
