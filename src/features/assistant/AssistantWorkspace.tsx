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
  running: "In corso",
  complete: "Risposta conclusa · da verificare",
  cancelled: "Annullata · bozza",
  error: "Non verificata",
  no_sources: "Nessuna fonte pertinente",
  interrupted: "Interrotta · bozza conservata",
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
              "La fonte originale non è più disponibile. La copia citata è conservata qui.",
            )
          : state.changed
            ? tr(
                "La fonte è cambiata dalla risposta. Il testo citato qui sotto è la versione precedente.",
              )
            : tr("La fonte corrisponde alla versione citata."),
      );
      if (state.available && source.kind !== "wiki") {
        if (state.changed) {
          setSourceNotice(
            tr(
              "La fonte è cambiata. Usa «Apri versione attuale» dopo aver confrontato la copia citata.",
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
        <Text source={"Apertura assistente locale…"} />
      </p>
    );
  return (
    <section className="assistant-workspace">
      <header className="section-heading">
        <div>
          <p className="eyebrow">
            <Text source={"Il consigliere del viandante"} />
          </p>
          <h2>
            <Text source={"Assistente locale"} />
          </h2>
          <p>
            <Text
              source={
                "Interroga i tuoi appunti o le fonti D&D salvate nella Wiki. Le risposte sono da verificare e non modificano la campagna."
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
          <Text source={"Modello e riservatezza ·"} />{" "}
          {settings?.enabled ? "attivo" : "disattivato"}
        </summary>
        <p>
          <Text
            source={
              "Ollama deve essere avviato su questo computer con OLLAMA_NO_CLOUD=1. L’app controlla il blocco del cloud prima di inviare le fonti. Nessun ripiego su servizi esterni."
            }
          />
        </p>
        <button disabled={configBusy || running} onClick={() => void check()}>
          <Text source={"Controlla Ollama"} />
        </button>
        {runtime && (
          <>
            <p>
              <Text source={"Ollama "} />
              {runtime.version}{" "}
              <Text source={" · cloud disabilitato e verificato"} />
            </p>
            <label>
              <Text source={"Modello locale"} />
              <select
                aria-label={tr("Modello locale")}
                value={model}
                disabled={configBusy || running}
                onChange={(e) => setModel(e.target.value)}
              >
                <option value="">{tr("Scegli un modello")}</option>
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
                    "Il modello sperimentale D&D è escluso: non ha superato le prove di qualità."
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
                  "Uso un modello multilingue, non addestrato specificamente su D&D, guidato dalle mie fonti locali."
                }
              />
            </label>
            <button
              disabled={!model || !consent || configBusy || running}
              onClick={() => void configure(true)}
            >
              <Text source={"Attiva modello locale"} />
            </button>
          </>
        )}
        {settings?.enabled && (
          <>
            <p>
              <Text source={"Configurato: "} />
              {settings.model}
            </p>
            <p className="assistant-digest">
              <Text source={"Identità: "} />
              {settings.digest}
            </p>
            <button
              disabled={configBusy || running}
              onClick={() => void configure(false)}
            >
              <Text source={"Disattiva assistente"} />
            </button>
          </>
        )}
        <p>
          <Text
            source={
              "Primo caricamento più lento. Servono driver compatibili e memoria GPU disponibile. Pesi esclusi dai backup; conversazioni e copie delle fonti incluse."
            }
          />
        </p>
      </details>
      <div className="assistant-layout">
        <div>
          <form onSubmit={ask}>
            <fieldset disabled={running || !settings?.enabled || configBusy}>
              <legend>
                <Text source={"Una domanda, con le sue fonti"} />
              </legend>
              <label>
                <Text source={"Ambito"} />
                <select
                  aria-label={tr("Ambito")}
                  value={mode}
                  onChange={(e) => {
                    setMode(e.target.value);
                    setKeys([]);
                  }}
                >
                  <option value="campaign">{tr("Campagna attuale")}</option>
                  <option value="rules">{tr("Regole D&D locali")}</option>
                </select>
              </label>
              {mode === "rules" && (
                <>
                  <label>
                    <Text source={"Edizione"} />
                    <select
                      aria-label={tr("Edizione")}
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
                        "Edizione e fonti sono quelle approvate nelle Impostazioni della campagna. Puoi scegliere quali usare per questa domanda."
                      }
                    />
                  </p>
                  {rules.length === 0 ? (
                    <p>
                      <Text
                        source={
                          "Nessuna fonte salvata per questa edizione. Apri prima una voce nella Wiki."
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
                <Text source={"Domanda"} />
                <textarea
                  aria-label={tr("Domanda")}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  minLength={3}
                  maxLength={1000}
                  required
                  placeholder={tr("Che cosa sappiamo di Mirna?")}
                  rows={4}
                />
              </label>
              <p>
                <Text
                  source={
                    "La ricerca usa parole presenti nei tuoi appunti. Prova nomi e termini precisi; non legge automaticamente l’intera campagna."
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
                <Text source={"Chiedi alle fonti"} />
              </button>
            </fieldset>
          </form>
          {running && (
            <div>
              <p role="status">{phase || tr("Preparazione…")}</p>
              <button onClick={() => void cancel()}>
                <Text source={"Annulla generazione"} />
              </button>
              <p>
                <Text
                  source={
                    "Uscendo da questa sezione, la generazione viene annullata e la bozza conservata."
                  }
                />
              </p>
              <div
                className="assistant-answer"
                aria-label={tr("Risposta in arrivo")}
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
                  ? tr("Regole {0}", [selected.edition])
                  : tr("Appunti della campagna")}{" "}
                · {selected.model}
              </p>
              {selected.error && <p role="alert">{selected.error}</p>}
              <div className="assistant-answer">
                {selected.answer || tr("Nessuna risposta generata.")}
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
                  <Text source={"Fonti escluse per possibili istruzioni:"} />{" "}
                  {Number(selected.metrics.excludedSourceCount)}
                  <Text
                    source={". La risposta usa soltanto gli estratti elencati."}
                  />
                </p>
              )}
              <h4>
                {selected.metrics.sentToModel === false
                  ? tr("Fonti controllate · non inviate al modello")
                  : tr("Fonti della richiesta")}
              </h4>
              {sourceNotice && <p role="status">{sourceNotice}</p>}
              {changedSource && (
                <button onClick={() => navigate(changedSource)}>
                  <Text source={"Apri versione attuale"} />
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
                    <Text source={"Revisione "} />
                    {s.revision}{" "}
                    <Text source={" · copia conservata con la risposta"} />
                  </p>
                  <button onClick={() => void openSource(s)}>
                    {s.kind === "wiki"
                      ? tr("Verifica versione nella cache")
                      : tr("Apri fonte citata")}
                  </button>
                </details>
              ))}
              {!confirmDelete ? (
                <button onClick={() => setConfirmDelete(true)}>
                  <Text source={"Elimina risposta"} />
                </button>
              ) : (
                <div
                  role="alertdialog"
                  aria-label={tr("Eliminare la risposta?")}
                >
                  <p>
                    <Text
                      source={
                        "Eliminare questa domanda, la risposta e le copie delle fonti? Gli appunti restano conservati."
                      }
                    />
                  </p>
                  <button onClick={() => void remove()}>
                    <Text source={"Conferma eliminazione"} />
                  </button>
                  <button autoFocus onClick={() => setConfirmDelete(false)}>
                    <Text source={"Annulla"} />
                  </button>
                </div>
              )}
            </article>
          )}
        </div>
        <aside className="assistant-history">
          <h3>
            <Text source={"Il filo delle domande"} />
          </h3>
          <p>
            <Text
              source={
                "Solo questa campagna. Le risposte precedenti non diventano fonti per le nuove domande."
              }
            />
          </p>
          {history.length === 0 && (
            <p>
              <Text
                source={
                  "Nessuna conversazione. Inizia da una domanda sui tuoi appunti."
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
              <Text source={"Mostra altre domande"} />
            </button>
          )}
        </aside>
      </div>
    </section>
  );
}
