import { useState } from "react";
import { tr } from "../../i18n/store";
import { command, errorMessage } from "../journal/api";

export default function DiagnosticsSettings({ disabled }: { disabled: boolean }) {
  const [content, setContent] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  async function preview() {
    setPending(true);
    setError("");
    setSaved(false);
    try {
      const result = await command<{ content: string }>("preview_diagnostics");
      setContent(result.content);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setPending(false);
    }
  }
  async function save() {
    setPending(true);
    setError("");
    try {
      setSaved(await command<boolean>("save_diagnostics", { content }));
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setPending(false);
    }
  }
  return <section className="language-settings" aria-label={tr("Diagnostics")}>
    <h3>{tr("Diagnostics")}</h3>
    <p>{tr("Preview a local diagnostic report before saving it. Chronexus never sends it.")}</p>
    <button type="button" disabled={disabled || pending} onClick={() => void preview()}>{tr("Preview diagnostics")}</button>
    {content && <>
      <pre tabIndex={0} style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{content}</pre>
      <button type="button" disabled={disabled || pending} onClick={() => void save()}>{tr("Save diagnostic file…")}</button>
    </>}
    {saved && <p role="status">{tr("Diagnostic file saved.")}</p>}
    {error && <p className="error" role="alert">{error}</p>}
  </section>;
}
