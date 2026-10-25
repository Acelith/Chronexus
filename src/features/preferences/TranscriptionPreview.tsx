import { useState } from "react";
import { tr, usePreferences } from "../../i18n/store";
import {
  decodeMorse,
  restoreTranscription,
  transcribe,
  transcriptionPacket,
} from "../../i18n/transcription";
import { Label, Text } from "../../i18n/Text";
export default function TranscriptionPreview() {
  const p = usePreferences();
  const [source, setSource] = useState("Chronexus 100"),
    [packet, setPacket] = useState(""),
    [notice, setNotice] = useState("");
  const result = transcribe(source, p.script);
  return (
    <section
      className="transcription-preview"
      aria-label={tr("Transcription lab")}
    >
      <h4>
        <Text source="Try the script" />
      </h4>
      <p>
        <Text source="This space is separate from your notes. Unsupported characters stay readable. Braille uses a six-dot uncontracted Italian literary subset; it is not an embossing engine. Morse does not distinguish upper and lower case. Galactic transcribes A–Z; digits and punctuation stay ordinary." />
      </p>
      <label>
        <Text source="Text to transcribe" />
        <textarea
          dir="auto"
          maxLength={10000}
          value={source}
          onChange={(e) => {
            setSource(e.target.value);
            setNotice("");
          }}
        />
      </label>
      {p.script === "espruar" || p.script === "dethek" ? (
        <p>
          {tr(
            "Espruar and Dethek use the glyphs of the original fonts for A–Z and a–z. Digits and punctuation stay ordinary. The rendering depends on the font; it is not a translation of the language. The v2 package keeps the original and the alphabet revision.",
          )}
        </p>
      ) : null}
      <div className="transcription-sample">
        <Label value={source} />
      </div>
      <label>
        <Text source="Transcription" />
        <textarea
          className={
            p.script === "galactic"
              ? "galactic-output"
              : p.script === "espruar" || p.script === "dethek"
                ? `alphabet-output ${p.script}-output`
                : ""
          }
          dir="ltr"
          readOnly
          value={result.text}
        />
      </label>
      {result.unsupported.length ? (
        <p role="status">
          {tr("Characters kept in the original: {0}", [
            result.unsupported.join(" "),
          ])}
        </p>
      ) : null}
      <p>
        <Text source="The package keeps the original and the transcription, so restoring is exact even for accents, capitals and characters that cannot be represented. It is not saved in campaigns." />
      </p>
      <div className="actions">
        <button
          type="button"
          onClick={() => {
            setPacket(transcriptionPacket(source, p.script));
            setNotice(tr("Package ready: select and copy the text below."));
          }}
        >
          <Text source="Prepare reversible package" />
        </button>
        {p.script === "morse" ? (
          <button
            type="button"
            onClick={() => {
              setSource(decodeMorse(source));
              setNotice(
                tr("Morse decodes to uppercase; � marks an unknown code."),
              );
            }}
          >
            <Text source="Read Morse code from text" />
          </button>
        ) : null}
      </div>
      <label>
        <Text source="Original and transcription package" />
        <textarea
          dir="ltr"
          maxLength={250000}
          value={packet}
          onChange={(e) => setPacket(e.target.value)}
        />
      </label>
      <button
        type="button"
        disabled={!packet}
        onClick={() => {
          try {
            setSource(restoreTranscription(packet));
            setNotice(tr("Original restored in the lab."));
          } catch {
            setNotice(
              tr("Invalid package: check format, version and transcription."),
            );
          }
        }}
      >
        <Text source="Restore original from package" />
      </button>
      {notice ? <p role="status">{notice}</p> : null}
    </section>
  );
}
