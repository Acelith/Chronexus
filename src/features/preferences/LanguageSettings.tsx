import TranscriptionPreview from "./TranscriptionPreview";
import { useState } from "react";
import {
  defaultPreferences,
  localeInfo,
  locales,
  resolveLocale,
  type LocaleChoice,
  type SavedPreferences,
  type Script,
} from "../../i18n/locales";
import {
  applyPreferences,
  getSavedPreferences,
  loadLocale,
  tr,
  translationCoverage,
  usePreferences,
  useSavedPreferences,
} from "../../i18n/store";
import { preferencesApi } from "../../i18n/preferencesApi";
import { errorMessage } from "../journal/api";
export default function LanguageSettings({
  disabled = false,
}: {
  disabled?: boolean;
}) {
  const preferences = useSavedPreferences(),
    effective = usePreferences();
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const coverage = translationCoverage();
  async function change(next: SavedPreferences) {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await loadLocale(resolveLocale(next.locale));
      const saved = await preferencesApi.save(next);
      applyPreferences(saved);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="language-settings" aria-label={tr("App settings")}>
      <h3>{tr("Language and script")}</h3>
      <p>
        {tr(
          "Choose the interface language. Notes, names, D&D sources and campaign data keep their original text.",
        )}
      </p>
      <form onSubmit={(event) => event.preventDefault()}>
        <label>
          {tr("Interface language")}
          <select
            aria-label={tr("Interface language")}
            value={preferences.locale}
            disabled={pending || disabled}
            onChange={(event) =>
              void change({
                ...preferences,
                locale: event.target.value as LocaleChoice,
              })
            }
          >
            <option value="system">{tr("Automatic (system language)")}</option>
            {locales.map((locale) => (
              <option key={locale.id} value={locale.id} lang={locale.id}>
                {locale.name}
              </option>
            ))}
          </select>
        </label>
        {preferences.locale === "system" ? (
          <p className="language-system">
            {tr(
              "Following the system language: {0}. Languages without a translation use English.",
              [localeInfo(effective.locale).name],
            )}
          </p>
        ) : null}
        <label>
          {tr("Script mode")}
          <select
            aria-label={tr("Script mode")}
            value={preferences.script}
            disabled={pending || disabled}
            onChange={(event) =>
              void change({
                ...preferences,
                script: event.target.value as Script,
              })
            }
          >
            <option value="standard">{tr("Ordinary text")}</option>
            <option value="braille">
              {tr("Italian uncontracted Braille")}
            </option>
            <option value="morse">{tr("International Morse")}</option>
            <option value="galactic">
              {tr("Standard Galactic Alphabet · Minecraft")}
            </option>
            <option value="espruar">{tr("D&D Elvish · Espruar")}</option>
            <option value="dethek">{tr("D&D Dwarvish · Dethek")}</option>
          </select>
        </label>
        <label className="language-checkbox">
          <input
            type="checkbox"
            checked={preferences.showOriginal}
            disabled={pending || disabled}
            onChange={(event) =>
              void change({
                ...preferences,
                showOriginal: event.target.checked,
              })
            }
          />
          {tr("Also show the ordinary text next to the transcription")}
        </label>
      </form>
      {pending ? <p role="status">{tr("Saving preferences…")}</p> : null}
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      <p role="status">
        {tr("Available messages: {0} of {1}.", [
          coverage.translated,
          coverage.total,
        ])}
      </p>
      {effective.locale !== "it" ? (
        <p className="language-review">
          {tr(
            "Translation prepared automatically and awaiting review. Missing strings stay in English.",
          )}
        </p>
      ) : null}
      <p>
        {tr(
          "Braille, Morse and Galactic are renderings of the text, not languages. The semantic text stays available to assistive technologies.",
        )}
      </p>
      <TranscriptionPreview />
      <button
        type="button"
        className="language-recovery"
        disabled={pending || disabled}
        lang="en"
        dir="ltr"
        onClick={() =>
          void change({ ...getSavedPreferences(), ...defaultPreferences })
        }
      >
        English · Reset language and script
      </button>
    </section>
  );
}
