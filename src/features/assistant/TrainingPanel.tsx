import { systemMessage } from "../../i18n/store";
import { localeInfo } from "../../i18n/locales";
import { getPreferences } from "../../i18n/store";
import { Text } from "../../i18n/Text";
import { localizeLabels, tr } from "../../i18n/store";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  trainingApi,
  type TrainingOverview,
  type TrainingProgress,
} from "./trainingApi";
import { assistantApi } from "./api";
import { errorMessage } from "../journal/api";
import type { SaveGuard } from "../journal/Editor";
const labels: Record<string, string> = localizeLabels({
  running: "In corso",
  ready: "Validato · disponibile per attivazione",
  cancelled: "Annullato",
  error: "Non riuscito",
  interrupted: "Interrotto",
});
export default function TrainingPanel({
  campaignId,
  disabled,
  version,
  register,
  onActive,
  onActivated,
}: {
  campaignId: string;
  disabled: boolean;
  version: string;
  register?: (g: SaveGuard | null) => void;
  onActive: (v: boolean) => void;
  onActivated: () => Promise<void>;
}) {
  const [overview, setOverview] = useState<TrainingOverview | null>(null),
    [error, setError] = useState(""),
    [confirm, setConfirm] = useState(false),
    [running, setRunning] = useState(false),
    [progress, setProgress] = useState<TrainingProgress | null>(null),
    [notice, setNotice] = useState("");
  const job = useRef<{ id: string; promise: Promise<void> } | null>(null),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    void trainingApi
      .get(campaignId)
      .then((v) => {
        if (active) setOverview(v);
      })
      .catch((e) => {
        if (active) setError(errorMessage(e));
      });
    return () => {
      active = false;
    };
  }, [campaignId, version]);
  useLayoutEffect(() => {
    register?.({
      dirty: () => job.current !== null,
      flush: async () => {
        const active = job.current;
        if (active) {
          await assistantApi.cancel(active.id);
          await active.promise;
        }
      },
    });
    return () => register?.(null);
  }, [register]);
  function start() {
    if (job.current || !overview) return;
    const id = crypto.randomUUID();
    setRunning(true);
    onActive(true);
    setError("");
    setConfirm(false);
    setNotice("");
    setProgress({
      phase: "preparing",
      message: tr("Preparazione del dataset approvato…"),
    });
    const promise = trainingApi
      .start(campaignId, id, overview.datasetHash, (p) => {
        if (mounted.current) setProgress(p);
      })
      .then(async (result) => {
        if (mounted.current) {
          setNotice(
            result.status === "ready"
              ? tr(
                  "Addestramento e verifiche conclusi. Il modello precedente resta attivo finché scegli Attiva adapter.",
                )
              : result.error,
          );
          setOverview(await trainingApi.get(campaignId));
        }
      })
      .catch((e) => {
        if (mounted.current) setError(errorMessage(e));
      })
      .finally(() => {
        job.current = null;
        if (mounted.current) {
          setRunning(false);
          onActive(false);
        }
      });
    job.current = { id, promise };
  }
  async function cancel() {
    if (!job.current) return;
    try {
      await assistantApi.cancel(job.current.id);
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  function activate(id: string) {
    if (job.current) return;
    setError("");
    setRunning(true);
    onActive(true);
    setProgress({
      phase: "activating",
      message: tr(
        "Verifica e attivazione adapter; ricostruzione locale se necessaria…",
      ),
    });
    const promise = trainingApi
      .activate(campaignId, id)
      .then(async () => {
        await onActivated();
        if (mounted.current)
          setNotice(
            tr(
              "Adapter attivato soltanto per questa campagna. Per tornare indietro scegli il modello base o un adapter precedente ancora compatibile con le fonti.",
            ),
          );
      })
      .catch((e) => {
        if (mounted.current) setError(errorMessage(e));
      })
      .finally(() => {
        job.current = null;
        if (mounted.current) {
          setRunning(false);
          onActive(false);
        }
      });
    job.current = { id, promise };
  }
  return (
    <fieldset className="training-panel">
      <legend>
        <Text source={"Riaddestramento locale · Gemma 4 12B"} />
      </legend>
      <p>
        <Text
          source={
            "L'aggiornamento delle conoscenze non cambia i pesi. Questo comando esegue QLoRA sulla GPU: prepara un nuovo adapter da tutte le fonti attualmente approvate, includendo le correzioni, senza accumulare vecchi appunti esclusi."
          }
        />
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {!overview ? (
        error ? (
          <button
            onClick={() => {
              setError("");
              void trainingApi
                .get(campaignId)
                .then(setOverview)
                .catch((e) => setError(errorMessage(e)));
            }}
          >
            <Text source={"Riprova stato addestramento"} />
          </button>
        ) : (
          <p role="status">
            <Text source={"Caricamento stato addestramento…"} />
          </p>
        )
      ) : (
        <>
          <p>
            {overview.added} <Text source={" estratti nuovi · "} />
            {overview.changed} <Text source={" modificati ·"} />{" "}
            {overview.removed}{" "}
            <Text
              source={
                " rimossi rispetto all'ultimo addestramento riuscito. Totale: "
              }
            />
            {overview.sources} <Text source={" estratti."} />
          </p>
          <p>
            <Text source={"Dimensione degli estratti: "} />
            {Math.ceil(overview.datasetBytes / 1024)}{" "}
            <Text
              source={
                "KiB. L'addestramento usa la GPU e include tutti gli estratti approvati. Se la selezione supera i limiti viene richiesta una riduzione, senza omettere dati automaticamente per abbreviare il lavoro."
              }
            />
          </p>
          <p>
            <Text source={"Ultimo addestramento riuscito:"} />{" "}
            {overview.jobs.find((j) => j.status === "ready")?.createdAt
              ? new Date(
                  overview.jobs.find((j) => j.status === "ready")!.createdAt,
                ).toLocaleString(localeInfo(getPreferences().locale).intl)
              : tr("Mai eseguito")}
          </p>
          {!overview.backendInstalled && (
            <p>
              <Text
                source={
                  "Ambiente QLoRA non installato. Occorre la preparazione locale descritta in docs/AI_TRAINING.md; l'app non scarica dipendenze o modelli automaticamente."
                }
              />
            </p>
          )}
          {!overview.trainingSupported && (
            <p role="status">
              <Text source="Il riaddestramento è qualificato solo per Gemma 4 12B. Per usarlo, scegli e attiva Gemma come opzione secondaria; Qwen3.8-27B resta disponibile per assistente e traduzioni." />
            </p>
          )}
          {overview.blocked > 0 && (
            <p role="alert">
              {overview.blocked}{" "}
              <Text
                source={
                  " estratti contengono possibili istruzioni al modello. Escludi o correggi queste fonti prima di addestrare."
                }
              />
            </p>
          )}
          <button
            disabled={
              disabled ||
              running ||
              !overview.backendInstalled ||
              !overview.trainingSupported ||
              !overview.sources ||
              overview.blocked > 0
            }
            onClick={() => setConfirm(true)}
          >
            <Text source={"Riaddestra sui nuovi dati"} />
          </button>
          {confirm && (
            <div role="group" aria-label={tr("Conferma riaddestramento")}>
              <p>
                <Text source={"Verranno usati "} />
                {overview.sources}{" "}
                <Text
                  source={
                    " estratti della sola campagna corrente. Nessun invio a servizi esterni. QLoRA modifica un adapter separato; i pesi base restano immutabili. Il lavoro può richiedere diversi minuti e molta VRAM. I pesi derivati per Ollama restano fuori dal backup; adapter e metadati sono inclusi. Il risultato dovrà superare le verifiche prima dell'attivazione esplicita."
                  }
                />
              </p>
              <button disabled={disabled || running} onClick={start}>
                <Text source={"Conferma riaddestramento locale"} />
              </button>
              <button onClick={() => setConfirm(false)}>
                <Text source={"Torna alle impostazioni"} />
              </button>
            </div>
          )}
          {running && (
            <div role="status">
              <p>
                {systemMessage(progress?.message) ||
                  tr("Operazione locale in corso…")}
              </p>
              {progress?.step != null && progress.steps != null && (
                <>
                  <progress value={progress.step} max={progress.steps} />
                  <p>
                    <Text source={"Passaggio "} />
                    {progress.step} <Text source={" di "} />
                    {progress.steps}
                  </p>
                </>
              )}
              <button onClick={() => void cancel()}>
                <Text source={"Annulla addestramento"} />
              </button>
            </div>
          )}
          <h3>
            <Text source={"Cronologia degli adapter"} />
          </h3>
          {overview.jobs.length === 0 ? (
            <p>
              <Text
                source={"Nessun addestramento eseguito per questa campagna."}
              />
            </p>
          ) : (
            overview.jobs.map((j) => (
              <TrainingJob
                key={j.id}
                j={j}
                disabled={disabled || running}
                onActivate={() => void activate(j.id)}
              />
            ))
          )}
        </>
      )}
    </fieldset>
  );
}

function TrainingJob({
  j,
  disabled,
  onActivate,
}: {
  j: TrainingOverview["jobs"][number];
  disabled: boolean;
  onActivate: () => void;
}) {
  return (
    <article key={j.id}>
      <strong>{labels[j.status] || j.status}</strong>
      <p>
        {new Date(j.createdAt).toLocaleString(
          localeInfo(getPreferences().locale).intl,
        )}{" "}
        · {j.manifest.length} <Text source={" estratti"} />
      </p>
      {j.error && <p className="error">{systemMessage(j.error)}</p>}
      {j.status === "ready" && (
        <>
          <p>
            {j.model} <Text source={" · GPU: "} />
            {String(j.metrics.gpu || tr("non indicata"))}{" "}
            <Text source={"· passaggi: "} />
            {String(j.metrics.steps || 0)}
          </p>
          <button disabled={disabled} onClick={onActivate}>
            <Text source={"Attiva adapter"} />
          </button>
        </>
      )}
    </article>
  );
}
