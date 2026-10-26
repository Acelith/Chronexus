import { describe, expect, it } from "vitest";
import {
  decodeMorse,
  transcribe,
  transcriptionPacket,
  restoreTranscription,
} from "./transcription";
describe("transcription preserves originals", () => {
  it("ITU Morse, normalized decoding and unknown codes", () => {
    expect(transcribe("SOS 100", "morse").text).toBe(
      "... --- ... / .---- ----- -----",
    );
    expect(decodeMorse("... --- ... / .---- ----- -----")).toBe("SOS 100");
    expect(decodeMorse("???")).toBe("�");
  });
  it("Italian literary Braille: capitals, numbers, accents and punctuation", () => {
    expect(transcribe("Ab 10, è!", "braille").text).toBe("⠨⠁⠃ ⠼⠁⠚⠂ ⠮⠖");
    expect(transcribe("1a", "braille").text).toBe("⠼⠁⠰⠁");
  });
  it("Monocraft Galactic uses only A–Z glyphs from the licensed font", () => {
    expect(transcribe("Az 100!", "galactic")).toEqual({
      text: "\ueb40\ueb59 100!",
      unsupported: [],
    });
    expect(transcribe("日本 العربية", "galactic").unsupported).toContain("日");
  });
  it.each(["standard", "braille", "morse", "galactic"] as const)(
    "%s: package restores exact bytes and rejects tampering",
    (script) => {
      const source = "Oran è Vivo! 100\n日本語 العربية [[UUID]]";
      const packet = transcriptionPacket(source, script);
      expect(restoreTranscription(packet)).toBe(source);
      const altered = JSON.parse(packet);
      altered.encoded += "x";
      expect(() => restoreTranscription(JSON.stringify(altered))).toThrow();
      altered.version = 2;
      expect(() => restoreTranscription(JSON.stringify(altered))).toThrow();
    },
  );
});

it.each(["espruar", "dethek"] as const)(
  "%s: original font mapping and reversible v2 package",
  (script) => {
    const source = "AaZz 100 è 日本語 العربية ſ";
    const rendered = transcribe(source, script);
    expect(rendered.text).toBe(source);
    expect(rendered.unsupported).toContain("è");
    expect(rendered.unsupported).toContain("日");
    expect(rendered.unsupported).toContain("ſ");
    const packet = transcriptionPacket(source, script),
      parsed = JSON.parse(packet);
    expect(parsed.version).toBe(2);
    expect(parsed.alphabetRevision).toBe(1);
    expect(restoreTranscription(packet)).toBe(source);
    parsed.version = 1;
    expect(() => restoreTranscription(JSON.stringify(parsed))).toThrow();
    parsed.version = 2;
    parsed.alphabetRevision = 2;
    expect(() => restoreTranscription(JSON.stringify(parsed))).toThrow();
  },
);
