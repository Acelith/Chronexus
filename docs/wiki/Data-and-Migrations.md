# Data and migrations

- **Location:** the OS app-data folder for the legacy identifier `it.nodex.desktop`
  (kept so existing archives open). Before the first restore the database is
  `nodex.sqlite3` in that folder; afterwards `active-profile.json` selects
  `profiles/<UUID>/`. Never move the database alone.
- **Migrations:** `src-tauri/migrations/NNN_name.sql`, applied once, in a transaction. A
  migration must never destroy data without a recovery path. Bump the schema only with a
  migration and update backup validation.
- **Keys:** UUIDs everywhere; titles are data, never keys.
- **Revisions:** documents carry a revision; a save based on an old revision is refused
  ("changed elsewhere").
- **Backups (`.nodex`):** ZIP with a v1 manifest and a SHA-256 per file, a SQLite snapshot,
  managed attachments and imported sources. Restores verify everything, write a safety
  copy first and switch to a new profile generation. Older schemas restore and migrate in
  the copy.
- **Debug profiles:** debug builds honour `NODEX_DEV_DATA_DIR` and
  `NODEX_DEV_DOCUMENTS_DIR` (absolute, new folders). Never point them at personal data.
- **Outside the archive:** interface and wiki preferences (JSON next to the profiles), the
  sharing session (`sync-account.json`), AI weights and runtime. None enter Git.

Details: `docs/DECISIONS.md`, `docs/STATUS.md`, `src-tauri/src/backup.rs`.
