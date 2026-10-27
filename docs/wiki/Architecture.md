# Architecture

```
React UI (src/features/*)  ──invoke──▶  Tauri commands (src-tauri/src/commands)
        ▲   events                             │ validate payloads, narrow API
        │                                      ▼
   status / progress                  Domain modules (journal, knowledge, graph,
                                       player, party, images, search, wiki, sync…)
                                               │ parameterized SQL only
                                               ▼
                                     Store: SQLite (WAL) + managed files
```

## Layers

- **UI** (`src/`): one folder per feature with its `api.ts` (typed wrappers around
  `invoke`), components and tests. No SQL, no file paths from free text.
- **Commands** (`src-tauri/src/commands`): thin, validated entry points registered in
  `lib.rs`. Long work runs off the main thread (`Database::run`, async commands).
- **Domain** (`src-tauri/src/*.rs` and subfolders): rules, validation and SQL. Stable UUIDs
  are the relational keys everywhere, so references survive renames.
- **Store** (`db.rs`, `backup.rs`): the single writer. Versioned transactional migrations,
  profile generations after a restore, verified `.nodex` backups.

## Invariants (from AGENTS.md)

- Offline-first; network only from explicit user actions (plus the updater check).
- A mention and a factual relationship are different edge types; relationships carry
  source and certainty.
- Autosave persists reliably and surfaces failure; revisions refuse stale writes.
- No implicit mutation: no auto-consumption, no inferred facts, no AI-written facts.
- Every UI change passes the [localization gate](Localization-Workflow).

## Optional subsystems

| Subsystem | Folder | Boundary |
| --- | --- | --- |
| Local assistant | `assistant/`, `ai_setup/` | Fixed loopback Ollama, cloud verified off, GPU preflight, citations |
| Rules wiki | `wiki.rs`, `wikidot/`, `wiki_provider.rs`, `catalog.rs` | Allowlisted hosts/paths, bounded caches, inert text |
| Updates | `updates/` | Tauri updater with signature, mandatory backup before install |
| Sharing | `sync/` | Opt-in, HTTPS, per-item scope; see [Sync client](Sync-Client) |
| Automation | `automation/` | Hidden opt-in MCP adapter (`docs/AUTOMATION.md`) |
