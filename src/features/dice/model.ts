import { SIDES, type Selection, type Roll, type Sides } from "./api";
import { diceText as t } from "./strings";
export type Quantities = Record<Sides, string>;
export const emptyQuantities = (): Quantities => ({
  4: "0",
  6: "0",
  8: "0",
  10: "0",
  12: "0",
  20: "0",
  100: "0",
});
export function selections(quantities: Quantities): Selection[] {
  const result: Selection[] = [];
  for (const sides of SIDES) {
    const raw = quantities[sides],
      quantity = raw.trim() === "" ? 0 : Number(raw);
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > 50)
      throw Error(t.quantityError);
    if (quantity) result.push({ sides, quantity });
  }
  const total = result.reduce((sum, g) => sum + g.quantity, 0);
  if (total > 100) throw Error(t.totalError);
  if (!total) throw Error(t.emptyError);
  return result;
}
export const composition = (groups: Selection[]) =>
  groups.map((g) => `${g.quantity}d${g.sides}`).join(" + ");
export function mergeRolls(previous: Roll[], incoming: Roll[]): Roll[] {
  const map = new Map(previous.map((r) => [r.id, r]));
  incoming.forEach((r) => map.set(r.id, r));
  return [...map.values()].sort(
    (a, b) =>
      b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
  );
}
export function sceneDice(
  roll: Roll,
  limit = 14,
): { sides: Sides; value: number; key: string }[] {
  const result: { sides: Sides; value: number; key: string }[] = [];
  const count = Math.max(...roll.groups.map((g) => g.quantity));
  for (let index = 0; index < count; index++)
    for (const group of roll.groups)
      if (index < group.values.length && result.length < limit)
        result.push({
          sides: group.sides,
          value: group.values[index],
          key: `${group.sides}-${index}`,
        });
  return result;
}

// A die has immutable identity within its persisted roll: type plus ordinal.
export function valuesFor(
  rollId: string,
  group: { sides: number; values: number[] },
) {
  return group.values.map((value, ordinal) => ({
    id: `${rollId}:${group.sides}:${ordinal}`,
    value,
  }));
}
