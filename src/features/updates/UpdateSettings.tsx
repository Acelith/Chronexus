import { useEffect, useRef, useState } from "react";
import "./herald.css";
import { tr } from "../../i18n/store";
import { errorMessage } from "../journal/api";
import {
  heraldApi,
  updatesApi,
  type HeraldSettings,
  type UpdateOffer,
  type UpdateOverview,
  type UpdateProgress,
} from "./api";
interface Props {
  busy: boolean;
  run: (action: () => Promise<void>) => Promise<unknown>;
  /** Offer accepted from the herald: download starts, install stays explicit. */
  initialOffer?: UpdateOffer | null;
  onHandoffUsed?: () => void;
}
export default function UpdateSettings({
  busy,
  run,
  initialOffer,
  onHandoffUsed,
}: Props) {
  const [overview, setOverview] = useState<UpdateOverview | null>(null);
  const [endpoint, setEndpoint] = useState("");
  const [offer, setOffer] = useState<UpdateOffer | null>(null);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [progress, setProgress] = useState<UpdateProgress | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    void updatesApi
      .overview()
      .then((value) => {
        if (active) {
          setOverview(value);
          setEndpoint(value.settings.endpoint);
        }
      })
      .catch((reason) => {
        if (active) setError(errorMessage(reason));
      });
    return () => {
      active = false;
    };
  }, []);
  const [herald, setHerald] = useState<HeraldSettings | null>(null);
  useEffect(() => {
    let active = true;
    heraldApi
      .settings()
      .then((value) => {
        if (active) setHerald(value);
      })
      .catch((reason) => {
        if (active) setError(errorMessage(reason));
      });
    return () => {
      active = false;
    };
  }, []);
  const handoff = useRef<string | null>(null);
  useEffect(() => {
    if (!initialOffer || busy || handoff.current === initialOffer.id) return;
    handoff.current = initialOffer.id;
    onHandoffUsed?.();
    // The user already chose «Aggiorna» in the herald: start the verified download.
    void perform("download", async () => {
      setOffer(initialOffer);
      setReady(false);
      setProgress(null);
      await updatesApi.download(initialOffer.id, setProgress);
      setReady(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOffer, busy]);
  async function perform(phase: string, action: () => Promise<void>) {
    if (pending || busy) return;
    setPending(phase);
    setError("");
    setNotice("");
    try {
      await run(async () => {
        try {
          await action();
        } catch (reason) {
          setError(errorMessage(reason));
          setProgress(null);
        }
      });
    } finally {
      setPending(null);
    }
  }
  const disabled = !!pending || busy;
  const changed = endpoint !== overview?.settings.endpoint;
  const labels: Record<string, string> = {
    download: tr("Download in corso…"),
    verify: tr("Verifica della firma…"),
    ready: tr("Pacchetto verificato, pronto per l’installazione."),
    backup: tr("Creazione e verifica del backup…"),
    install: tr("Avvio dell’installazione…"),
  };
  return (
    <section
      className="language-settings"
      aria-label={tr("Aggiornamenti dell’app")}
    >
      <h3>{tr("Aggiornamenti dell’app")}</h3>
      <p>
        {tr(
          "Controlla le nuove versioni di Chronexus. Il download non richiede un account e non invia i dati delle campagne.",
        )}
      </p>
      {overview ? (
        <p>
          {tr("Versione installata")}:{" "}
          <strong>{overview.currentVersion}</strong>
        </p>
      ) : !error ? (
        <p role="status">{tr("Lettura delle impostazioni…")}</p>
      ) : null}
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? <p role="status">{notice}</p> : null}
      {overview ? (
        <>
          <div className="actions">
            <button
              disabled={disabled || changed}
              onClick={() =>
                void perform("check", async () => {
                  setOffer(null);
                  setReady(false);
                  setProgress(null);
                  const next = await updatesApi.check();
                  setOffer(next);
                  if (!next)
                    setNotice(
                      tr(
                        "Chronexus è aggiornato. Nessuna nuova versione disponibile.",
                      ),
                    );
                })
              }
            >
              {pending === "check"
                ? tr("Controllo in corso…")
                : tr("Controlla aggiornamenti")}
            </button>
          </div>
          {offer ? (
            <div>
              <h4>
                {tr("Nuova versione disponibile")}: {offer.version}
              </h4>
              {offer.notes ? (
                <pre className="update-notes">{offer.notes}</pre>
              ) : (
                <p>{tr("Nessuna nota di rilascio disponibile.")}</p>
              )}
              <p>
                {tr(
                  "Prima dell’installazione viene creato un backup verificato di tutte le campagne, con immagini e allegati gestiti. Se il backup non riesce, l’aggiornamento si ferma.",
                )}
              </p>
              <p>
                {tr(
                  "L’app si chiuderà per installare l’aggiornamento. Riapri Chronexus al termine. Il runtime e i pesi AI non vengono sostituiti.",
                )}
              </p>
              <div className="actions">
                {!ready ? (
                  <button
                    className="primary"
                    disabled={disabled || changed}
                    onClick={() =>
                      void perform("download", async () => {
                        setProgress(null);
                        await updatesApi.download(offer.id, setProgress);
                        setReady(true);
                      })
                    }
                  >
                    {tr("Scarica aggiornamento")}
                  </button>
                ) : (
                  <button
                    className="primary"
                    disabled={disabled || changed}
                    onClick={() =>
                      void perform("install", async () => {
                        const path = await updatesApi.install(
                          offer.id,
                          setProgress,
                        );
                        setNotice(
                          `${tr("Aggiornamento installato. Riapri Chronexus. Backup:")} ${path}`,
                        );
                        setOffer(null);
                        setReady(false);
                      })
                    }
                  >
                    {tr("Crea backup e installa")}
                  </button>
                )}
                {pending === "download" ? (
                  <button
                    onClick={() =>
                      void updatesApi
                        .cancel()
                        .catch((reason) => setError(errorMessage(reason)))
                    }
                  >
                    {tr("Annulla download")}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
          {progress ? (
            <div aria-live="polite">
              <p role="status">
                {labels[progress.phase] ?? tr("Operazione in corso…")}
              </p>
              {progress.phase === "download" ? (
                <>
                  <progress
                    aria-label={tr("Download aggiornamento")}
                    max={progress.total ?? undefined}
                    value={progress.total ? progress.downloaded : undefined}
                  />
                  <p>
                    {(progress.downloaded / 1024 / 1024).toFixed(1)} MiB
                    {progress.total
                      ? ` / ${(progress.total / 1024 / 1024).toFixed(1)} MiB`
                      : ""}
                  </p>
                </>
              ) : null}
              {progress.backupPath ? (
                <p>
                  {tr("Backup salvato in")}: <bdi>{progress.backupPath}</bdi>
                </p>
              ) : null}
            </div>
          ) : null}
          {herald ? (
            <fieldset className="herald-settings" disabled={disabled}>
              <legend>{tr("Annuncio delle nuove versioni")}</legend>
              {(
                [
                  [
                    "startupCheck",
                    tr(
                      "Controlla una volta all’avvio (al massimo ogni 20 ore) e annuncia le nuove versioni con l’araldo",
                    ),
                  ],
                  ["sound", tr("Suona la trombetta quando appare l’araldo")],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={herald[key]}
                    onChange={(event) => {
                      const next = { ...herald, [key]: event.target.checked };
                      void perform("herald", async () => {
                        setHerald(await heraldApi.save(next));
                        setNotice(tr("Preferenze dell’annuncio salvate."));
                      });
                    }}
                  />
                  {label}
                </label>
              ))}
              <p className="muted">
                {tr(
                  "Il controllo automatico contatta solo il canale aggiornamenti, mai le wiki o i modelli AI, e non invia dati delle campagne. Il controllo manuale resta sempre disponibile.",
                )}
              </p>
            </fieldset>
          ) : null}
          <p>
            {tr(
              "I backup prima degli aggiornamenti sono conservati qui e non vengono eliminati automaticamente:",
            )}
          </p>
          <p className="update-path">
            <bdi>{overview.backupDirectory}</bdi>
          </p>
          <details>
            <summary>{tr("Server degli aggiornamenti")}</summary>
            <p>
              {tr(
                "Usa l’API pubblica dell’ultima release Forgegit o un manifesto latest.json del tuo server HTTPS. Sono accettati solo pacchetti firmati da Chronexus sullo stesso server.",
              )}
            </p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void perform("settings", async () => {
                  const settings = await updatesApi.save({ endpoint });
                  setOverview({ ...overview, settings });
                  setEndpoint(settings.endpoint);
                  setOffer(null);
                  setReady(false);
                  setProgress(null);
                  setNotice(tr("Canale aggiornamenti salvato."));
                });
              }}
            >
              <label>
                {tr("Indirizzo del canale aggiornamenti")}
                <input
                  type="url"
                  required
                  maxLength={2048}
                  value={endpoint}
                  disabled={disabled}
                  onChange={(event) => setEndpoint(event.target.value)}
                  dir="ltr"
                />
              </label>
              <button disabled={disabled || !changed}>
                {tr("Salva canale aggiornamenti")}
              </button>
              {changed ? (
                <p>
                  {tr(
                    "Salva il canale prima di controllare o installare aggiornamenti.",
                  )}
                </p>
              ) : null}
            </form>
          </details>
        </>
      ) : (
        <button
          disabled={disabled}
          onClick={() =>
            void perform("load", async () => {
              const value = await updatesApi.overview();
              setOverview(value);
              setEndpoint(value.settings.endpoint);
            })
          }
        >
          {tr("Ricarica impostazioni aggiornamenti")}
        </button>
      )}
    </section>
  );
}
