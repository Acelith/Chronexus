import { expect, test } from "vitest";
import { spellFromWikidot, type Entry } from "./wikidot";
const base: Entry = {
  page: "spell:test-ward",
  url: "https://dnd5e.wikidot.com/spell:test-ward",
  category: "spells",
  title: "Test Ward",
  source: "Unearthed Arcana 99",
  origin: "ua",
  edition: "5e-2014",
  license: "x",
  blocks: [{ kind: "paragraph", text: "Body" }],
  spell: {
    level: "2",
    school: "Abjuration",
    levelLine: "2nd-level abjuration (ritual)",
    castingTime: "1 action",
    range: "Self",
    components: "V",
    duration: "Concentration, up to 1 hour",
    higherLevels: "More wards.",
    classes: "Cleric",
    description: "Body",
    ritual: true,
    concentration: true,
  },
  missing: [],
  truncated: false,
};
test("maps only real fields and keeps the Wikidot source", () => {
  const spell = spellFromWikidot(base);
  expect(spell).toMatchObject({
    kind: "spell",
    systemId: "dnd5e-2014",
    name: "Test Ward",
    rank: "2",
    ritual: true,
    concentration: true,
    known: false,
    prepared: false,
    catalogSource: { path: "spell:test-ward", provider: "wikidot" },
  });
  expect(spell.description).toContain("More wards.");
  const partial = spellFromWikidot({
    ...base,
    spell: { ...base.spell!, castingTime: null, school: null },
    missing: ["castingTime", "school"],
  });
  expect(partial.castingTime).toBe("");
  expect(partial.school).toBe("");
});
test("refuses non-spell pages and oversized fields", () => {
  expect(() =>
    spellFromWikidot({ ...base, category: "feats", spell: null }),
  ).toThrow();
  expect(() =>
    spellFromWikidot({
      ...base,
      spell: { ...base.spell!, range: "x".repeat(201) },
    }),
  ).toThrow("too long");
});
