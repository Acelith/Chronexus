import { expect, test } from "vitest";
import { emptyQuantities, selections, sceneDice, mergeRolls } from "./model";
import { SIDES, type Roll } from "./api";
test("valid mixed composition and explicit limits", () => {
  const q = emptyQuantities();
  q[6] = "3";
  q[20] = "2";
  q[100] = "1";
  expect(selections(q)).toEqual([
    { sides: 6, quantity: 3 },
    { sides: 20, quantity: 2 },
    { sides: 100, quantity: 1 },
  ]);
  expect(() => selections(emptyQuantities())).toThrow("at least one die");
  for (const value of ["-1", "1.5", "51", "NaN"]) {
    expect(() => selections({ ...emptyQuantities(), 6: value })).toThrow(
      "whole quantities",
    );
  }
  expect(() =>
    selections({ ...emptyQuantities(), 4: "50", 6: "50", 100: "1" }),
  ).toThrow("100");
  expect(selections({ ...emptyQuantities(), 6: "50", 100: "50" })).toHaveLength(
    2,
  );
});
test("bounded scene represents every type without inventing or changing results", () => {
  const roll: Roll = {
    id: "a",
    campaignId: "c",
    createdAt: "2026-10-24T15:00:00Z",
    groups: SIDES.map((sides) => ({
      sides,
      quantity: 10,
      values: Array(10).fill(sides),
      subtotal: sides * 10,
    })),
    total: 1600,
  };
  const original = JSON.stringify(roll);
  const shown = sceneDice(roll);
  expect(shown).toHaveLength(14);
  expect(new Set(shown.map((d) => d.sides))).toEqual(new Set(SIDES));
  expect(shown.every((d) => d.value === d.sides)).toBe(true);
  expect(new Set(shown.map((d) => d.key)).size).toBe(14);
  expect(JSON.stringify(roll)).toBe(original);
});
test("late history responses do not remove a newly saved roll", () => {
  const a: Roll = {
    id: "a",
    campaignId: "c",
    createdAt: "2026-10-24T15:00:00Z",
    groups: [],
    total: 1,
  };
  const b = { ...a, id: "b", createdAt: "2026-10-24T16:00:00Z", total: 2 };
  expect(mergeRolls([b], [a])).toEqual([b, a]);
  expect(mergeRolls([b, a], [a])).toEqual([b, a]);
});
