import { describe, expect, test } from "vitest";
import { SIDES, type Roll, type Sides } from "./api";
import { dragonOutcome } from "./outcome";
function roll(sides: Sides, value: number, quantity = 1): Roll {
  return {
    id: "saved",
    campaignId: "campaign",
    createdAt: "2026-10-24T00:00:00Z",
    groups: [
      {
        sides,
        quantity,
        values: Array.from({ length: quantity }, () => value),
        subtotal: value * quantity,
      },
    ],
    total: value * quantity,
  };
}
describe("esiti dei draghi: solo presentazione", () => {
  test.each(SIDES)("d%i migliore, peggiore e intermedio", (sides) => {
    expect(dragonOutcome(roll(sides, sides === 100 ? 1 : sides))).toBe(
      "celebration",
    );
    expect(dragonOutcome(roll(sides, sides === 100 ? 100 : 1))).toBe("threat");
    expect(dragonOutcome(roll(sides, Math.floor(sides / 2)))).toBe("ordinary");
  });
  test("non attiva per più dadi, misti o dati incoerenti e non modifica il tiro", () => {
    const one = roll(20, 20),
      before = JSON.stringify(one);
    dragonOutcome(one);
    expect(JSON.stringify(one)).toBe(before);
    expect(dragonOutcome(roll(6, 6, 2))).toBe("ordinary");
    expect(
      dragonOutcome({
        ...one,
        groups: [...one.groups, ...roll(100, 1).groups],
      }),
    ).toBe("ordinary");
    expect(
      dragonOutcome({ ...one, groups: [{ ...one.groups[0], values: [] }] }),
    ).toBe("ordinary");
  });
});
