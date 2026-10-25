import { localizeLabels } from "../../i18n/store";
import type { CharacterInput, Stat } from "./api";

export const sheetSections = localizeLabels([
  {
    title: "Identity and background",
    fields: {
      playerName: "Player name",
      background: "Background",
      alignment: "Alignment",
      nextLevelXp: "Experience to next level",
    },
  },
  {
    title: "Combat and senses",
    fields: {
      armorClass: "Armor class",
      initiative: "Initiative",
      proficiencyBonus: "Proficiency bonus",
      armor: "Armor, shield and protection",
      hitDiceTotal: "Total hit dice",
      hitDiceUsed: "Hit dice used",
      resistances: "Advantages, resistances and immunities",
      vision: "Vision",
      speed: "Speed and travel",
      specialMovement: "Special movement",
      passivePerception: "Passive Perception",
      passiveInvestigation: "Passive Investigation",
    },
  },
  {
    title: "History, appearance and proficiencies",
    fields: {
      createdOn: "Character creation date",
      birth: "Date and place of birth",
      deity: "Deity and domain",
      age: "Age",
      gender: "Gender",
      height: "Height",
      weight: "Body weight",
      size: "Size",
      appearance: "Appearance and mannerisms",
      personality: "Personality traits",
      ideals: "Ideals",
      bonds: "Bonds",
      flaws: "Flaws",
      allies: "Companions and allies",
      enemies: "Enemies",
      proficiencies: "Weapon, armor and tool proficiencies",
      languages: "Languages",
      ancestryTraits: "Origin traits",
      classFeatures: "Class features",
      feats: "Feats",
    },
  },
  {
    title: "Money, valuables and load",
    fields: {
      platinum: "Platinum pieces",
      gold: "Gold pieces",
      electrum: "Electrum pieces",
      silver: "Silver pieces",
      copper: "Copper pieces",
      gems: "Gems and jewelry",
      valuables: "Valuables lent, deposited or received",
      mount: "Mount",
      encumbrance: "Load and encumbrance",
    },
  },
  {
    title: "Magic",
    fields: {
      castingClass: "Spellcasting class",
      castingAbility: "Spellcasting ability",
      spellSaveDc: "Spell save DC",
      spellAttackBonus: "Spell attack bonus",
      spellCount: "Number of spells prepared or known",
    },
  },
] as const);
type KeysOfUnion<T> = T extends T ? keyof T : never;
export type SheetField = KeysOfUnion<(typeof sheetSections)[number]["fields"]>;
export interface Attack {
  id: string;
  name: string;
  bonus: string;
  damage: string;
  range: string;
  weight: string;
  ammunition: string;
}
export interface SheetDetails {
  fields: Partial<Record<SheetField, string>>;
  inspiration: boolean;
  deathSuccesses: number;
  deathFailures: number;
  attacks: Attack[];
}
export const emptySheet = (): SheetDetails => ({
  fields: {},
  inspiration: false,
  deathSuccesses: 0,
  deathFailures: 0,
  attacks: [],
});
export const trainingLabels = localizeLabels({
  none: "None",
  proficient: "Proficiency",
  expert: "Expertise",
} as const);
const abilities = [
  "Strength",
  "Dexterity",
  "Constitution",
  "Intelligence",
  "Wisdom",
  "Charisma",
];
const skills = [
  "Athletics",
  "Acrobatics",
  "Stealth",
  "Sleight of Hand",
  "Arcana",
  "Investigation",
  "Nature",
  "Religion",
  "History",
  "Animal Handling",
  "Insight",
  "Medicine",
  "Perception",
  "Survival",
  "Intimidation",
  "Deception",
  "Performance",
  "Persuasion",
];
export function dndPreset(data: CharacterInput): CharacterInput {
  const templates: Array<[string, Stat["group"]]> = [
    ...abilities.map((name): [string, "ability"] => [name, "ability"]),
    ...abilities.map((name): [string, "save"] => [`Save ${name}`, "save"]),
    ...skills.map((name): [string, "skill"] => [name, "skill"]),
  ];
  const missing = templates.filter(
    ([label, group]) =>
      !data.stats.some(
        (s) =>
          s.label.toLocaleLowerCase("it") === label.toLocaleLowerCase("it") &&
          s.group === group,
      ),
  );
  return {
    ...data,
    systemId: data.systemId === "generic" ? "dnd5e-2014" : data.systemId,
    stats: [
      ...data.stats,
      ...missing.slice(0, 100 - data.stats.length).map(([label, group]) => ({
        id: crypto.randomUUID(),
        label,
        group,
        value: "",
        modifier: "",
        training: "none" as const,
      })),
    ],
  };
}
