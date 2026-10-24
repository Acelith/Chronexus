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
