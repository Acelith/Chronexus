import { tr } from "../../i18n/store";
import { emptyCharacter, type CharacterInput } from "../player/api";

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const label = (value: unknown) =>
  typeof value === "string" ? value.trim().slice(0, 200) : "";
const prose = (value: unknown) =>
  typeof value === "string" ? value.slice(0, 16000) : "";
const integer = (value: unknown) =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
export function parseCharacterJson(value: unknown): CharacterInput {
  const source = record(value),
    race = record(source.race),
    hp = record(source.hit_points),
    scores = record(source.ability_scores),
    armor = record(source.armor_class),
    details = record(source.details);
  // BrianWendt/dnd5e_json_schema Character.schema.json v0.1.1 extends
  // Creature.schema.json. This discriminator avoids guessing at arbitrary JSON.
  if (
    !label(source.name) ||
    !label(record(source.player).name) ||
    !label(race.name) ||
    !Object.keys(scores).length ||
    !Object.keys(hp).length
  )
    throw Error(tr("Unsupported character JSON format."));
  const result = emptyCharacter();
  result.name = label(source.name);
  result.systemId = "dnd5e-2014";
  result.ancestry = label(race.name);
  const classes = Array.isArray(source.classes)
    ? source.classes.map(record)
    : [];
  result.vocation = classes
    .map((item) => label(item.name))
    .filter(Boolean)
    .join(" / ")
    .slice(0, 200);
  result.level = classes.length === 1 ? integer(classes[0].level) : null;
  result.experience = integer(source.xp);
  result.hpMaximum = integer(hp.max) ?? 0;
  result.hpCurrent = integer(hp.current) ?? result.hpMaximum;
  result.hpTemporary = integer(hp.temporary) ?? 0;
  if (result.hpCurrent > result.hpMaximum)
    throw Error(tr("Current hit points exceed maximum in the source JSON."));
  result.stats = (["str", "dex", "con", "int", "wis", "cha"] as const).flatMap(
    (ability) =>
      integer(scores[ability]) === null
        ? []
        : [
            {
              id: crypto.randomUUID(),
              label: ability.toUpperCase(),
              value: String(scores[ability]),
              group: "ability" as const,
            },
          ],
  );
  result.sheet.fields.playerName = label(record(source.player).name);
  result.sheet.fields.background = label(record(source.background).name);
  result.sheet.fields.alignment = label(source.alignment);
  result.sheet.fields.armorClass = integer(armor.value)?.toString() ?? "";
  result.sheet.fields.age = integer(details.age)?.toString() ?? "";
  result.sheet.fields.height = label(details.height);
  result.sheet.fields.weight = integer(details.weight)?.toString() ?? "";
  result.sheet.fields.personality = label(details.personality);
  result.sheet.fields.ideals = label(details.ideal);
  result.sheet.fields.bonds = label(details.bond);
  result.sheet.fields.flaws = label(details.flaw);
  result.sheet.fields.appearance = label(details.physical);
  result.notes = prose(details.backstory);
  return result;
}
