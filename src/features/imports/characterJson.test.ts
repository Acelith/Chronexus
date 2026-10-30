import { expect, it } from "vitest";
import { parseCharacterJson } from "./characterJson";

it("maps only documented explicit character fields without inventing formulas", () => {
  const result = parseCharacterJson({
    name: "Arin",
    player: { name: "Player" },
    race: { name: "Elf" },
    classes: [{ name: "Ranger", level: 2 }],
    hit_points: { max: 18, current: 12, temporary: 0 },
    ability_scores: { str: 10, dex: 15, con: 12, int: 11, wis: 13, cha: 8 },
    armor_class: { value: 14 },
    xp: 300,
    spells: [{ name: "Unknown source" }],
  });
  expect(result.name).toBe("Arin");
  expect(result.systemId).toBe("dnd5e-2014");
  expect(result.hpCurrent).toBe(12);
  expect(result.stats.find((s) => s.label === "DEX")?.value).toBe("15");
  expect(result.sheet.fields.armorClass).toBe("14");
  expect(result.resources).toEqual([]);
});
it("rejects unrelated JSON and impossible hit point values", () => {
  expect(() => parseCharacterJson({ name: "Arin" })).toThrow();
  expect(() =>
    parseCharacterJson({
      name: "Arin",
      player: { name: "P" },
      race: { name: "Elf" },
      hit_points: { max: 3, current: 4 },
      ability_scores: { str: 10 },
    }),
  ).toThrow();
});
