import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  trainingApi,
  type TrainingOverview,
  type TrainingProgress,
} from "./trainingApi";
import { assistantApi } from "./api";
import { errorMessage } from "../journal/api";
import type { SaveGuard } from "../journal/Editor";
const labels: Record<string, string> = {
  running: "In corso",
  ready: "Validato · disponibile per attivazione",
  cancelled: "Annullato",
  error: "Non riuscito",
  interrupted: "Interrotto",
};
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
      message: "Preparazione del dataset approvato…",
    });
    const promise = trainingApi
      .start(campaignId, id, overview.datasetHash, (p) => {
        if (mounted.current) setProgress(p);
      })
      .then(async (result) => {
        if (mounted.current) {
          setNotice(
            result.status === "ready"
              ? "Addestramento e verifiche conclusi. Il modello precedente resta attivo finché scegli Attiva adapter."
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
      message:
        "Verifica e attivazione adapter; ricostruzione locale se necessaria…",
    });
    const promise = trainingApi
      .activate(campaignId, id)
      .then(async () => {
        await onActivated();
        if (mounted.current)
          setNotice(
            "Adapter attivato soltanto per questa campagna. Per tornare indietro scegli il modello base o un adapter precedente ancora compatibile con le fonti.",
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
      <legend>Riaddestramento locale · Gemma 4 12B</legend>
      <p>
        L'aggiornamento delle conoscenze non cambia i pesi. Questo comando
        esegue QLoRA sulla GPU: prepara un nuovo adapter da tutte le fonti
        attualmente approvate, includendo le correzioni, senza accumulare vecchi
        appunti esclusi.
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {!overview ? (
        <p role="status">Caricamento stato addestramento…</p>
      ) : (
        <>
          <p>
            {overview.added} estratti nuovi · {overview.changed} modificati ·{" "}
            {overview.removed} rimossi rispetto all'ultimo addestramento
            riuscito. Totale: {overview.sources} estratti.
          </p>
          <p>
            Ultimo addestramento riuscito:{" "}
            {overview.jobs.find((j) => j.status === "ready")?.createdAt
              ? new Date(
                  overview.jobs.find((j) => j.status === "ready")!.createdAt,
                ).toLocaleString("it-IT")
              : "Mai eseguito"}
          </p>
          {!overview.backendInstalled && (
            <p>
              Ambiente QLoRA non installato. Occorre la preparazione locale
              descritta in docs/AI_TRAINING.md; l'app non scarica dipendenze o
              modelli automaticamente.
            </p>
          )}
          {overview.blocked > 0 && (
            <p role="alert">
              {overview.blocked} estratti contengono possibili istruzioni al
              modello. Escludi o correggi queste fonti prima di addestrare.
            </p>
          )}
          <button
            disabled={
              disabled ||
              running ||
              !overview.backendInstalled ||
              !overview.sources ||
              overview.blocked > 0
            }
            onClick={() => setConfirm(true)}
          >
            Riaddestra sui nuovi dati
          </button>
          {confirm && (
            <div role="group" aria-label="Conferma riaddestramento">
              <p>
                Verranno usati {overview.sources} estratti della sola campagna
                corrente. Nessun invio a servizi esterni. QLoRA modifica un
                adapter separato; i pesi base restano immutabili. Il lavoro può
                richiedere diversi minuti e molta VRAM. I pesi derivati per
                Ollama restano fuori dal backup; adapter e metadati sono
                inclusi. Il risultato dovrà superare le verifiche prima
                dell'attivazione esplicita.
              </p>
              <button disabled={disabled || running} onClick={start}>
                Conferma riaddestramento locale
              </button>
              <button onClick={() => setConfirm(false)}>
                Torna alle impostazioni
              </button>
            </div>
          )}
          {running && (
            <div role="status">
              <p>{progress?.message || "Operazione locale in corso…"}</p>
              {progress?.step != null && progress.steps != null && (
                <>
                  <progress value={progress.step} max={progress.steps} />
                  <p>
                    Passaggio {progress.step} di {progress.steps}
                  </p>
                </>
              )}
              <button onClick={() => void cancel()}>
                Annulla addestramento
              </button>
            </div>
          )}
          <h3>Cronologia degli adapter</h3>
          {overview.jobs.length === 0 ? (
            <p>Nessun addestramento eseguito per questa campagna.</p>
          ) : (
            overview.jobs.map((j) => (
              <article key={j.id}>
                <strong>{labels[j.status] || j.status}</strong>
                <p>
                  {new Date(j.createdAt).toLocaleString("it-IT")} ·{" "}
                  {j.manifest.length} estratti
                </p>
                {j.error && <p className="error">{j.error}</p>}
                {j.status === "ready" && (
                  <>
                    <p>
                      {j.model} · GPU: {String(j.metrics.gpu || "non indicata")}{" "}
                      · passaggi: {String(j.metrics.steps || 0)}
                    </p>
                    <button
                      disabled={disabled || running}
                      onClick={() => void activate(j.id)}
                    >
                      Attiva adapter
                    </button>
                  </>
                )}
              </article>
            ))
          )}
        </>
      )}
    </fieldset>
  );
}
