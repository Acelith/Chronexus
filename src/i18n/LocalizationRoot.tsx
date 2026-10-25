import { useEffect, useState, type ReactNode } from "react";
import { preferencesApi } from "./preferencesApi";
import {
  applyPreferences,
  loadLocale,
  tr,
  usePreferences,
  getPreferences,
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
        await loadLocale(prefs.locale);
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
