# Backups and restore

Everything Chronexus knows lives in one local archive. A **`.nodex` backup** is a complete,
verified copy of it: every campaign, character, document, link, relationship, image and
setting that belongs to the archive.

## Manual backup

1. **Backup and restore → Create backup.** Chronexus first waits for pending saves.
2. Choose a **new** file name ending in `.nodex` (an existing file is never overwritten).
3. Wait for **Backup created and verified**: every file inside is checked with SHA-256.

## Periodic backups

**App settings → Backup** (off until you turn it on): daily, weekly or every N hours,
only while Chronexus is open and idle, into `Documents/Chronexus/Backup periodici` or a
folder you choose. You decide how many copies to keep; Chronexus deletes only periodic
copies it created itself.

## Restore

1. **Select backup** and check the preview (date, counts).
2. **Replace archive** replaces *all* current campaigns — it is not a merge.
3. Before replacing, Chronexus saves a safety copy of the current data and shows its path.
   To go back, restore that copy. If the safety copy fails, nothing is replaced.

## Export

**Export campaign** creates a readable ZIP (Markdown, full JSON, images, checksums) for
reading or archiving elsewhere. It is not a restore format — use `.nodex` for that.

## Good to know

- Backups are **not encrypted**. Keep them somewhere private, especially in synced cloud
  folders.
- Limits: 32 GiB per backup; Chronexus checks free disk space first.
- Before every update Chronexus makes a verified backup automatically (see
  [Updates](Updates.md)).
