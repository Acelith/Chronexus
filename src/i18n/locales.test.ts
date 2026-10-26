import { describe, expect, it } from "vitest";
import { matchLocale, systemLocale, validPreferences } from "./locales";

describe("system language", () => {
  it("maps regional and POSIX tags to bundled locales", () => {
    expect(matchLocale("it-CH")).toBe("it");
    expect(matchLocale("de_AT.UTF-8")).toBe("de");
    expect(matchLocale("FR-ca")).toBe("fr");
    expect(matchLocale("pt-PT")).toBe("pt-BR");
    expect(matchLocale("zh-CN")).toBe("zh-Hans");
    expect(matchLocale("zh-Hans-HK")).toBe("zh-Hans");
    expect(matchLocale("ar-EG")).toBe("ar");
  });
  it("does not guess for languages without a translation", () => {
    expect(matchLocale("zh-TW")).toBeNull();
    expect(matchLocale("zh-Hant")).toBeNull();
    expect(matchLocale("sv-SE")).toBeNull();
    expect(matchLocale("")).toBeNull();
  });
  it("uses the first supported OS language, otherwise English", () => {
    expect(systemLocale(["sv-SE", "ja-JP", "en-US"])).toBe("ja");
    expect(systemLocale(["sv-SE", "nb-NO"])).toBe("en");
    expect(systemLocale([])).toBe("en");
  });
  it("accepts system as a saved choice but no other unknown value", () => {
    const base = { version: 2, script: "standard", showOriginal: true };
    expect(validPreferences({ ...base, locale: "system" })).toBe(true);
    expect(validPreferences({ ...base, locale: "sv" })).toBe(false);
  });
});
