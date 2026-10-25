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
import { useEffect, useState } from "react";
import { assistantApi, type Runtime, type Rule } from "./api";
import { campaignAi, type Overview, type Profile } from "./campaignApi";
import TrainingPanel from "./TrainingPanel";
import type { SaveGuard } from "../journal/Editor";
import { errorMessage } from "../journal/api";

const kinds: Record<string, string> = localizeLabels({
  page: "Codex e party",
  session: "Diario delle sessioni",
  character: "Scheda del personaggio",
  item: "Oggetti",
  spell: "Incantesimi",
  ability: "Capacità",
});
export default function CampaignSettings({
  campaignId,
  name,
  register,
}: {
  campaignId: string;
  name: string;
  register?: (g: SaveGuard | null) => void;
}) {
  const [view, setView] = useState<Overview | null>(null);
  const [draft, setDraft] = useState<Profile | null>(null);
  const [runtime, setRuntime] = useState<Runtime | null>(null);
  const [model, setModel] = useState("");
  const [consent, setConsent] = useState(false);
  const [rules, setRules] = useState<Rule[]>([]);
  const [trainingActive, setTrainingActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    void campaignAi
      .get(campaignId)
      .then((v) => {
        if (active) {
          setView(v);
          setDraft(v.profile);
          setModel(v.profile.settings.model);
        }
      })
      .catch((e) => {
        if (active) setError(errorMessage(e));
      });
    return () => {
      active = false;
    };
  }, [campaignId]);
  const edition = draft?.edition;
  useEffect(() => {
    if (!edition) return;
    let active = true;
    void assistantApi
      .rules(edition)
      .then((r) => {
        if (active) setRules(r);
      })
      .catch((e) => {
        if (active) setError(errorMessage(e));
      });
    return () => {
      active = false;
    };
  }, [edition]);
  async function run(action: () => Promise<void>) {
    if (busy) return;
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
  async function reload() {
    const v = await campaignAi.get(campaignId);
    setView(v);
    setDraft(v.profile);
  }
  const dirty = JSON.stringify(draft) !== JSON.stringify(view?.profile);
  function patch(update: Partial<Profile>) {
    setDraft((old) => (old ? { ...old, ...update } : null));
  }
  return (
    <section className="campaign-settings">
      <header className="section-header">
        <div>
          <p className="eyebrow">{name}</p>
          <h2>
            <Text source={"Impostazioni della campagna"} />
          </h2>
          <p>
            <Text
              source={"Le preferenze valgono soltanto per questa campagna."}
            />
          </p>
        </div>
      </header>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {!draft || !view ? (
        error ? (
          <button disabled={busy} onClick={() => void run(reload)}>
            <Text source={"Riprova impostazioni"} />
          </button>
        ) : (
          <p role="status">
            <Text source={"Caricamento impostazioni…"} />
          </p>
        )
      ) : (
        <>
          {view.sourceError && (
            <p role="alert">
              {view.sourceError}{" "}
              <Text
                source={
                  " Riduci i tipi di fonti incluse e salva le preferenze."
                }
              />
            </p>
          )}
          <fieldset disabled={busy || trainingActive}>
            <legend>
              <Text source={"AI locale · modello"} />
            </legend>
            <p>
              {draft.settings.enabled ? tr("Attiva") : tr("Disattivata")} ·{" "}
              {draft.settings.model || tr("Nessun modello scelto")}
            </p>
            {retiredQwen(draft.settings.model) ? (
              <p role="status">{tr(retiredNotice)}</p>
            ) : null}
            {draft.settings.digest && (
              <p className="muted">
                <Text source={"Identità: "} />
                {draft.settings.digest}
              </p>
            )}
            <p>
              <Text source={modelGuidance} />
            </p>
            <button
              onClick={() =>
                void run(async () => {
                  const r = await assistantApi.probe();
                  setRuntime(r);
                  setModel((previous) => preferredModel(r.models, previous));
                })
              }
            >
              <Text source={"Controlla Ollama e GPU"} />
            </button>
            {runtime && (
              <>
                <p>
                  <Text source={"Ollama "} />
                  {runtime.version}{" "}
                  <Text source={" · cloud disabilitato verificato"} />
                </p>
                <label>
                  <Text source={"Modello locale"} />
                  <select
                    aria-label={tr("Modello locale")}
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                  >
                    <option value="">{tr("Scegli un modello")}</option>
                    {usableModels(runtime.models).map((m) => (
                      <option key={m.digest} value={m.name}>
                        {modelLabel(m.name)} · {m.quantization} ·{" "}
                        {Math.round(m.gpuBytes / 1048576)}{" "}
                        {tr(" MiB GPU caricati")}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  <Text
                    source={
                      "Confermo l'uso di un modello multilingue con fonti locali, non specializzato D&D."
                    }
                  />
                </label>
                <button
                  disabled={!model || !consent || dirty}
                  onClick={() =>
                    void run(async () => {
                      await assistantApi.configure(
                        true,
                        model,
                        consent,
                        campaignId,
                      );
                      await reload();
                      setNotice(
                        tr(
                          "Modello attivato per questa campagna. La GPU sarà verificata prima di inviare gli appunti.",
                        ),
                      );
                    })
                  }
                >
                  <Text source={"Attiva modello per la campagna"} />
                </button>
              </>
            )}
            <button
              disabled={!draft.settings.enabled || dirty}
              onClick={() =>
                void run(async () => {
                  await assistantApi.configure(false, model, false, campaignId);
                  await reload();
                })
              }
            >
              <Text source={"Disattiva AI della campagna"} />
            </button>
          </fieldset>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await campaignAi.save(campaignId, draft);
                await reload();
                setNotice(tr("Preferenze della campagna salvate."));
              });
            }}
          >
            <fieldset disabled={busy || trainingActive}>
              <legend>
                <Text source={"Fonti e risorse"} />
              </legend>
              <label>
                <Text source={"Edizione D&D"} />
                <select
                  value={draft.edition}
                  onChange={(e) =>
                    patch({ edition: e.target.value, ruleKeys: [] })
                  }
                >
                  <option value="5e-2014">{tr("D&D 5e · 2014")}</option>
                  <option value="5e-2024">{tr("D&D 5e · 2024")}</option>
                  <option value="3.5">{tr("D&D 3.5")}</option>
                </select>
              </label>
              <label>
                <Text source={"Contesto massimo"} />
                <select
                  value={draft.context}
                  onChange={(e) => patch({ context: Number(e.target.value) })}
                >
                  {[2048, 4096, 8192].map((n) => (
                    <option key={n} value={n}>
                      {n} <Text source={" token"} />
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <Text source={"Lunghezza massima risposta"} />
                <input
                  type="number"
                  min={128}
                  max={1024}
                  value={draft.maxTokens}
                  onChange={(e) => patch({ maxTokens: Number(e.target.value) })}
                />
              </label>
              <p>
                <Text
                  source={
                    "Un contesto maggiore richiede più VRAM. Il runtime e la GPU fisica sono condivisi; queste preferenze non ne cambiano le impostazioni globali."
                  }
                />
              </p>
              {Object.entries(kinds).map(([id, label]) => (
                <label className="checkbox-row" key={id}>
                  <input
                    type="checkbox"
                    checked={draft.includeKinds.includes(id)}
                    onChange={(e) =>
                      patch({
                        includeKinds: e.target.checked
                          ? [...draft.includeKinds, id]
                          : draft.includeKinds.filter((k) => k !== id),
                      })
                    }
                  />
                  {label}
                </label>
              ))}
              <h3>
                <Text source={"Regole locali approvate"} />
              </h3>
              <p>
                <Text
                  source={
                    "Fino a sei voci della stessa edizione, già consultate nella Wiki."
                  }
                />
              </p>
              {rules.length === 0 ? (
                <p>
                  <Text
                    source={
                      "Nessuna voce locale disponibile per questa edizione."
                    }
                  />
                </p>
              ) : (
                rules.map((r) => (
                  <label className="checkbox-row" key={r.key}>
                    <input
                      type="checkbox"
                      checked={draft.ruleKeys.includes(r.key)}
                      disabled={
                        !draft.ruleKeys.includes(r.key) &&
                        draft.ruleKeys.length >= 6
                      }
                      onChange={(e) =>
                        patch({
                          ruleKeys: e.target.checked
                            ? [...draft.ruleKeys, r.key]
                            : draft.ruleKeys.filter((k) => k !== r.key),
                        })
                      }
                    />
                    {r.title} · {r.document}
                  </label>
                ))
              )}
              <button type="submit" disabled={!dirty}>
                <Text source={"Salva preferenze"} />
              </button>
              {dirty && (
                <p role="status">
                  <Text
                    source={
                      "Salva le preferenze prima di aggiornare le conoscenze o cambiare modello."
                    }
                  />
                </p>
              )}
            </fieldset>
          </form>
          <fieldset disabled={busy || dirty || trainingActive}>
            <legend>
              <Text source={"Conoscenze locali"} />
            </legend>
            <p>
              <Text source={"Ultimo aggiornamento:"} />{" "}
              {view.profile.indexedAt
                ? new Date(view.profile.indexedAt).toLocaleString(
                    localeInfo(getPreferences().locale).intl,
                  )
                : tr("Mai eseguito")}
            </p>
            <p>
              {view.added} <Text source={" estratti nuovi · "} />
              {view.changed} <Text source={" modificati ·"} /> {view.removed}{" "}
              <Text
                source={
                  " rimossi rispetto all'ultimo aggiornamento delle conoscenze."
                }
              />
            </p>
            <button
              onClick={() =>
                void run(async () => {
                  const v = await campaignAi.refresh(campaignId);
                  setView(v);
                  setDraft(v.profile);
                  setNotice(
                    tr(
                      "Conoscenze aggiornate. I pesi del modello non sono stati riaddestrati.",
                    ),
                  );
                })
              }
            >
              <Text source={"Aggiorna conoscenze"} />
            </button>
            <details>
              <summary>
                <Text source={"Anteprima delle fonti incluse ("} />
                {view.sources.length} <Text source={" estratti)"} />
              </summary>
              <p>
                <Text
                  source={
                    "Estratti della campagna selezionata; le conversazioni AI e le fotografie non sono dati di addestramento."
                  }
                />
              </p>
              {view.sources.slice(0, 100).map((s) => (
                <article key={s.key}>
                  <strong>{s.title}</strong>
                  <p>{s.text}</p>
                  {s.kind !== "wiki" && (
                    <button
                      onClick={() =>
                        patch({
                          excludedIds: [...draft.excludedIds, s.sourceId],
                        })
                      }
                    >
                      <Text source={"Escludi questa fonte"} />
                    </button>
                  )}
                </article>
              ))}
              {view.sources.length > 100 && (
                <p>
                  <Text source={"Anteprima limitata ai primi 100 estratti."} />
                </p>
              )}
            </details>
          </fieldset>
          <TrainingPanel
            campaignId={campaignId}
            disabled={busy || dirty || trainingActive}
            version={JSON.stringify(view.profile)}
            register={register}
            onActive={setTrainingActive}
            onActivated={reload}
          />
          {draft.excludedIds.length > 0 && (
            <button
              disabled={busy || trainingActive}
              onClick={() => patch({ excludedIds: [] })}
            >
              <Text source={"Riammetti le fonti escluse ("} />
              {draft.excludedIds.length})
            </button>
          )}
        </>
      )}
    </section>
  );
}
