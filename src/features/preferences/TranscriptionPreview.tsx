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
      aria-label={tr("Laboratorio di trascrizione")}
    >
      <h4>
        <Text source="Prova la scrittura" />
      </h4>
      <p>
        <Text source="Questo spazio è indipendente dagli appunti. I caratteri non supportati rimangono leggibili. Il Braille usa un sottoinsieme letterario italiano a sei punti, non contratto; non è un motore per stampa in rilievo. Morse non distingue maiuscole e minuscole. Il Galattico trascrive A–Z; cifre e punteggiatura restano ordinarie." />
      </p>
      <label>
        <Text source="Testo da trascrivere" />
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
            "Espruar e Dethek usano i glifi dei font originali per A–Z e a–z. Cifre e punteggiatura restano ordinarie. La resa dipende dal font, non è una traduzione della lingua. Il pacchetto v2 conserva l’originale e la revisione dell’alfabeto.",
          )}
        </p>
      ) : null}
      <div className="transcription-sample">
        <Label value={source} />
      </div>
      <label>
        <Text source="Trascrizione" />
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
          {tr("Caratteri mantenuti in originale: {0}", [
            result.unsupported.join(" "),
          ])}
        </p>
      ) : null}
      <p>
        <Text source="Il pacchetto conserva originale e trascrizione, così il ripristino è esatto anche per accenti, maiuscole e caratteri non rappresentabili. Non viene salvato nelle campagne." />
      </p>
      <div className="actions">
        <button
          type="button"
          onClick={() => {
            setPacket(transcriptionPacket(source, p.script));
            setNotice(
              tr("Pacchetto pronto: seleziona e copia il testo qui sotto."),
            );
          }}
        >
          <Text source="Prepara pacchetto reversibile" />
        </button>
        {p.script === "morse" ? (
          <button
            type="button"
            onClick={() => {
              setSource(decodeMorse(source));
              setNotice(
                tr(
                  "Decodifica Morse in maiuscolo; � indica un codice sconosciuto.",
                ),
              );
            }}
          >
            <Text source="Leggi codici Morse dal testo" />
          </button>
        ) : null}
      </div>
      <label>
        <Text source="Pacchetto originale e trascrizione" />
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
            setNotice(tr("Originale ripristinato nel laboratorio."));
          } catch {
            setNotice(
              tr(
                "Pacchetto non valido: controlla formato, versione e trascrizione.",
              ),
            );
          }
        }}
      >
        <Text source="Ripristina originale dal pacchetto" />
      </button>
      {notice ? <p role="status">{notice}</p> : null}
    </section>
  );
}
