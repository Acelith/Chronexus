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
  running: "In progress",
  ready: "Validated · available for activation",
  cancelled: "Cancelled",
  error: "Failed",
  interrupted: "Interrupted",
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
      message: tr("Preparing the approved dataset…"),
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
                  "Training and checks finished. The previous model stays active until you choose Activate adapter.",
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
        "Checking and activating the adapter; rebuilding locally if needed…",
      ),
    });
    const promise = trainingApi
      .activate(campaignId, id)
      .then(async () => {
        await onActivated();
        if (mounted.current)
          setNotice(
            tr(
              "Adapter activated for this campaign only. To go back, choose the base model or an earlier adapter that is still compatible with the sources.",
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
        <Text source={"Local retraining · Gemma 4 12B"} />
      </legend>
      <p>
        <Text
          source={
            "Refreshing knowledge does not change the weights. This command runs QLoRA on the GPU: it prepares a new adapter from all currently approved sources, including corrections, without accumulating old excluded notes."
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
            <Text source={"Retry training status"} />
          </button>
        ) : (
          <p role="status">
            <Text source={"Loading training status…"} />
          </p>
        )
      ) : (
        <>
          <p>
            {overview.added} <Text source={" new excerpts · "} />
            {overview.changed} <Text source={" changed ·"} /> {overview.removed}{" "}
            <Text
              source={" removed since the last successful training. Total: "}
            />
            {overview.sources} <Text source={" excerpts."} />
          </p>
          <p>
            <Text source={"Excerpt size: "} />
            {Math.ceil(overview.datasetBytes / 1024)}{" "}
            <Text
              source={
                "KiB. Training uses the GPU and includes all approved excerpts. If the selection exceeds the limits you are asked to reduce it; no data is dropped automatically to shorten the job."
              }
            />
          </p>
          <p>
            <Text source={"Last successful training:"} />{" "}
            {overview.jobs.find((j) => j.status === "ready")?.createdAt
              ? new Date(
                  overview.jobs.find((j) => j.status === "ready")!.createdAt,
                ).toLocaleString(localeInfo(getPreferences().locale).intl)
              : tr("Never run")}
          </p>
          {!overview.backendInstalled && (
            <p>
              <Text
                source={
                  "QLoRA environment not installed. It needs the local setup described in docs/AI_TRAINING.md; the app never downloads dependencies or models automatically."
                }
              />
            </p>
          )}
          {!overview.trainingSupported && (
            <p role="status">
              <Text source="Retraining is qualified only for Gemma 4 12B. To use it, choose and activate Gemma as the secondary option; Qwen3.8-27B stays available for the assistant and translations." />
            </p>
          )}
          {overview.blocked > 0 && (
            <p role="alert">
              {overview.blocked}{" "}
              <Text
                source={
                  " excerpts contain possible instructions to the model. Exclude or fix these sources before training."
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
            <Text source={"Retrain on the new data"} />
          </button>
          {confirm && (
            <div role="group" aria-label={tr("Confirm retraining")}>
              <p>
                <Text source={"Will be used "} />
                {overview.sources}{" "}
                <Text
                  source={
                    " excerpts from the current campaign only. Nothing is sent to external services. QLoRA changes a separate adapter; the base weights stay unchanged. The job can take several minutes and a lot of VRAM. Derived weights for Ollama stay outside the backup; adapters and metadata are included. The result must pass the checks before explicit activation."
                  }
                />
              </p>
              <button disabled={disabled || running} onClick={start}>
                <Text source={"Confirm local retraining"} />
              </button>
              <button onClick={() => setConfirm(false)}>
                <Text source={"Back to settings"} />
              </button>
            </div>
          )}
          {running && (
            <div role="status">
              <p>
                {systemMessage(progress?.message) ||
                  tr("Local operation in progress…")}
              </p>
              {progress?.step != null && progress.steps != null && (
                <>
                  <progress value={progress.step} max={progress.steps} />
                  <p>
                    <Text source={"Step "} />
                    {progress.step} <Text source={" of "} />
                    {progress.steps}
                  </p>
                </>
              )}
              <button onClick={() => void cancel()}>
                <Text source={"Cancel training"} />
              </button>
            </div>
          )}
          <h3>
            <Text source={"Adapter history"} />
          </h3>
          {overview.jobs.length === 0 ? (
            <p>
              <Text source={"No training run for this campaign."} />
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
        · {j.manifest.length} <Text source={" excerpts"} />
      </p>
      {j.error && <p className="error">{systemMessage(j.error)}</p>}
      {j.status === "ready" && (
        <>
          <p>
            {j.model} <Text source={" · GPU: "} />
            {String(j.metrics.gpu || tr("not given"))}{" "}
            <Text source={"· steps: "} />
            {String(j.metrics.steps || 0)}
          </p>
          <button disabled={disabled} onClick={onActivate}>
            <Text source={"Activate adapter"} />
          </button>
        </>
      )}
    </article>
  );
}
