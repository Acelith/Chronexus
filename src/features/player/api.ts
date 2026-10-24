import { localizeLabels } from "../../i18n/store";
import { command } from "../journal/api";
import { emptySheet, type SheetDetails } from "./sheet";
export type PlayerView = "character" | "inventory" | "abilities";
export const statGroups = localizeLabels({
  ability: "Caratteristica",
  skill: "Abilità",
  save: "Tiro",
  defense: "Difesa",
  movement: "Movimento",
  other: "Altro",
} as const);
export interface Stat {
  modifier?: string;
  training?: "none" | "proficient" | "expert";
  id: string;
  label: string;
  value: string;
  group: keyof typeof statGroups;
}
export interface Resource {
  id: string;
  label: string;
  kind: "resource" | "slot";
  current: number;
  maximum: number;
}
export interface CharacterInput {
  sheet: SheetDetails;
  name: string;
  systemId: string;
  ancestry: string;
  vocation: string;
  level: number | null;
  experience: number | null;
  hpCurrent: number;
  hpMaximum: number;
  hpTemporary: number;
  stats: Stat[];
  resources: Resource[];
  conditions: string;
  notes: string;
}
export interface Character {
  id: string;
  campaignId: string;
  data: CharacterInput;
  revision: number;
}
export interface ItemDetails {
  location?: string;
  kind: "item";
  name: string;
  quantity: number;
  category: string;
  description: string;
  weight: number | null;
  value: string;
  equipped: boolean;
  consumable: boolean;
  notes: string;
}
export interface AbilityDetails {
  catalogSource?: { path: string; name: string } | null;
  ritual?: boolean;
  concentration?: boolean;
  kind: "spell" | "ability";
  name: string;
  systemId: string;
  rank: string;
  school: string;
  castingTime: string;
  duration: string;
  range: string;
  components: string;
  known: boolean;
  prepared: boolean;
  description: string;
  notes: string;
}
export type AssetDetails = ItemDetails | AbilityDetails;
export interface AssetLinks {
  pageId: string | null;
  sourceSessionId: string | null;
  sourceBlockId: string | null;
  npcId: string | null;
  placeId: string | null;
  questId: string | null;
  provenanceNotes: string;
}
export interface AssetInput {
  details: AssetDetails;
  links: AssetLinks;
}
export interface Asset {
  id: string;
  campaignId: string;
  characterId: string;
  input: AssetInput;
  revision: number;
  sourceAvailable: boolean;
}
export const emptyCharacter = (): CharacterInput => ({
  sheet: emptySheet(),
  name: "",
  systemId: "generic",
  ancestry: "",
  vocation: "",
  level: null,
  experience: null,
  hpCurrent: 0,
  hpMaximum: 0,
  hpTemporary: 0,
  stats: [],
  resources: [],
  conditions: "",
  notes: "",
});
export const emptyLinks = (): AssetLinks => ({
  pageId: null,
  sourceSessionId: null,
  sourceBlockId: null,
  npcId: null,
  placeId: null,
  questId: null,
  provenanceNotes: "",
});
export function emptyAsset(
  kind: AssetDetails["kind"],
  systemId: string,
): AssetInput {
  return {
    links: emptyLinks(),
    details:
      kind === "item"
        ? {
            kind,
            name: "",
            quantity: 1,
            category: "",
            description: "",
            weight: null,
            value: "",
            equipped: false,
            consumable: false,
            notes: "",
          }
        : {
            kind,
            name: "",
            systemId,
            rank: "",
            school: "",
            castingTime: "",
            duration: "",
            range: "",
            components: "",
            known: false,
            prepared: false,
            description: "",
            notes: "",
          },
  };
}
export const playerApi = {
  character: (campaignId: string) =>
    command<Character | null>("get_character", { campaignId }),
  saveCharacter: (
    campaignId: string,
    initial: Character | null,
    input: CharacterInput,
  ) =>
    command<Character>("save_character", {
      campaignId,
      id: initial?.id ?? null,
      revision: initial?.revision ?? null,
      input,
    }),
  counter: (
    campaignId: string,
    character: Character,
    target: string,
    delta: number,
  ) =>
    command<Character>("change_character_counter", {
      campaignId,
      id: character.id,
      revision: character.revision,
      target,
      delta,
    }),
  assets: (campaignId: string, characterId: string) =>
    command<Asset[]>("list_player_assets", { campaignId, characterId }),
  saveAsset: (
    campaignId: string,
    characterId: string,
    initial: Asset | null,
    input: AssetInput,
  ) =>
    command<Asset>("save_player_asset", {
      campaignId,
      characterId,
      id: initial?.id ?? null,
      revision: initial?.revision ?? null,
      input,
    }),
  deleteAsset: (asset: Asset) =>
    command<void>("delete_player_asset", {
      campaignId: asset.campaignId,
      characterId: asset.characterId,
      id: asset.id,
      revision: asset.revision,
    }),
};
