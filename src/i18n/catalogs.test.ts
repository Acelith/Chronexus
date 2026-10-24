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
import italian from "./catalogs/it.json";
import { dndPreset, emptySheet } from "../features/player/sheet";
import { emptyCharacter } from "../features/player/api";
import { spellFromCatalog } from "../features/player/catalog";
import { editorDictionary } from "./editorLocale";
afterEach(() => applyPreferences(defaultPreferences));
describe("cataloghi locali", () => {
  it.each(locales.filter((l) => !["it", "tlh", "art-x-rihan"].includes(l.id)))(
    "$id: completo e con parametri integri",
    async ({ id }) => {
      await loadLocale(id);
      const catalog = catalogFor(id);
      expect(translationCoverage(id).translated).toBe(
        Object.keys(italian).length,
      );
      for (const [key, source] of Object.entries(italian)) {
        expect(
          (catalog[key].match(/\{\d+\}/g) ?? []).sort(),
          `${id} ${source}`,
        ).toEqual((source.match(/\{\d+\}/g) ?? []).sort());
      }
    },
  );
  it("aggiorna etichette, funzioni e array senza tradurre token e dati salvati", async () => {
    const labels = localizeLabels({
      name: "Nome",
      sections: ["Personaggio", "Inventario"],
    });
    const original = dndPreset({
      ...emptyCharacter(),
      name: "Oran 日本語 العربية",
      sheet: emptySheet(),
    });
    await loadLocale("en");
    applyPreferences({ ...defaultPreferences, locale: "en" });
    expect(labels.name).not.toBe("Nome");
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
    expect(translateError("Operazione non riuscita. Riprova.")).not.toBe(
      "Operazione non riuscita. Riprova.",
    );
    expect(editorDictionary()).not.toEqual({});
  });
  it.each(["tlh", "art-x-rihan"] as const)(
    "%s dichiara copertura parziale e ripiega in italiano",
    async (locale) => {
      await loadLocale(locale);
      applyPreferences({ ...defaultPreferences, locale });
      expect(translationCoverage().translated).toBeGreaterThan(0);
      expect(translationCoverage().translated).toBeLessThan(
        translationCoverage().total,
      );
      expect(tr("Apertura archivio…")).toBe("Apertura archivio…");
    },
  );
});

it("localizza i plurali arabi e preserva URI e nomi del grafo", async () => {
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
