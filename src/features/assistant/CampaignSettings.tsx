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
import { Icon } from "../../components/Ornaments";
import "../preferences/app-settings.css";

const kinds: Record<string, string> = localizeLabels({
  page: "Codex and party",
  session: "Session journal",
  character: "Character sheet",
  item: "Items",
  spell: "Spells",
  ability: "Abilities",
});
export default function CampaignSettings({
  campaignId,
  register,
}: {
  campaignId: string;
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
  const [section, setSection] = useState<
    "model" | "sources" | "knowledge" | "training"
  >("model");
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
          <h2>
            <Text source={"Campaign settings"} />
          </h2>
          <p>
            <Text source={"These preferences apply to this campaign only."} />
          </p>
        </div>
      </header>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {dirty && (
        <p role="status" className="settings-dirty-notice">
          {tr("Sources and resources")}: {tr("Unsaved changes")}
        </p>
      )}
      {!draft || !view ? (
        error ? (
          <button disabled={busy} onClick={() => void run(reload)}>
            <Text source={"Retry settings"} />
          </button>
        ) : (
          <p role="status">
            <Text source={"Loading settings…"} />
          </p>
        )
      ) : (
        <div className="campaign-settings-layout">
          <nav
            className="app-settings-nav"
            aria-label={tr("Campaign settings")}
          >
            {(
              [
                { id: "model", label: "Local AI · model", icon: "star" },
                { id: "sources", label: "Sources and resources", icon: "book" },
                { id: "knowledge", label: "Local knowledge", icon: "wiki" },
                {
                  id: "training",
                  label: "Local retraining · Gemma 4 12B",
                  icon: "settings",
                },
              ] as const
            ).map(({ id, label, icon }) => (
              <button
                key={id}
                id={`campaign-settings-link-${id}`}
                type="button"
                aria-current={section === id ? "page" : undefined}
                aria-controls={`campaign-settings-panel-${id}`}
                disabled={trainingActive && id !== "training"}
                onClick={() => setSection(id)}
              >
                <Icon name={icon} />
                <span>{tr(label)}</span>
              </button>
            ))}
          </nav>
          <div className="campaign-settings-content">
            {view.sourceError && (
              <p role="alert">
                {view.sourceError}{" "}
                <Text
                  source={
                    " Reduce the types of included sources and save the preferences."
                  }
                />
              </p>
            )}
            <div
              id="campaign-settings-panel-model"
              role="region"
              aria-labelledby="campaign-settings-link-model"
              hidden={section !== "model"}
            >
              <fieldset disabled={busy || trainingActive}>
                <legend>
                  <Text source={"Local AI · model"} />
                </legend>
                <p>
                  {draft.settings.enabled ? tr("Activate") : tr("Disabled")} ·{" "}
                  {draft.settings.model || tr("No model chosen")}
                </p>
                {retiredQwen(draft.settings.model) ? (
                  <p role="status">{tr(retiredNotice)}</p>
                ) : null}
                {draft.settings.digest && (
                  <p className="muted">
                    <Text source={"Identity: "} />
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
                      setModel((previous) =>
                        preferredModel(r.models, previous),
                      );
                    })
                  }
                >
                  <Text source={"Check Ollama and GPU"} />
                </button>
                {runtime && (
                  <>
                    <p>
                      <Text source={"Ollama "} />
                      {runtime.version}{" "}
                      <Text source={" · cloud disabled, verified"} />
                    </p>
                    <label>
                      <Text source={"Local model"} />
                      <select
                        aria-label={tr("Local model")}
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                      >
                        <option value="">{tr("Choose a model")}</option>
                        {usableModels(runtime.models).map((m) => (
                          <option key={m.digest} value={m.name}>
                            {modelLabel(m.name)} · {m.quantization} ·{" "}
                            {Math.round(m.gpuBytes / 1048576)}{" "}
                            {tr(" MiB loaded on the GPU")}
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
                          "I confirm using a multilingual model with local sources, not specialized in D&D."
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
                              "Model activated for this campaign. The GPU will be checked before sending notes.",
                            ),
                          );
                        })
                      }
                    >
                      <Text source={"Activate model for the campaign"} />
                    </button>
                  </>
                )}
                <button
                  disabled={!draft.settings.enabled || dirty}
                  onClick={() =>
                    void run(async () => {
                      await assistantApi.configure(
                        false,
                        model,
                        false,
                        campaignId,
                      );
                      await reload();
                    })
                  }
                >
                  <Text source={"Disable campaign AI"} />
                </button>
              </fieldset>
            </div>
            <div
              id="campaign-settings-panel-sources"
              role="region"
              aria-labelledby="campaign-settings-link-sources"
              hidden={section !== "sources"}
            >
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    await campaignAi.save(campaignId, draft);
                    await reload();
                    setNotice(tr("Campaign preferences saved."));
                  });
                }}
              >
                <fieldset disabled={busy || trainingActive}>
                  <legend>
                    <Text source={"Sources and resources"} />
                  </legend>
                  <label>
                    <Text source={"D&D edition"} />
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
                    <Text source={"Maximum context"} />
                    <select
                      value={draft.context}
                      onChange={(e) =>
                        patch({ context: Number(e.target.value) })
                      }
                    >
                      {[2048, 4096, 8192].map((n) => (
                        <option key={n} value={n}>
                          {n} <Text source={" token"} />
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <Text source={"Maximum answer length"} />
                    <input
                      type="number"
                      min={128}
                      max={1024}
                      value={draft.maxTokens}
                      onChange={(e) =>
                        patch({ maxTokens: Number(e.target.value) })
                      }
                    />
                  </label>
                  <p>
                    <Text
                      source={
                        "A larger context needs more VRAM. The runtime and the physical GPU are shared; these preferences do not change their global settings."
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
                    <Text source={"Approved local rules"} />
                  </h3>
                  <p>
                    <Text
                      source={
                        "Up to six entries of the same edition, already viewed in the Wiki."
                      }
                    />
                  </p>
                  {rules.length === 0 ? (
                    <p>
                      <Text
                        source={"No local entries available for this edition."}
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
                    <Text source={"Save preferences"} />
                  </button>
                  {dirty && (
                    <p role="status">
                      <Text
                        source={
                          "Save the preferences before refreshing knowledge or changing model."
                        }
                      />
                    </p>
                  )}
                </fieldset>
              </form>
            </div>
            <div
              id="campaign-settings-panel-knowledge"
              role="region"
              aria-labelledby="campaign-settings-link-knowledge"
              hidden={section !== "knowledge"}
            >
              <fieldset disabled={busy || dirty || trainingActive}>
                <legend>
                  <Text source={"Local knowledge"} />
                </legend>
                <p>
                  <Text source={"Last refresh:"} />{" "}
                  {view.profile.indexedAt
                    ? new Date(view.profile.indexedAt).toLocaleString(
                        localeInfo(getPreferences().locale).intl,
                      )
                    : tr("Never run")}
                </p>
                <p>
                  {view.added} <Text source={" new excerpts · "} />
                  {view.changed} <Text source={" changed ·"} /> {view.removed}{" "}
                  <Text source={" removed since the last knowledge refresh."} />
                </p>
                <button
                  onClick={() =>
                    void run(async () => {
                      const v = await campaignAi.refresh(campaignId);
                      setView(v);
                      setDraft(v.profile);
                      setNotice(
                        tr(
                          "Knowledge refreshed. The model weights were not retrained.",
                        ),
                      );
                    })
                  }
                >
                  <Text source={"Refresh knowledge"} />
                </button>
                <details>
                  <summary>
                    <Text source={"Preview of the included sources ("} />
                    {view.sources.length} <Text source={" excerpts)"} />
                  </summary>
                  <p>
                    <Text
                      source={
                        "Excerpts from the selected campaign; AI conversations and photos are not training data."
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
                          <Text source={"Exclude this source"} />
                        </button>
                      )}
                    </article>
                  ))}
                  {view.sources.length > 100 && (
                    <p>
                      <Text
                        source={"Preview limited to the first 100 excerpts."}
                      />
                    </p>
                  )}
                </details>
              </fieldset>
            </div>
            <div
              id="campaign-settings-panel-training"
              role="region"
              aria-labelledby="campaign-settings-link-training"
              hidden={section !== "training"}
            >
              <TrainingPanel
                campaignId={campaignId}
                disabled={busy || dirty || trainingActive}
                version={JSON.stringify(view.profile)}
                register={register}
                onActive={setTrainingActive}
                onActivated={reload}
              />
            </div>
            {draft.excludedIds.length > 0 && (
              <button
                disabled={busy || trainingActive}
                onClick={() => patch({ excludedIds: [] })}
              >
                <Text source={"Readmit excluded sources ("} />
                {draft.excludedIds.length})
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
