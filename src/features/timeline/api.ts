import { command } from "../journal/api";
export interface Month {
  name: string;
  days: number;
}
export interface Calendar {
  months: Month[];
  weekdays: string[];
  eras: string[];
}
export interface EntryInput {
  sourceKind: "session" | "page" | "clue";
  sourceId: string;
  era: string;
  year: number | null;
  month: number | null;
  day: number | null;
  precision: "exact" | "approximate" | "unknown";
  note: string;
}
export interface Entry {
  id: string;
  campaignId: string;
  input: EntryInput;
  revision: number;
}
export const timelineApi = {
  calendar: (campaignId: string) =>
    command<Calendar | null>("get_world_calendar", { campaignId }),
  saveCalendar: (campaignId: string, calendar: Calendar) =>
    command<Calendar>("save_world_calendar", { campaignId, calendar }),
  list: (campaignId: string) =>
    command<Entry[]>("list_timeline", { campaignId }),
  save: (campaignId: string, input: EntryInput, entry?: Entry) =>
    command<Entry>("save_timeline_entry", {
      campaignId,
      input,
      id: entry?.id ?? null,
      revision: entry?.revision ?? null,
    }),
  remove: (campaignId: string, entry: Entry) =>
    command<void>("delete_timeline_entry", {
      campaignId,
      id: entry.id,
      revision: entry.revision,
    }),
};
