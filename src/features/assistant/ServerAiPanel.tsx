import { useState, type FormEvent } from "react";
import { getPreferences, tr } from "../../i18n/store";
import { errorMessage } from "../journal/api";
import {
  serverAi,
  type Profile,
  type ServerAiAnswer,
  type ServerAiView,
} from "./campaignApi";

/**
 * Where this campaign's assistant runs (server milestone M25.10). The server is contacted
 * only when the user presses a button here; switching never moves notes, models or history.
 */
export function ServerAiSettings({
  campaignId,
  profile,
  disabled,
  onSaved,
}: {
  campaignId: string;
  profile: Profile;
  disabled: boolean;
  onSaved: (profile: Profile) => void;
}) {
  const [execution, setExecution] = useState(profile.execution);
  const [model, setModel] = useState(profile.serverModel);
  const [view, setView] = useState<ServerAiView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const available = view?.status.models.filter((m) => m.available) ?? [];
  const changed =
    execution !== profile.execution ||
    (execution === "server" && model !== profile.serverModel);
  return (
    <fieldset disabled={disabled || busy}>
      <legend>{tr("Where the assistant runs")}</legend>
      <label className="sync-item">
        <input
          type="radio"
          name="ai-execution"
          checked={execution === "local"}
          onChange={() => setExecution("local")}
        />{" "}
        {tr("On this computer (local AI)")}
      </label>
      <label className="sync-item">
        <input
          type="radio"
          name="ai-execution"
          checked={execution === "server"}
          onChange={() => setExecution("server")}
        />{" "}
        {tr("On the campaign's sharing server")}
      </label>
      {execution === "server" ? (
        <>
          <p className="muted">
            {tr(
              "Your question and the chosen model name go to the campaign's server. It answers using only what you can read there in this campaign: what you synchronized, private copies included, and what other players share. Notes kept only on this device are not used. The server does not store questions or answers; they are unverified drafts.",
            )}
          </p>
          <button
            type="button"
            onClick={() =>
              void run(async () => {
                const v = await serverAi.status(campaignId);
                setView(v);
                if (!model && v.status.models.some((m) => m.available))
                  setModel(v.status.models.find((m) => m.available)!.name);
              })
            }
          >
            {tr("Check the server AI")}
          </button>
          {view ? (
            <div role="status">
              <p>
                {tr("Server: {0}", [view.server])} ·{" "}
                {view.status.runtimeReachable && view.status.cloudDisabled
                  ? tr("AI runtime ready")
                  : tr("AI runtime not ready: ask the server's operator")}
              </p>
              <p className="muted">
                {tr(
                  "Limits: {0} questions per hour; an answer can take up to {1} seconds.",
                  [view.status.perUserHour, view.status.timeoutSeconds],
                )}
              </p>
              {available.length ? (
                <label>
                  {tr("Server model")}{" "}
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                  >
                    {available.map((m) => (
                      <option key={m.name} value={m.name}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <p className="muted">
                  {tr(
                    "No model is installed on the server yet. Installing models is up to the server's operator.",
                  )}
                </p>
              )}
            </div>
          ) : null}
        </>
      ) : null}
      <button
        type="button"
        className="primary"
        disabled={!changed || (execution === "server" && !model.trim())}
        onClick={() =>
          void run(async () => {
            const saved = await serverAi.setExecution(
              campaignId,
              execution,
              execution === "server" ? model : profile.serverModel,
            );
            onSaved(saved);
            setNotice(
              execution === "server"
                ? tr("Questions about this campaign now run on its server.")
                : tr("Questions about this campaign now run on this computer."),
            );
          })
        }
      >
        {tr("Use this choice")}
      </button>
      {error ? (
        <p role="alert" className="error">
          {error}
        </p>
      ) : null}
      {notice ? <p role="status">{notice}</p> : null}
    </fieldset>
  );
}

/** Asking the campaign's server: shown instead of the local assistant in server mode. */
export function ServerAsk({
  campaignId,
  model,
  onSwitchedToLocal,
}: {
  campaignId: string;
  model: string;
  onSwitchedToLocal: () => void;
}) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<ServerAiAnswer | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  async function ask(event?: FormEvent) {
    event?.preventDefault();
    if (!question.trim() || running) return;
    setRunning(true);
    setError("");
    try {
      setAnswer(
        await serverAi.ask(campaignId, question, getPreferences().locale),
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setRunning(false);
    }
  }
  return (
    <div className="assistant-server">
      <p role="status">
        {tr("Runs on the campaign's sharing server · model {0}", [
          model || tr("No model chosen"),
        ])}
      </p>
      <p className="muted">
        {tr(
          "Only what you can read in this campaign on the server is used. Notes kept only on this device are not.",
        )}
      </p>
      <form onSubmit={(e) => void ask(e)}>
        <label>
          {tr("Question")}
          <textarea
            value={question}
            maxLength={2000}
            disabled={running}
            onChange={(e) => setQuestion(e.target.value)}
          />
        </label>
        <button className="primary" disabled={running || !question.trim()}>
          {running ? tr("Waiting for the server AI…") : tr("Ask the server")}
        </button>
      </form>
      {error ? (
        <div role="alert" className="error">
          <p>{error}</p>
          <button type="button" onClick={() => void ask()}>
            {tr("Try again")}
          </button>{" "}
          <button
            type="button"
            onClick={() =>
              void serverAi
                .setExecution(campaignId, "local", model)
                .then(onSwitchedToLocal)
                .catch((e) => setError(errorMessage(e)))
            }
          >
            {tr("Switch this campaign to local AI")}
          </button>
        </div>
      ) : null}
      {answer ? (
        <article className="assistant-result">
          <p className="muted">
            {answer.answer.verified
              ? tr("Draft from {0}: check the sources before relying on it.", [
                  answer.server,
                ])
              : tr(
                  "Unverified draft from {0}: some statements are not backed by a provided source.",
                  [answer.server],
                )}
          </p>
          <div className="assistant-answer">
            <p dir="auto">{answer.answer.answer}</p>
          </div>
          {answer.answer.citations.length ? (
            <ul>
              {answer.answer.citations.map((c) => (
                <li key={c.key}>
                  [{c.key}] <span dir="auto">{c.title}</span> ·{" "}
                  {tr("by {0} · revision {1}", [c.authorName, c.revision])}
                </li>
              ))}
            </ul>
          ) : null}
          <p className="assistant-metrics">
            {tr(
              "{0} sources · {1} left out as possible instructions · {2} ms",
              [
                answer.answer.sourcesConsidered,
                answer.answer.excludedSources,
                answer.answer.elapsedMs,
              ],
            )}
          </p>
        </article>
      ) : null}
    </div>
  );
}
