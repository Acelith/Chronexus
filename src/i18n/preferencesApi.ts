import { invoke, isTauri } from "@tauri-apps/api/core";
import {
  defaultPreferences,
  validPreferences,
  type Preferences,
} from "./locales";
export const preferencesApi = {
  read: async (): Promise<Preferences> => {
    if (!isTauri()) return { ...defaultPreferences };
    const value = await invoke<unknown>("get_interface_preferences");
    if (!validPreferences(value))
      throw Error("Unsupported language preferences.");
    return value;
  },
  save: async (preferences: Preferences): Promise<Preferences> => {
    if (!validPreferences(preferences))
      throw Error("Invalid language preferences.");
    if (!isTauri())
      throw Error("Start Chronexus as a desktop app to save preferences.");
    return invoke<Preferences>("save_interface_preferences", { preferences });
  },
};
