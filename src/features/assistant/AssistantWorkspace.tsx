import {
  usableModels,
  preferredModel,
  modelLabel,
  retiredQwen,
  retiredNotice,
  modelGuidance,
} from "./models";
import { localizeLabels } from "../../i18n/store";
import { localeInfo } from "../../i18n/locales";
import { getPreferences } from "../../i18n/store";
import { Text } from "../../i18n/Text";
import { tr } from "../../i18n/store";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  assistantApi,
  type Settings,
  type Runtime,
  type Turn,
  type Rule,
  type Source,
} from "./api";
import { errorMessage } from "../journal/api";
import type { SaveGuard } from "../journal/Editor";
import type { SearchResult } from "../search/SearchPanel";
import { campaignAi } from "./campaignApi";
const statuses: Record<string, string> = localizeLabels({
  running: "In progress",
  complete: "Answer finished · to be checked",
  cancelled: "Cancelled · draft",
  error: "Not verified",
  no_sources: "No relevant source",
  interrupted: "Interrupted · draft kept",
});
export default function AssistantWorkspace({
  campaignId,
  register,
  onSource,
}: {
  campaignId: string;
  register: (g: SaveGuard | null) => void;
  onSource: (s: SearchResult) => void;
}) {
  const [settings, setSettings] = useState<Settings | null>(null),
    [runtime, setRuntime] = useState<Runtime | null>(null),
    [model, setModel] = useState(""),
    [consent, setConsent] = useState(false),
    [history, setHistory] = useState<Turn[]>([]),
    [selected, setSelected] = useState<Turn | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [configBusy, setConfigBusy] = useState(false),
    [running, setRunning] = useState(false),
    [phase, setPhase] = useState(""),
    [draft, setDraft] = useState(""),
    [question, setQuestion] = useState(""),
    [mode, setMode] = useState("campaign"),
    [edition, setEdition] = useState("5e-2014"),
    [rules, setRules] = useState<Rule[]>([]),
    [approvedKeys, setApprovedKeys] = useState<string[]>([]),
    [keys, setKeys] = useState<string[]>([]),
    [sourceNotice, setSourceNotice] = useState(""),
    [confirmDelete, setConfirmDelete] = useState(false),
    [more, setMore] = useState(false);
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
    void Promise.all([
      assistantApi.settings(campaignId),
      assistantApi.history(campaignId),
      campaignAi.get(campaignId),
    ])
      .then(([s, h, preferences]) => {
        if (active) {
          setSettings(s);
          setModel(s.model);
          setHistory(h);
          setMore(h.length === 50);
          setEdition(preferences.profile.edition);
          setApprovedKeys(preferences.profile.ruleKeys);
          setKeys(preferences.profile.ruleKeys);
        }
      })
      .catch((e) => {
        if (active) setError(errorMessage(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [campaignId]);
  useEffect(() => {
    let active = true;
    void assistantApi
      .rules(edition)
      .then((rows) => {
        if (active) setRules(rows.filter((r) => approvedKeys.includes(r.key)));
      })
      .catch((e) => {
        if (active) setError(errorMessage(e));
      });
    return () => {
      active = false;
    };
  }, [edition, approvedKeys]);
  useLayoutEffect(() => {
    register({
      dirty: () => job.current !== null,
      flush: async () => {
        const pending = job.current;
        if (pending) {
          await assistantApi.cancel(pending.id);
          await pending.promise;
        }
      },
    });
    return () => register(null);
  }, [register]);
  async function check() {
    setError("");
    setConfigBusy(true);
    try {
      const r = await assistantApi.probe();
      setRuntime(r);
      setModel((previous) => preferredModel(r.models, previous));
    } catch (e) {
      setRuntime(null);
      setError(errorMessage(e));
    } finally {
      setConfigBusy(false);
    }
  }
  async function configure(enabled: boolean) {
    setConfigBusy(true);
    setError("");
    try {
      setSettings(
        await assistantApi.configure(enabled, model, consent, campaignId),
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setConfigBusy(false);
    }
  }
  function ask(event: FormEvent) {
    event.preventDefault();
    if (job.current) return;
    setError("");
    setDraft("");
    setSelected(null);
    setSourceNotice("");
    setChangedSource(null);
    setRunning(true);
    const id = crypto.randomUUID();
    const promise = assistantApi
      .ask(
        {
          id,
          campaignId,
          question: question.trim(),
          mode,
          edition: mode === "rules" ? edition : null,
          ruleKeys: mode === "rules" ? keys : [],
          locale: getPreferences().locale,
        },
        (e) => {
          if (!mounted.current || e.requestId !== id) return;
          if (e.phase === "token") setDraft((text) => text + e.text);
          else setPhase(e.text);
        },
      )
      .then((turn) => {
        if (mounted.current) {
          setSelected(turn);
          setHistory((rows) => [turn, ...rows.filter((r) => r.id !== turn.id)]);
        }
      })
      .catch((e) => {
        if (mounted.current) setError(errorMessage(e));
      })
      .finally(() => {
        job.current = null;
        if (mounted.current) setRunning(false);
      });
    job.current = { id, promise };
  }
  async function cancel() {
    try {
      if (job.current) await assistantApi.cancel(job.current.id);
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  async function openSource(source: Source) {
    if (!selected) return;
    setError("");
    setChangedSource(null);
    try {
      const state = await assistantApi.source(
        campaignId,
        selected.id,
        source.key,
      );
      setSourceNotice(
        !state.available
          ? tr(
              "The original source is no longer available. The cited copy is kept here.",
            )
          : state.changed
            ? tr(
                "The source changed after the answer. The text cited below is the earlier version.",
              )
            : tr("The source matches the cited version."),
      );
      if (state.available && source.kind !== "wiki") {
        if (state.changed) {
          setSourceNotice(
            tr(
              "The source changed. Use «Open current version» after comparing the cited copy.",
            ),
          );
          setChangedSource(source);
        } else navigate(source);
      }
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  const [changedSource, setChangedSource] = useState<Source | null>(null);
  function navigate(s: Source) {
    if (s.kind === "wiki") return;
    onSource({
      kind: s.kind,
      sourceId: s.sourceId,
      blockId: s.blockId,
      title: s.title,
      preview: s.text,
      updatedAt: "",
    });
  }
  async function remove() {
    if (!selected) return;
    try {
      await assistantApi.remove(campaignId, selected.id);
      setHistory((rows) => rows.filter((t) => t.id !== selected.id));
      setSelected(null);
      setConfirmDelete(false);
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  async function loadMore() {
    setConfigBusy(true);
    try {
      const rows = await assistantApi.history(campaignId, history.length);
      setHistory((old) => [...old, ...rows]);
      setMore(rows.length === 50);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setConfigBusy(false);
    }
  }
  if (loading)
    return (
      <p role="status">
        <Text source={"Opening local assistant…"} />
      </p>
    );
  return (
    <section className="assistant-workspace">
      <header className="section-heading">
        <div>
          <p className="eyebrow">
            <Text source={"The wayfarer's counsel"} />
          </p>
          <h2>
            <Text source={"Local assistant"} />
          </h2>
          <p>
            <Text
              source={
                "Ask your notes or the D&D sources saved in the Wiki. Answers must be checked and never change the campaign."
              }
            />
          </p>
        </div>
      </header>
      <p className="editor-hint">{tr(modelGuidance)}</p>
      {settings && retiredQwen(settings.model) ? (
        <p role="status">{tr(retiredNotice)}</p>
      ) : null}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <details className="assistant-settings" open={!settings?.enabled}>
        <summary>
          <Text source={"Model and privacy ·"} />{" "}
          {settings?.enabled ? "attivo" : "disattivato"}
        </summary>
        <p>
          <Text
            source={
              "Ollama must run on this computer with OLLAMA_NO_CLOUD=1. The app checks the cloud block before sending sources. No fallback to external services."
            }
          />
        </p>
        <button disabled={configBusy || running} onClick={() => void check()}>
          <Text source={"Check Ollama"} />
        </button>
        {runtime && (
          <>
            <p>
              <Text source={"Ollama "} />
              {runtime.version}{" "}
              <Text source={" · cloud disabled and verified"} />
            </p>
            <label>
              <Text source={"Local model"} />
              <select
                aria-label={tr("Local model")}
                value={model}
                disabled={configBusy || running}
                onChange={(e) => setModel(e.target.value)}
              >
                <option value="">{tr("Choose a model")}</option>
                {usableModels(runtime.models).map((m) => (
                  <option key={m.digest} value={m.name}>
                    {modelLabel(m.name)} · {m.quantization}
                  </option>
                ))}
              </select>
            </label>
            {runtime.models.some((m) => m.dndSpecialized) && (
              <p>
                <Text
                  source={
                    "The experimental D&D model is excluded: it did not pass the quality tests."
                  }
                />
              </p>
            )}
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                disabled={running}
              />
              <Text
                source={
                  "I am using a multilingual model, not trained specifically on D&D, guided by my local sources."
                }
              />
            </label>
            <button
              disabled={!model || !consent || configBusy || running}
              onClick={() => void configure(true)}
            >
              <Text source={"Enable local model"} />
            </button>
          </>
        )}
        {settings?.enabled && (
          <>
            <p>
              <Text source={"Configured: "} />
              {settings.model}
            </p>
            <p className="assistant-digest">
              <Text source={"Identity: "} />
              {settings.digest}
            </p>
            <button
              disabled={configBusy || running}
              onClick={() => void configure(false)}
            >
              <Text source={"Disable assistant"} />
            </button>
          </>
        )}
        <p>
          <Text
            source={
              "Slower first load. Compatible drivers and free GPU memory are needed. Weights are excluded from backups; conversations and source copies are included."
            }
          />
        </p>
      </details>
      <div className="assistant-layout">
        <div>
          <form onSubmit={ask}>
            <fieldset disabled={running || !settings?.enabled || configBusy}>
              <legend>
                <Text source={"A question, with its sources"} />
              </legend>
              <label>
                <Text source={"Scope"} />
                <select
                  aria-label={tr("Scope")}
                  value={mode}
                  onChange={(e) => {
                    setMode(e.target.value);
                    setKeys([]);
                  }}
                >
                  <option value="campaign">{tr("Current campaign")}</option>
                  <option value="rules">{tr("Local D&D rules")}</option>
                </select>
              </label>
              {mode === "rules" && (
                <>
                  <label>
                    <Text source={"Edition"} />
                    <select
                      aria-label={tr("Edition")}
                      disabled
                      value={edition}
                      onChange={(e) => {
                        setEdition(e.target.value);
                        setKeys([]);
                      }}
                    >
                      <option value="5e-2014">{tr("D&D 5e · 2014")}</option>
                      <option value="5e-2024">{tr("D&D 5e · 2024")}</option>
                      <option value="3.5">{tr("D&D 3.5")}</option>
                    </select>
                  </label>
                  <p>
                    <Text
                      source={
                        "The edition and sources are those approved in Campaign settings. You can choose which ones to use for this question."
                      }
                    />
                  </p>
                  {rules.length === 0 ? (
                    <p>
                      <Text
                        source={
                          "No source saved for this edition. Open an entry in the Wiki first."
                        }
                      />
                    </p>
                  ) : (
                    <div className="assistant-rule-list">
                      {rules.map((r) => (
                        <label className="checkbox-row" key={r.key}>
                          <input
                            type="checkbox"
                            checked={keys.includes(r.key)}
                            disabled={!keys.includes(r.key) && keys.length >= 6}
                            onChange={(e) =>
                              setKeys((old) =>
                                e.target.checked
                                  ? [...old, r.key]
                                  : old.filter((k) => k !== r.key),
                              )
                            }
                          />
                          {r.title} · {r.document}
                        </label>
                      ))}
                    </div>
                  )}
                </>
              )}
              <label>
                <Text source={"Question"} />
                <textarea
                  aria-label={tr("Question")}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  minLength={3}
                  maxLength={1000}
                  required
                  placeholder={tr("What do we know about Mirna?")}
                  rows={4}
                />
              </label>
              <p>
                <Text
                  source={
                    "The search uses words found in your notes. Try precise names and terms; it does not read the whole campaign automatically."
                  }
                />
              </p>
              <button
                type="submit"
                disabled={
                  question.trim().length < 3 ||
                  (mode === "rules" && keys.length === 0)
                }
              >
                <Text source={"Ask the sources"} />
              </button>
            </fieldset>
          </form>
          {running && (
            <div>
              <p role="status">{phase || tr("Preparing…")}</p>
              <button onClick={() => void cancel()}>
                <Text source={"Cancel generation"} />
              </button>
              <p>
                <Text
                  source={
                    "Leaving this section cancels the generation and keeps the draft."
                  }
                />
              </p>
              <div
                className="assistant-answer"
                aria-label={tr("Answer arriving")}
              >
                {draft}
              </div>
            </div>
          )}
          {selected && !running && (
            <article className="assistant-result">
              <p className="eyebrow">
                {statuses[selected.status] ?? selected.status}
              </p>
              <h3>{selected.question}</h3>
              <p>
                {selected.mode === "rules"
                  ? tr("Rules {0}", [selected.edition])
                  : tr("Campaign notes")}{" "}
                · {selected.model}
              </p>
              {selected.error && <p role="alert">{selected.error}</p>}
              <div className="assistant-answer">
                {selected.answer || tr("No answer generated.")}
              </div>
              {typeof selected.metrics.gpuBytes === "number" && (
                <p className="assistant-metrics">
                  {selected.metrics.processor === "gpu"
                    ? "GPU"
                    : tr("GPU + CPU")}{" "}
                  · {Math.round(selected.metrics.gpuBytes / 1048576)}{" "}
                  <Text source={" MiB ·"} />{" "}
                  {Math.round(Number(selected.metrics.elapsedMs) / 1000)}{" "}
                  <Text source={" s"} />
                </p>
              )}
              {Number(selected.metrics.excludedSourceCount) > 0 && (
                <p role="status">
                  <Text
                    source={"Sources excluded for possible instructions:"}
                  />{" "}
                  {Number(selected.metrics.excludedSourceCount)}
                  <Text
                    source={". The answer uses only the listed excerpts."}
                  />
                </p>
              )}
              <h4>
                {selected.metrics.sentToModel === false
                  ? tr("Checked sources · not sent to the model")
                  : tr("Request sources")}
              </h4>
              {sourceNotice && <p role="status">{sourceNotice}</p>}
              {changedSource && (
                <button onClick={() => navigate(changedSource)}>
                  <Text source={"Open current version"} />
                </button>
              )}
              {selected.sources.map((s) => (
                <details key={s.key}>
                  <summary>
                    [{s.key}] {s.title}
                    {s.edition ? tr(" · {0}", [s.edition]) : ""}
                  </summary>
                  <p className="assistant-snapshot">{s.text}</p>
                  <p>
                    <Text source={"Revision "} />
                    {s.revision}{" "}
                    <Text source={" · copy kept with the answer"} />
                  </p>
                  <button onClick={() => void openSource(s)}>
                    {s.kind === "wiki"
                      ? tr("Check the cached version")
                      : tr("Open cited source")}
                  </button>
                </details>
              ))}
              {!confirmDelete ? (
                <button onClick={() => setConfirmDelete(true)}>
                  <Text source={"Delete answer"} />
                </button>
              ) : (
                <div role="alertdialog" aria-label={tr("Delete the answer?")}>
                  <p>
                    <Text
                      source={
                        "Delete this question, the answer and the source copies? Your notes are kept."
                      }
                    />
                  </p>
                  <button onClick={() => void remove()}>
                    <Text source={"Confirm deletion"} />
                  </button>
                  <button autoFocus onClick={() => setConfirmDelete(false)}>
                    <Text source={"Cancel"} />
                  </button>
                </div>
              )}
            </article>
          )}
        </div>
        <aside className="assistant-history">
          <h3>
            <Text source={"The thread of questions"} />
          </h3>
          <p>
            <Text
              source={
                "This campaign only. Earlier answers never become sources for new questions."
              }
            />
          </p>
          {history.length === 0 && (
            <p>
              <Text
                source={
                  "No conversations. Start with a question about your notes."
                }
              />
            </p>
          )}
          {history.map((t) => (
            <button
              key={t.id}
              disabled={running}
              aria-current={selected?.id === t.id ? "true" : undefined}
              onClick={() => {
                setSelected(t);
                setConfirmDelete(false);
                setSourceNotice("");
                setChangedSource(null);
              }}
            >
              <span>{t.question}</span>
              <small>
                {statuses[t.status] ?? t.status} ·{" "}
                {new Date(t.createdAt).toLocaleDateString(
                  localeInfo(getPreferences().locale).intl,
                )}
              </small>
            </button>
          ))}
          {more && (
            <button
              disabled={configBusy || running}
              onClick={() => void loadMore()}
            >
              <Text source={"Show more questions"} />
            </button>
          )}
        </aside>
      </div>
    </section>
  );
}
