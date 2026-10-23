import type { CharacterInput, Stat } from "./api";
/** Boundary for future local adapters. Derived values never overwrite manual stats.
 * No rest, slot-consumption or commercial rules are implemented in M5. */
export interface RulesetAdapter {
  readonly id: string;
  readonly label: string;
  readonly mode: "manual" | "derived";
  derive(
    character: Readonly<CharacterInput>,
  ): ReadonlyArray<Pick<Stat, "label" | "value" | "group">>;
}
export const manualAdapter: RulesetAdapter = {
  id: "generic",
  label: "Valori manuali",
  mode: "manual",
  derive: () => [],
};
const adapters: Readonly<Record<string, RulesetAdapter>> = {
  generic: manualAdapter,
};
export function adapterFor(systemId: string): RulesetAdapter {
  return Object.hasOwn(adapters, systemId) ? adapters[systemId] : manualAdapter;
}
