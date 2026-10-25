import { command } from "../journal/api";

export interface ArchiveCounts {
  campaigns: number;
  sessions: number;
  pages: number;
  mentions: number;
  relationships: number;
  attachments: number;
  characters?: number;
  items?: number;
  spells?: number;
  diceRolls?: number;
}
export interface BackupPreview {
  token: string;
  fileName: string;
  manifest: {
    format_version: number;
    app_version: string;
    created_at: string;
    schema_version: number;
    scope: "all_campaigns";
    counts: ArchiveCounts;
  };
}
export interface BackupReceipt {
  path: string;
  counts: ArchiveCounts;
}
export interface RestoreReceipt {
  safetyPath: string;
  counts: ArchiveCounts;
  warning: string | null;
}
export const backupApi = {
  create: () => command<BackupReceipt | null>("create_backup"),
  inspect: () => command<BackupPreview | null>("inspect_backup"),
  restore: (token: string) =>
    command<RestoreReceipt>("restore_backup", { token }),
  cancel: () => command<void>("cancel_restore"),
};

export type BackupFrequency = "daily" | "weekly" | "hours";
export interface BackupSchedule {
  enabled: boolean;
  frequency: BackupFrequency;
  hours: number;
  keep: number;
}
export interface BackupPreferences extends BackupSchedule {
  version: number;
  destination: string | null;
}
export interface BackupFolderStatus {
  preferences: BackupPreferences;
  documentsFolder: string | null;
  periodicFolder: string | null;
  updatesFolder: string | null;
  cloudSynced: boolean;
  lastSuccess: string | null;
  lastAttempt: string | null;
  lastError: string | null;
  nextDue: string | null;
  dueNow: boolean;
  registered: number;
}
export type BackupLocation = "periodic" | "updates" | "legacy" | "custom";
export interface ListedBackup {
  location: BackupLocation;
  name: string;
  kind: "periodic" | "update" | "other";
  size: number;
  modified: string | null;
  registered: boolean;
}
export interface BackupListing {
  folders: {
    location: BackupLocation;
    path: string;
    exists: boolean;
    error: string | null;
  }[];
  backups: ListedBackup[];
  truncated: boolean;
}
export interface PeriodicOutcome {
  path: string | null;
  error: string | null;
  removed: number;
  keptUnverified: number;
}
export interface PeriodicTick {
  ran: boolean;
  outcome: PeriodicOutcome | null;
  waiting: string | null;
}
/** Fired after a periodic backup so open panels refresh their status. */
export const BACKUP_STATUS_EVENT = "chronexus:backup-status";
export const backupFolderApi = {
  status: () => command<BackupFolderStatus>("get_backup_settings"),
  saveSchedule: (schedule: BackupSchedule) =>
    command<BackupFolderStatus>("save_backup_schedule", { schedule }),
  chooseDestination: () =>
    command<BackupFolderStatus | null>("choose_backup_destination"),
  resetDestination: () =>
    command<BackupFolderStatus>("reset_backup_destination"),
  list: () => command<BackupListing>("list_backup_files"),
  inspect: (location: BackupLocation, name: string) =>
    command<BackupPreview>("inspect_listed_backup", { location, name }),
  copyLegacy: (name: string) =>
    command<string>("copy_legacy_update_backup", { name }),
  open: (location: BackupLocation) =>
    command<string>("open_backup_folder", { location }),
  tick: () => command<PeriodicTick>("periodic_backup_tick"),
  runNow: () => command<PeriodicOutcome>("run_periodic_backup_now"),
};
