import { command } from "../journal/api";
export const SIDES = [4, 6, 8, 10, 12, 20, 100] as const;
export type Sides = (typeof SIDES)[number];
export interface Selection {
  sides: Sides;
  quantity: number;
}
export interface DiceGroup extends Selection {
  values: number[];
  subtotal: number;
}
export interface Roll {
  id: string;
  campaignId: string;
  createdAt: string;
  groups: DiceGroup[];
  total: number;
}
export interface Cursor {
  createdAt: string;
  id: string;
}
export interface History {
  rolls: Roll[];
  nextCursor: Cursor | null;
}
export const diceApi = {
  roll: (campaignId: string, requestId: string, selections: Selection[]) =>
    command<Roll>("roll_dice", { campaignId, requestId, selections }),
  history: (campaignId: string, before: Cursor | null = null) =>
    command<History>("list_dice_rolls", { campaignId, before }),
};
