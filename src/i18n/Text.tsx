import { useEffect, useState } from "react";
import { usePreferences, tr } from "./store";
import { transcribe } from "./transcription";
const scriptFonts: Record<string, { family: string; sample: string }> = {
  galactic: { family: "Chronexus Galactic", sample: "\ueb40" },
  espruar: { family: "Chronexus Espruar", sample: "A" },
  dethek: { family: "Chronexus Dethek", sample: "A" },
};
const fontRequests = new Map<string, Promise<boolean>>();
function writingFont(script: string) {
  const font = scriptFonts[script];
  if (!font) return Promise.resolve(true);
  let request = fontRequests.get(script);
  if (!request) {
    request =
      typeof document !== "undefined" && document.fonts?.load
        ? document.fonts
            .load(`16px "${font.family}"`, font.sample)
            .then((faces) => faces.length > 0)
            .catch(() => false)
        : Promise.resolve(false);
    fontRequests.set(script, request);
  }
  return request;
}
/** Only controlled interface labels go here. Campaign/user text is rendered directly. */
export function Label({ value }: { value: string }) {
  const p = usePreferences();
  const [fontState, setFontState] = useState({ script: "", ready: false });
  useEffect(() => {
    if (!scriptFonts[p.script]) return;
    let active = true;
    void writingFont(p.script).then((ready) => {
      if (active) setFontState({ script: p.script, ready });
    });
    return () => {
      active = false;
    };
  }, [p.script]);
  if (p.script === "standard") return value;
  const rendered = transcribe(value, p.script);
  // Unmapped scripts stay legible, including when the local decorative font cannot load.
  return (
    <span className={`script-label script-${p.script}`}>
      <span
        className={
          p.showOriginal ||
          rendered.unsupported.length ||
          (!!scriptFonts[p.script] &&
            !(fontState.script === p.script && fontState.ready))
            ? "script-original"
            : "sr-only"
        }
      >
        {value}
      </span>
      <span className="script-glyphs" aria-hidden="true" dir="ltr">
        {rendered.text}
      </span>
    </span>
  );
}
export function Text({
  source,
  values = [],
}: {
  source: string;
  values?: unknown[];
}) {
  return <Label value={tr(source, values)} />;
}
