import { describe, expect, it } from "vitest";
import {
  decodeMorse,
  transcribe,
  transcriptionPacket,
  restoreTranscription,
} from "./transcription";
describe("trascrizione senza perdita degli originali", () => {
  it("Morse ITU, decodifica normalizzata e codici sconosciuti", () => {
    expect(transcribe("SOS 100", "morse").text).toBe(
      "... --- ... / .---- ----- -----",
    );
    expect(decodeMorse("... --- ... / .---- ----- -----")).toBe("SOS 100");
    expect(decodeMorse("???")).toBe("�");
  });
  it("Braille italiano letterario: maiuscole, numeri, accenti e punteggiatura", () => {
    expect(transcribe("Ab 10, è!", "braille").text).toBe("⠨⠁⠃ ⠼⠁⠚⠂ ⠮⠖");
    expect(transcribe("1a", "braille").text).toBe("⠼⠁⠰⠁");
  });
  it("Galattico Monocraft usa soltanto i glifi A–Z del font concesso", () => {
    expect(transcribe("Az 100!", "galactic")).toEqual({
      text: "\ueb40\ueb59 100!",
      unsupported: [],
    });
    expect(transcribe("日本 العربية", "galactic").unsupported).toContain("日");
  });
  it.each(["standard", "braille", "morse", "galactic"] as const)(
    "%s: pacchetto ripristina byte per byte e rifiuta alterazioni",
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
