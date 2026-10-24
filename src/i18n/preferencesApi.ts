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
      throw Error("Preferenze linguistiche non supportate.");
    return value;
  },
  save: async (preferences: Preferences): Promise<Preferences> => {
    if (!validPreferences(preferences))
      throw Error("Preferenze linguistiche non valide.");
    if (!isTauri())
      throw Error(
        "Avvia Chronexus come applicazione desktop per salvare le preferenze.",
      );
    return invoke<Preferences>("save_interface_preferences", { preferences });
  },
};
