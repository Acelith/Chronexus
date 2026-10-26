import { usePendingAction } from "../../usePendingAction";
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
  const {
    pending,
    error,
    notice,
    setError,
    setNotice,
    perform: act,
  } = usePendingAction();
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
  }, [setError]);
  const wasOpen = useRef(false);
  useEffect(() => {
    // Focus moves only after render, when the opener is enabled again.
    if (confirm) confirmButton.current?.focus();
    else if (wasOpen.current) opener.current?.focus();
    wasOpen.current = confirm;
  }, [confirm]);
  const perform = (action: () => Promise<string>) =>
    act(action, { blocked: disabled });
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
    scope === "all" ? tr("all wiki caches") : providerNames[scope];
  function close() {
    setConfirm(false);
  }
  return (
    <section
      className="language-settings wiki-settings"
      aria-label={tr("D&D sources / Wiki")}
    >
      <h3>{tr("D&D sources / Wiki")}</h3>
      <p>
        {tr(
          "Choose the source used by the D&D Wiki. Requests start only when you search or open an entry and contain no campaign data. The sheet's SRD 2014 catalog and spells already saved do not change.",
        )}
      </p>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {!choice && !error ? (
        <p role="status">{tr("Reading settings…")}</p>
      ) : null}
      {choice ? (
        <fieldset disabled={busy}>
          <legend>{tr("D&D Wiki source")}</legend>
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
                    return tr("Wiki source saved: {0}.", [
                      providerNames[saved.provider],
                    ]);
                  })
                }
              />
              {provider === "wikidot"
                ? tr(
                    "Wikidot D&D 5e (default) · public pages of dnd5e.wikidot.com, 2014 edition; flags Unearthed Arcana and homebrew",
                  )
                : tr(
                    "Open5e · public multi-source API with document, edition and license for each entry",
                  )}
            </label>
          ))}
          {!choice.explicit ? (
            <p className="muted">
              {tr("No choice saved: the default Wikidot source is active.")}
            </p>
          ) : null}
        </fieldset>
      ) : null}
      <h4>{tr("Offline wiki cache")}</h4>
      <p>
        {tr(
          "Viewed entries stay available offline. Clearing the cache removes only these copies: campaigns, notes, images, imported spells, backups and the chosen source stay intact.",
        )}
      </p>
      {summary ? (
        <ul className="wiki-cache-summary">
          {(["wikidot", "open5e"] as const).map((p) => (
            <li key={p}>
              {tr("{0} · cached entries: {1} · {2} KB", [
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
          {tr("Cache to clear")}
          <select
            value={scope}
            disabled={busy || confirm}
            onChange={(e) => setScope(e.target.value as Scope)}
          >
            <option value="wikidot">{providerNames.wikidot}</option>
            <option value="open5e">{providerNames.open5e}</option>
            <option value="all">{tr("All wiki caches")}</option>
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
          {tr("Clear offline cache…")}
        </button>
      </div>
      {summary && !selected?.entries ? (
        <p className="muted">{tr("The selected cache is already empty.")}</p>
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
          <h4 id="wiki-clear-title">{tr("Clear {0}?", [scopeName])}</h4>
          <p>
            {tr(
              "{0} viewed copies ({1} KB) will be deleted. They will not be readable offline until you open them online again; no new download starts automatically. Requests in progress are cancelled.",
              [selected.entries, size(selected.bytes)],
            )}
          </p>
          {selected.aiSources ? (
            <p className="error">
              {tr(
                "{0} rules sources approved in the campaigns' AI settings use this cache: for new questions they will be unavailable. Conversations and citations already saved are unchanged.",
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
                  return tr("Cache cleared: {0}.", [scopeName]);
                })
              }
            >
              {tr("Clear cache")}
            </button>
            <button disabled={pending} onClick={close}>
              {tr("Cancel")}
            </button>
          </div>
        </div>
      ) : null}
      <p role="status">{pending ? tr("Operation in progress…") : notice}</p>
    </section>
  );
}
