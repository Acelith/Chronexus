import { graphElements } from "../features/graph/canvas";
import { resultCount } from "./resultCount";
import { afterEach, describe, expect, it } from "vitest";
import { defaultPreferences, locales } from "./locales";
import {
  applyPreferences,
  loadLocale,
  tr,
  catalogFor,
  translationCoverage,
  translateError,
  localizeLabels,
} from "./store";
import english from "./catalogs/en.json";
import { dndPreset, emptySheet } from "../features/player/sheet";
import { emptyCharacter } from "../features/player/api";
import { spellFromCatalog } from "../features/player/catalog";
import { editorDictionary } from "./editorLocale";
afterEach(() => applyPreferences(defaultPreferences));
describe("local catalogs", () => {
  it.each(locales.filter((l) => l.id !== "en"))(
    "$id: available translations preserve placeholders and report actual coverage",
    async ({ id }) => {
      await loadLocale(id);
      const catalog = catalogFor(id);
      expect(translationCoverage(id).translated).toBeGreaterThan(0);
      expect(translationCoverage(id).translated).toBeLessThanOrEqual(
        Object.keys(english).length,
      );
      for (const [key, source] of Object.entries(english)) {
        // Newly catalogued backend diagnostics fall back to the English source.
        if (!catalog[key]) continue;
        expect(
          (catalog[key].match(/\{\d+\}/g) ?? []).sort(),
          `${id} ${source}`,
        ).toEqual((source.match(/\{\d+\}/g) ?? []).sort());
      }
    },
  );
  it("updates labels, functions and arrays without translating tokens or saved data", async () => {
    const labels = localizeLabels({
      name: "Name",
      sections: ["Character", "Inventory"],
    });
    const original = dndPreset({
      ...emptyCharacter(),
      name: "Oran 日本語 العربية",
      sheet: emptySheet(),
    });
    await loadLocale("it");
    applyPreferences({ ...defaultPreferences, locale: "it" });
    expect(labels.name).not.toBe("Name");
    expect(labels.sections.map((x) => x)).toHaveLength(2);
    expect(dndPreset(original)).toEqual(original);
    expect(
      spellFromCatalog({
        index: "shield",
        name: "Shield",
        desc: ["Original English source."],
        level: 1,
      }),
    ).toMatchObject({
      name: "Shield",
      description: "Original English source.",
    });
    const untouched = "Oran [[Sigillo]] العربية 日本語";
    expect(tr(untouched)).toBe(untouched);
    expect(translateError("Operation failed. Try again.")).not.toBe(
      "Operation failed. Try again.",
    );
    expect(editorDictionary()).not.toEqual({});
  });
});

it("localizes Arabic plurals and preserves graph URIs and names", async () => {
  await loadLocale("ar");
  applyPreferences({ ...defaultPreferences, locale: "ar" });
  expect(resultCount(0)).toBe("لا نتائج");
  expect(resultCount(1)).toBe("نتيجة واحدة");
  expect(resultCount(2)).toBe("نتيجتان");
  expect(resultCount(3)).toContain("نتائج");
  expect(resultCount(11)).toContain("نتيجة");
  const elements = graphElements({
    nodes: [
      {
        id: "n",
        entityId: "p",
        title: "Oran 日本語 العربية",
        kind: "npc",
        missing: false,
      },
    ],
    edges: [],
    truncated: false,
    totalNodes: 1,
    totalEdges: 0,
  });
  expect(elements[0].data.label).toBe("Oran 日本語 العربية");
  expect(elements[0].data.icon).toMatch(
    /^data:image\/svg\+xml;charset=utf-8,%3Csvg/,
  );
  expect(elements[0].data.icon).not.toContain("\u2068");
});
