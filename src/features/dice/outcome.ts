import type { Roll } from "./api";
export type DragonOutcome = "ordinary" | "celebration" | "threat";
/** Presentation only: persisted values and RNG are never changed. */
export function dragonOutcome(roll: Roll): DragonOutcome {
  if (roll.groups.length !== 1) return "ordinary";
  const group = roll.groups[0];
  if (group.quantity !== 1 || group.values.length !== 1) return "ordinary";
  const value = group.values[0];
  if (value < 1 || value > group.sides) return "ordinary";
  if (value === (group.sides === 100 ? 1 : group.sides)) return "celebration";
  if (value === (group.sides === 100 ? 100 : 1)) return "threat";
  return "ordinary";
}
