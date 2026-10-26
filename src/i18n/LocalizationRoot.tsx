import { useEffect, useState, type ReactNode } from "react";
import { preferencesApi } from "./preferencesApi";
import { resolveLocale } from "./locales";
import {
  applyPreferences,
  loadLocale,
  tr,
  usePreferences,
  getPreferences,
  getSavedPreferences,
} from "./store";
export default function LocalizationRoot({
  children,
}: {
  children: ReactNode;
}) {
  const preferences = usePreferences();
  const [failedPreferences, setFailedPreferences] = useState<ReturnType<
    typeof getPreferences
  > | null>(null);
  const [ready, setReady] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void preferencesApi
      .read()
      .then(async (prefs) => {
        await loadLocale(resolveLocale(prefs.locale));
        if (active) applyPreferences(prefs);
      })
      .catch((reason) => {
        if (active) {
          setFailedPreferences(getPreferences());
          setError(
            typeof reason === "string"
              ? reason
              : reason instanceof Error
                ? reason.message
                : "Cannot read the interface preferences.",
          );
        }
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    // Follow the operating system while the saved choice is "system".
    function follow() {
      const prefs = getSavedPreferences();
      if (prefs.locale !== "system") return;
      void loadLocale(resolveLocale("system")).then(() => {
        if (getSavedPreferences() === prefs) applyPreferences(prefs);
      });
    }
    window.addEventListener("languagechange", follow);
    return () => window.removeEventListener("languagechange", follow);
  }, []);
  if (!ready) return <p role="status">{tr("Opening archive…")}</p>;
  return (
    <>
      {error && failedPreferences === preferences ? (
        <p role="alert" className="error">
          {tr(error)}
        </p>
      ) : null}
      {children}
    </>
  );
}
