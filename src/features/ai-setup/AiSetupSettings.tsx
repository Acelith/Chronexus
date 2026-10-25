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
  ready: "Ready",
  absent: "Not present",
  unqualified: "Present but with unqualified weights",
  unknown: "To be checked (runtime not running)",
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
      aria-label={tr("Local AI: components")}
    >
      <h3>{tr("Local AI: components")}</h3>
      <p>
        {tr(
          "Set up Ollama and the model for the assistant and wiki translation here. It is optional: Chronexus works without AI too. Nothing is downloaded or started without your click, and these operations send no campaign data.",
        )}
      </p>
      <div className="actions">
        <button
          disabled={busy}
          onClick={() => void perform("status", async () => undefined)}
        >
          {pending === "status" ? tr("Checking…") : tr("Check components")}
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
                "Guided Ollama installation is currently available only on Windows x64. On this system install Ollama manually with OLLAMA_NO_CLOUD=1; the model download is still available here.",
              )}
            </p>
          ) : null}
          <dl className="ai-setup-status">
            <div>
              <dt>{tr("Ollama")}</dt>
              <dd>
                {status.runtime === "ready"
                  ? tr("Running locally, cloud disabled · version {0}", [
                      status.runtimeVersion ?? "?",
                    ])
                  : status.runtime === "cloud"
                    ? tr(
                        "Running but cloud not disabled: Chronexus will not use it. Restart it with OLLAMA_NO_CLOUD=1.",
                      )
                    : status.managedInstalled
                      ? tr("Installed by Chronexus, not started")
                      : tr("Not running on this computer")}
                {status.managedRunning
                  ? " · " + tr("started by Chronexus")
                  : ""}
              </dd>
            </div>
            <div>
              <dt>{tr("Visual sheet")}</dt>
              <dd>
                {status.gpus.length
                  ? status.gpus
                      .map((g) =>
                        tr("{0} · {1} GB of video memory", [
                          g.name,
                          gb(Math.round(g.memoryMib / 1024) * 1e9),
                        ]),
                      )
                      .join("; ")
                  : tr(
                      "No NVIDIA GPU detected: without a GPU the assistant is not activated.",
                    )}
              </dd>
            </div>
            <div>
              <dt>{tr("Free space")}</dt>
              <dd>
                {status.freeBytes === null
                  ? tr("Not detectable")
                  : tr("{0} GB", [gb(status.freeBytes)])}
              </dd>
            </div>
            {status.models.map((m) => (
              <div key={m.role}>
                <dt>
                  {m.label} ·{" "}
                  {m.role === "primary" ? tr("Primary") : tr("Secondary")}
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
                {tr("Install Ollama…")}
              </button>
            ) : null}
            {status.managedInstalled && status.runtime === "stopped" ? (
              <button
                className="primary"
                disabled={busy}
                onClick={() => void perform("start", aiSetupApi.start)}
              >
                {pending === "start" ? tr("Starting…") : tr("Start Ollama")}
              </button>
            ) : null}
            {status.managedRunning ? (
              <button
                disabled={busy}
                onClick={() =>
                  void perform("stop", async () => {
                    await aiSetupApi.stop();
                    return tr("Ollama stopped.");
                  })
                }
              >
                {tr("Stop Ollama")}
              </button>
            ) : null}
            {status.managedInstalled && !status.managedRunning ? (
              <button disabled={busy} onClick={() => setConfirm("remove")}>
                {tr("Remove the managed runtime…")}
              </button>
            ) : null}
          </div>
          {status.managedInstalled ? (
            <p className="muted">
              {tr(
                "The managed runtime stays active while Chronexus is open and stops when it closes. Folder: {0}",
                [status.runtimeDir],
              )}
            </p>
          ) : null}
          {confirm === "runtime" ? (
            <div
              className="wiki-confirm"
              role="group"
              aria-label={tr("Confirm Ollama installation")}
            >
              <h4>{tr("Install Ollama 0.40.10?")}</h4>
              <ul>
                <li>
                  {tr("Download: {0} GB from the official GitHub archive", [
                    gb(status.runtimeDownloadBytes),
                  ])}
                </li>
                <li>
                  {tr("Space needed during installation: about {0} GB", [
                    gb(status.runtimeInstallBytes),
                  ])}
                </li>
                <li>{tr("Destination: {0}", [status.runtimeDir])}</li>
                <li>{tr("Source: {0}", [OLLAMA_SOURCE])}</li>
                <li>
                  {tr(
                    "MIT license. SHA-256 fingerprint verified before installing; no system service and no administrator rights.",
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
                        "Ollama installed and verified. Press Start Ollama when you want to use it.",
                      );
                    })
                  }
                >
                  {tr("Download and install")}
                </button>
                <button onClick={() => setConfirm(null)}>{tr("Cancel")}</button>
              </div>
            </div>
          ) : null}
          {confirm === "remove" ? (
            <div
              className="wiki-confirm"
              role="group"
              aria-label={tr("Confirm removal")}
            >
              <p>
                {tr(
                  "Remove the runtime installed by Chronexus? Downloaded models, campaigns and other Ollama installations are not touched.",
                )}
              </p>
              <div className="actions">
                <button
                  className="danger"
                  disabled={busy}
                  onClick={() =>
                    void perform("remove", async () => {
                      await aiSetupApi.removeRuntime();
                      return tr("Managed runtime removed.");
                    })
                  }
                >
                  {tr("Remove")}
                </button>
                <button onClick={() => setConfirm(null)}>{tr("Cancel")}</button>
              </div>
            </div>
          ) : null}
          <fieldset disabled={busy} className="ai-setup-models">
            <legend>{tr("Model to download")}</legend>
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
                      "{0} · Primary · about {1} GB · assistant and translations; with 16 GB of VRAM loading is mixed GPU/CPU",
                      [m.label, gb(m.downloadBytes)],
                    )
                  : tr(
                      "{0} · Secondary · about {1} GB · optional alternative, also for retraining",
                      [m.label, gb(m.downloadBytes)],
                    )}
              </label>
            ))}
          </fieldset>
          {model?.state === "ready" ? (
            <p role="status">
              {tr(
                "{0} is ready. Activate it in Campaign settings → Local AI; wiki translation uses it when you ask.",
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
                {tr("Download model…")}
              </button>
              {!runtimeReady ? (
                <span className="muted">
                  {tr("Start Ollama with the cloud disabled first.")}
                </span>
              ) : null}
            </div>
          )}
          {confirm === "model" && model ? (
            <div
              className="wiki-confirm"
              role="group"
              aria-label={tr("Confirm model download")}
            >
              <h4>{tr("Download {0}?", [model.label])}</h4>
              <ul>
                <li>{tr("Size: about {0} GB", [gb(model.downloadBytes)])}</li>
                <li>
                  {tr(
                    "Downloaded by Ollama from its public registry; Chronexus then verifies the fingerprint of the qualified weights.",
                  )}
                </li>
                <li>
                  {tr(
                    "Destination: the models folder of the running runtime ({0} for the managed runtime).",
                    [status.modelsDir],
                  )}
                </li>
                <li>
                  {tr("No campaign is changed or activated automatically.")}
                </li>
              </ul>
              <div className="actions">
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() =>
                    void perform("model", async () => {
                      const ready = await aiSetupApi.pull(role, setProgress);
                      return tr("{0} downloaded and verified.", [ready.label]);
                    })
                  }
                >
                  {tr("Download")}
                </button>
                <button onClick={() => setConfirm(null)}>{tr("Cancel")}</button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
      {pending === "runtime" || pending === "model" ? (
        <div aria-live="polite">
          <p role="status">
            {progress?.phase === "verify"
              ? tr("Checking integrity…")
              : progress?.phase === "extract"
                ? tr("Extracting…")
                : tr("Downloading…")}
            {percent !== null ? ` ${percent}%` : ""}
          </p>
          <progress
            aria-label={tr("Progress")}
            max={progress?.total ?? undefined}
            value={progress?.total ? progress.done : undefined}
          />
          <button onClick={() => void aiSetupApi.cancel()}>
            {tr("Cancel download")}
          </button>
        </div>
      ) : null}
      {notice ? <p role="status">{notice}</p> : null}
    </section>
  );
}
