import { tr } from "../../i18n/store";
import type { CharacterInput } from "./api";
export const fateAttribution =
  "Based on Fate Core System and Fate Accelerated Edition, Evil Hat Productions, LLC. Authors: Leonard Balsera, Brian Engard, Jeremy Keller, Ryan Macklin, Mike Olson, Clark Valentine, Amanda Valentine, Fred Hicks, Rob Donoghue. CC BY 3.0 Unported. Adapted as editable manual fields; no endorsement.";
export function presetFields(id: string): string[] {
  const common = [
    tr("High concept"),
    tr("Trouble"),
    tr("Aspects"),
    tr("Stunts"),
    tr("Refresh"),
    tr("Consequences"),
  ];
  if (id === "fate-core")
    return [
      ...common,
      tr("Skills"),
      tr("Physical stress"),
      tr("Mental stress"),
    ];
  if (id === "fate-accelerated")
    return [
      ...common,
      tr("Careful"),
      tr("Clever"),
      tr("Flashy"),
      tr("Forceful"),
      tr("Quick"),
      tr("Sneaky"),
      tr("Stress"),
    ];
  return [];
}
/** Explicit additive import; existing manual values and stable IDs always win. */
export function applyPreset(data: CharacterInput, id: string): CharacterInput {
  const labels = presetFields(id).filter(
    (label) => !data.stats.some((s) => s.label === label),
  );
  if (data.stats.length + labels.length > 100)
    throw new Error(tr("Too many statistics for this preset."));
  return {
    ...data,
    systemId: id,
    stats: [
      ...data.stats,
      ...labels.map((label) => ({
        id: crypto.randomUUID(),
        label,
        value: "",
        group: "other" as const,
      })),
    ],
  };
}
