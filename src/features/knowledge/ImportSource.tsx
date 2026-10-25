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
        <Text source={"Imported source: "} />
        {error}
      </p>
    );
  if (!source) return null;
  return (
    <details className="import-source">
      <summary>
        <Text source={"Original Logseq source"} />
      </summary>
      <p>
        {source.name}{" "}
        <Text
          source={
            " · kept in the backup and export. Changes in the notes do not alter this copy."
          }
        />
      </p>
      <textarea
        aria-label={tr("Original imported Markdown")}
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
