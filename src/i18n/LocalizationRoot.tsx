import { useEffect, useState, type ReactNode } from "react";
import { preferencesApi } from "./preferencesApi";
import { applyPreferences, loadLocale, tr } from "./store";
export default function LocalizationRoot({
  children,
}: {
  children: ReactNode;
}) {
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
        if (active)
          setError(
            typeof reason === "string"
              ? reason
              : reason instanceof Error
                ? reason.message
                : "Impossibile leggere le preferenze dell’interfaccia.",
          );
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);
  if (!ready) return <p role="status">{tr("Apertura archivio…")}</p>;
  return (
    <>
      {error ? (
        <p role="alert" className="error">
          {tr(error)}
        </p>
      ) : null}
      {children}
    </>
  );
}
