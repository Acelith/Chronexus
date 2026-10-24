import { localizeLabels } from "../../i18n/store";
import type { CharacterInput, Stat } from "./api";

export const sheetSections = localizeLabels([
  {
    title: "Identità e background",
    fields: {
      playerName: "Nome giocatore",
      background: "Background",
      alignment: "Allineamento",
      nextLevelXp: "Esperienza al prossimo livello",
    },
  },
  {
    title: "Combattimento e sensi",
    fields: {
      armorClass: "Classe armatura",
      initiative: "Iniziativa",
      proficiencyBonus: "Bonus competenza",
      armor: "Armatura, scudo e protezioni",
      hitDiceTotal: "Dadi vita totali",
      hitDiceUsed: "Dadi vita usati",
      resistances: "Vantaggi, resistenze e immunità",
      vision: "Visione",
      speed: "Velocità e viaggio",
      specialMovement: "Movimento speciale",
      passivePerception: "Percezione passiva",
      passiveInvestigation: "Indagare passivo",
    },
  },
  {
    title: "Storia, aspetto e competenze",
    fields: {
      createdOn: "Data creazione personaggio",
      birth: "Data e luogo di nascita",
      deity: "Divinità e dominio",
      age: "Età",
      gender: "Genere",
      height: "Altezza",
      weight: "Peso corporeo",
      size: "Taglia",
      appearance: "Aspetto e modi di fare",
      personality: "Tratti caratteriali",
      ideals: "Ideali",
      bonds: "Legami",
      flaws: "Difetti",
      allies: "Compagni e alleati",
      enemies: "Nemici",
      proficiencies: "Competenze in armi, armature e strumenti",
      languages: "Linguaggi",
      ancestryTraits: "Tratti di origine",
      classFeatures: "Privilegi di classe",
      feats: "Talenti",
    },
  },
  {
    title: "Denaro, valori e carico",
    fields: {
      platinum: "Monete di platino",
      gold: "Monete d’oro",
      electrum: "Monete di elettro",
      silver: "Monete d’argento",
      copper: "Monete di rame",
      gems: "Gemme e gioielli",
      valuables: "Valori prestati, depositati o ricevuti",
      mount: "Cavalcatura",
      encumbrance: "Carico e ingombro",
    },
  },
  {
    title: "Magia",
    fields: {
      castingClass: "Classe da incantatore",
      castingAbility: "Caratteristica da incantatore",
      spellSaveDc: "CD tiro salvezza incantesimi",
      spellAttackBonus: "Bonus attacco incantesimi",
      spellCount: "Numero incantesimi preparati o conosciuti",
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
  none: "Nessuna",
  proficient: "Competenza",
  expert: "Maestria",
} as const);
const abilities = [
  "Forza",
  "Destrezza",
  "Costituzione",
  "Intelligenza",
  "Saggezza",
  "Carisma",
];
const skills = [
  "Atletica",
  "Acrobazia",
  "Furtività",
  "Rapidità di mano",
  "Arcano",
  "Indagare",
  "Natura",
  "Religione",
  "Storia",
  "Addestrare animali",
  "Intuizione",
  "Medicina",
  "Percepire",
  "Sopravvivenza",
  "Intimidire",
  "Inganno",
  "Intrattenere",
  "Persuasione",
];
export function dndPreset(data: CharacterInput): CharacterInput {
  const templates: Array<[string, Stat["group"]]> = [
    ...abilities.map((name): [string, "ability"] => [name, "ability"]),
    ...abilities.map((name): [string, "save"] => [`TS ${name}`, "save"]),
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
