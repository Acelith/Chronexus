import { tr } from "../../i18n/store";
import { Text } from "../../i18n/Text";
import { useEffect, useState } from "react";
import { command, errorMessage } from "../journal/api";
interface Source {
  name: string;
  content: string;
  sha256: string;
}
export default function ImportSource({
  campaignId,
  kind,
  id,
}: {
  campaignId: string;
  kind: "session" | "page";
  id: string;
}) {
  const [source, setSource] = useState<Source | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    command<Source | null>("get_import_source", { campaignId, kind, id })
      .then((s) => {
        if (active) setSource(s);
      })
      .catch((e) => {
        if (active) setError(errorMessage(e));
      });
    return () => {
      active = false;
    };
  }, [campaignId, kind, id]);
  if (error)
    return (
      <p role="alert" className="error">
        <Text source={"Sorgente importata: "} />
        {error}
      </p>
    );
  if (!source) return null;
  return (
    <details className="import-source">
      <summary>
        <Text source={"Sorgente Logseq originale"} />
      </summary>
      <p>
        {source.name}{" "}
        <Text
          source={
            " · conservata nel backup e nell’export. Le modifiche negli appunti non alterano questa copia."
          }
        />
      </p>
      <textarea
        aria-label={tr("Markdown originale importato")}
        readOnly
        value={source.content}
        rows={12}
      />
      <p className="muted">
        <Text source={"SHA-256: "} />
        {source.sha256}
      </p>
    </details>
  );
}
