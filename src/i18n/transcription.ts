import type { Script } from "./locales";
// Letter-for-letter subset of Italian six-dot literary Braille (CBI 2009), not a grade-2 or embossing engine.
const braille = Object.fromEntries(
  [..."abcdefghijklmnopqrstuvwxyz"].map((c, i) => [
    c,
    [..."⠁⠃⠉⠙⠑⠋⠛⠓⠊⠚⠅⠇⠍⠝⠕⠏⠟⠗⠎⠞⠥⠧⠺⠭⠽⠵"][i],
  ]),
);
const accents: Record<string, string> = {
  à: "⠷",
  è: "⠮",
  é: "⠿",
  ì: "⠌",
  ò: "⠬",
  ù: "⠾",
};
const punctuation: Record<string, string> = {
  ",": "⠂",
  ";": "⠆",
  ":": "⠒",
  ".": "⠲",
  "?": "⠢",
  "!": "⠖",
  "'": "⠄",
  "’": "⠄",
  "-": "⠤",
};
const codes = [
  ".-",
  "-...",
  "-.-.",
  "-..",
  ".",
  "..-.",
  "--.",
  "....",
  "..",
  ".---",
  "-.-",
  ".-..",
  "--",
  "-.",
  "---",
  ".--.",
  "--.-",
  ".-.",
  "...",
  "-",
  "..-",
  "...-",
  ".--",
  "-..-",
  "-.--",
  "--..",
  "-----",
  ".----",
  "..---",
  "...--",
  "....-",
  ".....",
  "-....",
  "--...",
  "---..",
  "----.",
];
const morse: Record<string, string> = Object.fromEntries(
  [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"].map((c, i) => [c, codes[i]]),
);
Object.assign(morse, {
  ".": ".-.-.-",
  ",": "--..--",
  "?": "..--..",
  "'": ".----.",
  "!": "-.-.--",
  "/": "-..-.",
  "(": "-.--.",
  ")": "-.--.-",
  ":": "---...",
  ";": "-.-.-.",
  "=": "-...-",
  "+": ".-.-.",
  "-": "-....-",
  _: "..--.-",
  '"': ".-..-.",
  "@": ".--.-.",
});
export interface Transcription {
  text: string;
  unsupported: string[];
}
export function transcribe(source: string, script: Script): Transcription {
  const unsupported = new Set<string>();
  if (script === "standard") return { text: source, unsupported: [] };
  let numeric = false;
  const glyphs = [...source].map((c) => {
    if (/\s/u.test(c)) {
      numeric = false;
      return script === "morse" ? (c === "\n" ? "\n" : "/") : c;
    }
    if (script === "espruar" || script === "dethek") {
      if (!/^[A-Za-z0-9\p{P}\p{S}\s]$/u.test(c)) unsupported.add(c);
      return c; // ASCII character-to-glyph mapping in the unmodified OFL font.
    }
    if (script === "galactic") {
      if (/^[a-z]$/i.test(c))
        return String.fromCodePoint(
          0xeb40 + c.toLowerCase().charCodeAt(0) - 97,
        );
      if (!/[0-9\p{P}\p{S}]/u.test(c)) unsupported.add(c);
      return c;
    }
    if (script === "morse") {
      const code = morse[c.toUpperCase()];
      if (code) return code;
      unsupported.add(c);
      return c;
    }
    if (/[0-9]/.test(c)) {
      const prefix = numeric ? "" : "⠼";
      numeric = true;
      return prefix + braille["jabcdefghi"[Number(c)]];
    }
    const wasNumber = numeric;
    numeric = false;
    const low = c.toLowerCase(),
      value = braille[low] ?? accents[low] ?? punctuation[c];
    if (value) {
      const letterAfterNumber = wasNumber && /^[a-j]$/.test(low) ? "⠰" : "";
      return letterAfterNumber + (c !== low ? "⠨" : "") + value;
    }
    unsupported.add(c);
    return c;
  });
  return {
    text:
      script === "morse"
        ? glyphs.join(" ").replace(/ *\n */g, "\n")
        : glyphs.join(""),
    unsupported: [...unsupported],
  };
}
// Morse has no case or Unicode alphabet. Exact reversibility requires retaining the original, never guessing it.
export function transcriptionPacket(source: string, script: Script) {
  return JSON.stringify(
    {
      format: "chronexus-transcription",
      version: script === "espruar" || script === "dethek" ? 2 : 1,
      ...(script === "espruar" || script === "dethek"
        ? { alphabetRevision: 1 }
        : {}),
      script,
      original: source,
      encoded: transcribe(source, script).text,
    },
    null,
    2,
  );
}
export function restoreTranscription(packet: string): string {
  if (packet.length > 250_000)
    throw Error("Pacchetto di trascrizione troppo grande.");
  const p: unknown = JSON.parse(packet);
  if (!p || typeof p !== "object")
    throw Error("Pacchetto di trascrizione non valido.");
  const v = p as Record<string, unknown>;
  if (
    v.format !== "chronexus-transcription" ||
    !(
      (v.version === 1 &&
        ["standard", "braille", "morse", "galactic"].includes(
          String(v.script),
        )) ||
      (v.version === 2 &&
        v.alphabetRevision === 1 &&
        ["espruar", "dethek"].includes(String(v.script)))
    ) ||
    typeof v.original !== "string" ||
    typeof v.encoded !== "string" ||
    transcribe(v.original, v.script as Script).text !== v.encoded
  )
    throw Error("Pacchetto di trascrizione non valido o alterato.");
  return v.original;
}
export function decodeMorse(source: string) {
  const inverse = new Map(Object.entries(morse).map(([a, b]) => [b, a]));
  return source
    .trim()
    .split(/\s+/)
    .map((c) => (c === "/" ? " " : (inverse.get(c) ?? "�")))
    .join("");
}
