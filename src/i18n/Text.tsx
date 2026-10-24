import { useEffect, useState } from "react";
import { usePreferences, tr } from "./store";
import { transcribe } from "./transcription";
let fontRequest: Promise<boolean> | undefined;
function galacticFont() {
  return (fontRequest ??=
    typeof document !== "undefined" && document.fonts?.load
      ? document.fonts
          .load('16px "Chronexus Galactic"', "\ueb40")
          .then((faces) => faces.length > 0)
          .catch(() => false)
      : Promise.resolve(false));
}
/** Only controlled interface labels go here. Campaign/user text is rendered directly. */
export function Label({ value }: { value: string }) {
  const p = usePreferences();
  const [fontReady, setFontReady] = useState(false);
  useEffect(() => {
    if (p.script !== "galactic") return;
    let active = true;
    void galacticFont().then((ready) => {
      if (active) setFontReady(ready);
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
          (p.script === "galactic" && !fontReady)
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
