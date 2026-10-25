import { useEffect, useRef, useState } from "react";
import { localeInfo } from "../../i18n/locales";
import { getPreferences, tr } from "../../i18n/store";
import { errorMessage } from "../journal/api";
import {
  announceWikiChange,
  providerNames,
  wikiProviderApi,
  type CacheSummary,
  type WikiChoice,
  type WikiProvider,
} from "./provider";

type Scope = WikiProvider | "all";
function size(bytes: number) {
  return new Intl.NumberFormat(localeInfo(getPreferences().locale).intl, {
    maximumFractionDigits: 1,
  }).format(bytes / 1024);
}
/** Global wiki source and disposable offline cache; available without a campaign. */
export default function WikiSettings({ disabled }: { disabled: boolean }) {
  const [choice, setChoice] = useState<WikiChoice | null>(null);
  const [summary, setSummary] = useState<CacheSummary | null>(null);
  const [scope, setScope] = useState<Scope>("wikidot");
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const confirmButton = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    let active = true;
    Promise.all([wikiProviderApi.get(), wikiProviderApi.summary()])
      .then(([c, s]) => {
        if (active) {
          setChoice(c);
          setSummary(s);
        }
      })
      .catch((reason) => {
        if (active) setError(errorMessage(reason));
      });
    return () => {
      active = false;
    };
  }, []);
  const wasOpen = useRef(false);
  useEffect(() => {
    // Focus moves only after render, when the opener is enabled again.
    if (confirm) confirmButton.current?.focus();
    else if (wasOpen.current) opener.current?.focus();
    wasOpen.current = confirm;
  }, [confirm]);
  async function perform(action: () => Promise<string>) {
    if (pending || disabled) return;
    setPending(true);
    setError("");
    setNotice("");
    try {
      setNotice(await action());
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setPending(false);
    }
  }
  const busy = pending || disabled;
  const selected =
    summary &&
    (scope === "all"
      ? {
          entries: summary.open5e.entries + summary.wikidot.entries,
          bytes: summary.open5e.bytes + summary.wikidot.bytes,
          aiSources: summary.open5e.aiSources + summary.wikidot.aiSources,
        }
      : summary[scope]);
  const scopeName =
    scope === "all" ? tr("tutte le cache wiki") : providerNames[scope];
  function close() {
    setConfirm(false);
  }
  return (
    <section
      className="language-settings wiki-settings"
      aria-label={tr("Fonti D&D / Wiki")}
    >
      <h3>{tr("Fonti D&D / Wiki")}</h3>
      <p>
        {tr(
          "Scegli la fonte usata dalla Wiki D&D. Le richieste partono solo quando cerchi o apri una voce e non contengono dati delle campagne. Il catalogo SRD 2014 della scheda e gli incantesimi già salvati non cambiano.",
        )}
      </p>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {!choice && !error ? (
        <p role="status">{tr("Lettura delle impostazioni…")}</p>
      ) : null}
      {choice ? (
        <fieldset disabled={busy}>
          <legend>{tr("Fonte della Wiki D&D")}</legend>
          {(["wikidot", "open5e"] as const).map((provider) => (
            <label key={provider} className="wiki-provider-option">
              <input
                type="radio"
                name="wiki-provider"
                value={provider}
                checked={choice.provider === provider}
                onChange={() =>
                  void perform(async () => {
                    const saved = await wikiProviderApi.save(provider);
                    setChoice(saved);
                    announceWikiChange();
                    return tr("Fonte wiki salvata: {0}.", [
                      providerNames[saved.provider],
                    ]);
                  })
                }
              />
              {provider === "wikidot"
                ? tr(
                    "Wikidot D&D 5e (predefinita) · pagine pubbliche di dnd5e.wikidot.com, edizione 2014; segnala Unearthed Arcana e homebrew",
                  )
                : tr(
                    "Open5e · API pubblica multi-fonte con documento, edizione e licenze per ogni voce",
                  )}
            </label>
          ))}
          {!choice.explicit ? (
            <p className="muted">
              {tr(
                "Nessuna scelta salvata: è attiva la fonte predefinita Wikidot.",
              )}
            </p>
          ) : null}
        </fieldset>
      ) : null}
      <h4>{tr("Cache offline delle wiki")}</h4>
      <p>
        {tr(
          "Le voci consultate restano disponibili senza connessione. Svuotare la cache rimuove soltanto queste copie: campagne, appunti, immagini, incantesimi importati, backup e fonte scelta restano intatti.",
        )}
      </p>
      {summary ? (
        <ul className="wiki-cache-summary">
          {(["wikidot", "open5e"] as const).map((p) => (
            <li key={p}>
              {tr("{0} · voci in cache: {1} · {2} KB", [
                providerNames[p],
                summary[p].entries,
                size(summary[p].bytes),
              ])}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="actions">
        <label>
          {tr("Cache da svuotare")}
          <select
            value={scope}
            disabled={busy || confirm}
            onChange={(e) => setScope(e.target.value as Scope)}
          >
            <option value="wikidot">{providerNames.wikidot}</option>
            <option value="open5e">{providerNames.open5e}</option>
            <option value="all">{tr("Tutte le cache wiki")}</option>
          </select>
        </label>
        <button
          ref={opener}
          disabled={busy || confirm || !selected?.entries}
          onClick={() => {
            setNotice("");
            setConfirm(true);
          }}
        >
          {tr("Svuota cache offline…")}
        </button>
      </div>
      {summary && !selected?.entries ? (
        <p className="muted">{tr("La cache selezionata è già vuota.")}</p>
      ) : null}
      {confirm && selected ? (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="wiki-clear-title"
          className="wiki-confirm"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              close();
            }
          }}
        >
          <h4 id="wiki-clear-title">{tr("Svuotare {0}?", [scopeName])}</h4>
          <p>
            {tr(
              "Verranno eliminate {0} copie consultate ({1} KB). Non saranno più leggibili offline finché non le riapri online; nessun nuovo download parte automaticamente. Le richieste in corso vengono annullate.",
              [selected.entries, size(selected.bytes)],
            )}
          </p>
          {selected.aiSources ? (
            <p className="error">
              {tr(
                "{0} fonti regole approvate nelle impostazioni AI delle campagne usano questa cache: per le nuove domande risulteranno non disponibili. Conversazioni e citazioni già salvate restano invariate.",
                [selected.aiSources],
              )}
            </p>
          ) : null}
          <div className="actions">
            <button
              ref={confirmButton}
              className="danger"
              disabled={busy}
              onClick={() =>
                void perform(async () => {
                  const next = await wikiProviderApi.clear(scope);
                  setSummary(next);
                  setConfirm(false);
                  announceWikiChange();
                  return tr("Cache svuotata: {0}.", [scopeName]);
                })
              }
            >
              {tr("Svuota cache")}
            </button>
            <button disabled={pending} onClick={close}>
              {tr("Annulla")}
            </button>
          </div>
        </div>
      ) : null}
      <p role="status">{pending ? tr("Operazione in corso…") : notice}</p>
    </section>
  );
}
