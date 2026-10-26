import { afterEach, describe, expect, it } from "vitest";
import { defaultPreferences } from "./locales";
import {
  applyPreferences,
  getPreferences,
  tr,
  translateError,
  loadLocale,
  date,
  number,
  plural,
} from "./store";
afterEach(() => applyPreferences(defaultPreferences));
describe("interface stays separate from campaign content", () => {
  it("uses English by default and keeps Italian source aliases compatible", () => {
    applyPreferences(defaultPreferences);
    expect(getPreferences().locale).toBe("en");
    expect(tr("Nuova campagna")).toBe("New campaign");
    applyPreferences({ ...defaultPreferences, locale: "it" });
    expect(tr("New campaign")).toBe("Nuova campagna");
  });
  it("falls back to English and preserves unknown campaign content", async () => {
    await loadLocale("ko");
    applyPreferences({ ...defaultPreferences, locale: "ko" });
    const note = "Oran: 日本語 العربية [[Speratia]] {99}";
    expect(tr(note)).toBe(note);
    expect(translateError(note)).toBe(note);
    // Messages missing from a catalogue stay English, with parameters filled.
    expect(tr("Uncatalogued source message d{0}", [100])).toBe(
      "Uncatalogued source message d100",
    );
  });
  it("updates language and direction without changing parameter values", () => {
    applyPreferences({ ...defaultPreferences, locale: "ar" });
    expect(document.documentElement.dir).toBe("rtl");
    expect(getPreferences().locale).toBe("ar");
    expect(
      tr("Session {0}: {1}", [3, "Oran"]).includes("\u2068Oran\u2069"),
    ).toBe(true);
    expect(number(1234)).toBe(new Intl.NumberFormat("ar").format(1234));
    expect(plural(0, { zero: "Zero", other: "Other" })).toBe("Zero");
    expect(date("invalid")).toBe("Date not given");
  });
  it("rejects unknown preferences without replacing valid ones", () => {
    expect(() =>
      applyPreferences({ ...defaultPreferences, locale: "invalid" } as never),
    ).toThrow();
    expect(getPreferences()).toEqual(defaultPreferences);
  });
});
