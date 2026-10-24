import { lexicons } from "../../i18n/lexicons";
import TranscriptionPreview from "./TranscriptionPreview";
import { useState } from "react";
import {
  defaultPreferences,
  locales,
  type Locale,
  type Preferences,
  type Script,
} from "../../i18n/locales";
import {
  applyPreferences,
  getPreferences,
  loadLocale,
  tr,
  translationCoverage,
  usePreferences,
} from "../../i18n/store";
import { preferencesApi } from "../../i18n/preferencesApi";
import { errorMessage } from "../journal/api";
export default function LanguageSettings() {
  const preferences = usePreferences();
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const coverage = translationCoverage();
  async function change(next: Preferences) {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await loadLocale(next.locale);
      const saved = await preferencesApi.save(next);
      applyPreferences(saved);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setPending(false);
    }
  }
  return (
    <section
      className="language-settings"
      aria-label={tr("Impostazioni dell’app")}
    >
      <h3>{tr("Lingua e scrittura")}</h3>
      <p>
        {tr(
          "Scegli la lingua dell’interfaccia. Appunti, nomi, fonti D&D e dati delle campagne mantengono il testo originale.",
        )}
      </p>
      <form onSubmit={(event) => event.preventDefault()}>
        <label>
          {tr("Lingua dell’interfaccia")}
          <select
            value={preferences.locale}
            disabled={pending}
            onChange={(event) =>
              void change({
                ...preferences,
                locale: event.target.value as Locale,
              })
            }
          >
            {locales.map((locale) => (
              <option key={locale.id} value={locale.id} lang={locale.id}>
                {locale.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {tr("Modalità di scrittura")}
          <select
            value={preferences.script}
            disabled={pending}
            onChange={(event) =>
              void change({
                ...preferences,
                script: event.target.value as Script,
              })
            }
          >
            <option value="standard">{tr("Testo ordinario")}</option>
            <option value="braille">
              {tr("Braille italiano non contratto")}
            </option>
            <option value="morse">{tr("Morse internazionale")}</option>
            <option value="galactic">
              {tr("Alfabeto Galattico Standard · Minecraft")}
            </option>
          </select>
        </label>
        <label className="language-checkbox">
          <input
            type="checkbox"
            checked={preferences.showOriginal}
            disabled={pending}
            onChange={(event) =>
              void change({
                ...preferences,
                showOriginal: event.target.checked,
              })
            }
          />
          {tr("Mostra anche il testo ordinario accanto alla trascrizione")}
        </label>
      </form>
      {pending ? (
        <p role="status">{tr("Salvataggio delle preferenze…")}</p>
      ) : null}
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      <p role="status">
        {tr("Messaggi disponibili: {0} su {1}.", [
          coverage.translated,
          coverage.total,
        ])}
      </p>
      {preferences.locale !== "it" ? (
        <p className="language-review">
          {tr(
            preferences.locale === "tlh" || preferences.locale === "art-x-rihan"
              ? "Vocabolario sperimentale: i termini senza equivalente verificato rimangono in italiano. Non è una traduzione integrale certificata."
              : "Traduzione preparata automaticamente e da revisionare. Le stringhe mancanti rimangono in italiano. Il ticinese usa forme generali, senza pretendere un’ortografia unica.",
          )}
        </p>
      ) : null}
      <p>
        {tr(
          "Le modalità Braille, Morse e Galattico sono rese del testo, non lingue. Il testo semantico rimane disponibile alle tecnologie assistive.",
        )}
      </p>
      {lexicons[preferences.locale] ? (
        <details className="language-lexicon">
          <summary>{tr("Lessico verificato · grafia romanizzata")}</summary>
          <p>
            {tr(
              "Questi termini sono un riferimento lessicale, non frasi complete. Le azioni senza traduzione verificata restano in italiano.",
            )}
          </p>
          <dl>
            {lexicons[preferences.locale].map(([source, word]) => (
              <div key={source}>
                <dt lang="it">{source}</dt>
                <dd lang={preferences.locale}>{word}</dd>
              </div>
            ))}
          </dl>
        </details>
      ) : null}
      <TranscriptionPreview />
      <button
        type="button"
        className="language-recovery"
        disabled={pending}
        lang="it"
        dir="ltr"
        onClick={() =>
          void change({ ...getPreferences(), ...defaultPreferences })
        }
      >
        Italiano · Ripristina lingua e scrittura
      </button>
    </section>
  );
}
