# M26 — English source with stable legacy identities

English becomes the source, default and fallback for new profiles, public docs,
metadata and agent instructions. Explicit saved locales survive; pre-language
archives retain Italian through a one-time preference outside restore generations.
English and legacy Italian catalogs share stable message IDs. Only controlled
interface text and diagnostics use translation lookup; campaign text and archived
answers remain canonical data. New catalog entries may fall back to English in
other locales, and coverage reports that honestly.

Legacy app IDs, schema 018, backup paths and names remain stable. The assistant
receives an allowlisted locale rather than interpolating an arbitrary language
request. English is the fallback for missing/unsupported values. Training wrappers
are English while original excerpts remain verbatim. No inference, training,
download or campaign activation is introduced at startup.

Vitest excludes generated worktrees/installers/targets so current-source counts
cannot include old checkout copies. Public screenshots use English synthetic
fixtures only; the herald image is explicitly documented as a UI illustration.

# M18 — Shared policy, mixed inference, and non-destructive migration

`src/ai-models.json` is compiled from Rust/TypeScript and read by local tools:
identities, approved weights, and parameters do not diverge between assistant and translator.
Official Qwen3.8-27B Q4_K_M requires more than 16 GB: on the RTX 4080 SUPER
48 GPU/batch layer 256/context 8192 pass qualification; the configuration
99 layer causes memory pressure and latency and is excluded. Gemma remains more
rapid and secondary, never automatic fallback. Both use only text.
018 schema disables withdrawn Qwen choices while preserving their name/digest/history;
archive validators accept historical identities, the live policy rejects them.
The same applies to v1 translations: preserved in backup, never attributed to the new
model. QLoRA continues only on Gemma because the 27B is not qualified for training.

# Decisions

## Chronexus — compatible renaming

Public name, window title, and packages become Chronexus/chronexus.
`it.nodex.desktop`, `nodex.sqlite3`, internal bundle path `.nodex`, and
debug variables `NODEX_*` remain stable: changing these identifiers
would separate users from existing data. No migration is necessary for the
name change only. M4 backups are still readable.

## M5 — generic sheet and playable data

- Additive 005 migration: `characters` (one character per campaign in this
  phase) and `player_assets` (items, spells, and abilities discriminated by type).
  UUIDs and revisions protect against obsolete updates and deletions; composite FKs
  prevent references to characters, pages, and sessions of other campaigns.
- The typed JSON sheet preserves identities, free system, PF, configurable
  statistics, conditions, and resources/slots with stable IDs. Statistics values
  are manual; integer counters from 0 to explicit maximum, no formula or rest.
- Assets preserve typed details in JSON and provenance in columns with FKs,
  without synchronized copies of the same information. Zero quantity does not delete
  the item; prepared/known are independent markers, without implicit consumption.
- Session/block provenance, PNG, location, and mission; optional link to a
  Codex page. A removed block is flagged but the reference remains; a subsequent
  change of Codex type does not invalidate the historical role. No factual arc is
  inferred from inventory or provenance.
- Shared migration list from DB opening and backup validation. v1 backups
  now include character/item/ability counts when not null, with default
  zero for previous manifests. 1–5 DBs readable; 5 schema requires Chronexus M5
  or later for recovery. M5 validation performed before publishing backups.
- Three React views loaded on demand: Character, Inventory, Abilities.
  Explicit modules with guards, counters, and markers with immediate saving,
  item detail, and contextual return from the Codex or from the diary.
- Local `RulesetAdapter` contract with pure derivation separated from manual
  values. Only the generic adapter is available; unknown identifiers
  have the same manual behavior. No commercial regulation chosen.
  Details in `docs/RULESETS.md`. No new dependencies.
- Existing palette #101623/#161c28/#465268, text #e7e8ed/#a9b4c7 and brass
  #d7b978; Georgia for titles, Segoe UI for data/controls. Readable sheet,
  fast counters and details with provenance prioritized over decorations.
  Verified screenshots at 1200 px, three views without overflow at 760 px.
- Shared block preview helper with the graph in `knowledge/blocks.ts`,
  without inverse dependencies on the canvas. frontend-design and
  vercel-react-best-practices applied to hierarchy, lazy loading, and
  derived state. Desktop QA with Playwright, Tauri bridge, and real SQLite.

## M3 — Declared relations and graph

- 004 additive migration: directional relations separated from mentions,
  explicit certainty, evidence/notes, and optional session/page/block source.
  Optimistic revisions protect against concurrent modification and deletion.
- Nodes include pages, sessions, and missing destinations. A co-mention
  never generates a page→page arc; mentions maintain the actual source.
- Validated campaign boundaries and composite FKs. A removed source block does not
  delete the relation: the source is marked unavailable, evidence preserved.
- View sent to client limited to 150 nodes and 400 arcs, with counts and
  truncation warning; metadata filtered in the backend without loading documents into the graph.
- 1/2 depth on non-directional neighborhood; arrows preserve direction.
  Type/search filters remove nodes and related arcs; certainty concerns only
  declared relations. Session filter uses the source of mentions/relations.
- Cytoscape.js 3.34.4, MIT, with TypeScript types included, loaded only in the
  graph view. No extensions or remote services. [API and style](https://js.cytoscape.org/).
- Deterministic circular initial layout, no animations, movable nodes
  and zoom/fit controls. The layout is a temporary view, not a semantic
  relation or canonical data. Legend, shapes, and text avoid meanings relied
  solely on color; accessible alternative list with the same nodes/arcs.
- Explicit confirmation and current revision to delete a relation; confirmation
  handles Tab/Escape. An open relation form blocks navigation/closing,
  without simulating autosave on an incomplete statement.
- Development CSP allows HTTP/WebSocket only on the local Vite server at
  port 1420 for refresh. Release CSP maintains local Tauri runtime links
  and no access to remote services.
- Reused skills: frontend-design (layout, readability, and screenshot revision),
  vercel-react-best-practices (lazy loading and canvas lifecycle).

## M2 — Pages and explicit mentions

- 003 additive migration: typed Codex pages, aliases, and mentions index.
  M1 sessions and their documents remain intact.
- The JSON document contains inline `pageMention` with `pageId` UUID and `label`
  fallback. The current name resolves to ID; renaming preserves the old
  title as an alias. Aliases can be ambiguous and require explicit choice.
- Document writing and index replacement occur in the same
  transaction. One record per source/block/destination, even for nested blocks.
- Source boundaries are constrained by composite FKs; every existing destination
  is verified by the backend. Missing destinations retain the
  ID in the index for explicit retrieval as a draft, without creating duplicates.
- Only explicit inlines generate mentions. Unresolved `[[...]]` text and simple
  co-occurrences do not generate links or factual relations.
- No new dependencies. React/design skills already read and reused for the UI;
  Rust/SQLite level implemented and verified with standard tools.
- The editor shared between sessions and pages uses the inline custom BlockNote and the
  `[[` menu (no automatic scanning of names in the text). In case of failed creation
  it restores the typed text; navigation/closing also wait for the
  creation in progress. During asynchronous view changes, the document is read-only.
- The mention shows the current title from the campaign Codex, keeping
  the original fallback label in the document. The backlink preview is a
  source excerpt, so it may still report the name used at the time.
- Opening a backlink repositions the cursor and scrolls to the block by ID;
  CSS highlighting does not alter the canonical DOM managed by ProseMirror.
- Reference APIs: [inline custom BlockNote](https://www.blocknotejs.org/docs/features/custom-schemas/custom-inline-content)
  and [suggestion menu](https://www.blocknotejs.org/docs/react/components/suggestion-menus).

## 2026-10-23 — Foundation M0

- Rust possesses a SQLite connection protected by a mutex, opened in the Tauri
  data directory; React communicates via strict commands. No SQL/FS plugin in the frontend.
- SQLite embedded via rusqlite (`bundled`, MIT), for consistent behavior
  without external SQLite installation. Active FKs and lock timeouts of 5 seconds.
- Additive and transactional migrations with `schema_migrations`. No
  destructive automatic downgrade is offered; rollback via previous version and
  snapshot at program close until M4 introduces consistent backups.
- Vite/React/TypeScript; TypeScript 6 because typescript-eslint does not support 7.
  Dependencies fixed in the lockfile. Tauri MIT/Apache-2.0, React/Vite MIT.
- Design: slate #161c28, ink #101623, border #303a4b, text #e7e8ed,
  secondary text #a9b4c7, brass #d7b978. Georgia for titles, Segoe UI/system
  for commands. Archive sidebar on the left, diary in the center; no dummy data.
- Read and applied skills: frontend-design (palette, typography, and structure),
  vercel-react-best-practices (derived state and deferred editor loading).

## 2026-10-23 — Persistence M1

- 002 migration adds campaigns/sessions with UUID, constraints, chronological index
  for number and versioned canonical JSON document. No editable Markdown copy.
- Every session command receives the campaign and verifies its boundaries in the backend.
- Optimistic revisions prevent overwrites from concurrent windows/apps:
  a conflict blocks the save and invites copying the notes.
- Documents limited to 2 MB, 10.000 blocks and depth 12; only paragraphs,
  titles, lists, and quotes. Media and uploads are out of scope.
- DB opening errors return to the frontend: the window remains available
  even with inaccessible directory or newer schema.

## 2026-10-23 — Editor and autosave M1

- BlockNote 0.56 and Mantine 8.3.11: peer React 19 compatible, verification
  `pnpm peers check` without issues. BlockNote MPL-2.0, Mantine MIT.
- Schema reduced to supported text blocks; no uploads, media blocks
  or emoji picker with external resources. Editor loaded only upon opening a session.
- An ordered writer per document, debounce 500 ms and revisions received from
  the backend. The flush also waits for changes arrived during a write.
- Normal navigation and closing wait for the flush; visible error with retry,
  no note change in case of failure. Forced closing is not guaranteed.
- No deletion/archiving button in M1; no need to confirm
  non-existent destructive operations. Archiving and record selection are real.
- `NODEX_DEV_DATA_DIR` only debug allows isolated smoke tests without personal data.
  The Playwright smoke test communicates with real Tauri/Rust/SQLite via WebView2.
- Applied skills: frontend-design (visual review, palette, and hierarchy),
  vercel-react-best-practices (lazy loading and derived state). computer-use reads
  for native QA; window access expired, effective test via local WebView.

## M4 — portable backup and restoration activation

- The `.nodex` bundle v1 saves **all campaigns**: snapshot via backup API
  SQLite, `manifest.json`, SHA-256 of each payload and managed attachments. No
  copy of the open DB. ZIP/Deflate unencrypted; checksum for integrity, not signature.
- Allowed paths: `data/nodex.sqlite3` and
  `attachments/<campaign UUID>/<file UUID>[.<lowercase extension>]`. No
  ZIP directory, duplicate, symbolic link, or extra files. Limits: 9998 attachments,
  256 MiB/file, 512 MiB total/ZIP and 2 MiB manifest. Files never overwritten.
- Restoration verifies checksum, exact schema of supported migrations,
  integrity_check, foreign_key_check, documents, and campaign boundaries. The
  DB versions 1–4 are allowed and migrated only in the new copy; future ones rejected.
- Before activation, create a preliminary `.nodex` in `backups/`; an error
  interrupts the operation. The new generation is in `profiles/<UUID>/` and becomes
  active via atomic replacement of `active-profile.json`. The old DB
  remains intact; without a pointer, the M0–M3 archives continue in the base folder.
  An exclusive OS lock prevents two processes on the same archive. Files are
  synchronized before activation, and directories as well on Unix. A subsequent
  synchronization error after the commit is returned as an explicit warning.
- The backend selects paths with tauri-plugin-dialog 2.8.3 (MIT/Apache-2.0,
  minimum Rust 1.90); ZIP 9.0.5 (MIT), SHA2 0.10.9 and tempfile 3 (MIT/Apache-2.0).
  No general filesystem authorization to the frontend. Heavy operations
  and blocking dialogs are executed outside the UI thread.
- An attachments manager is not yet added: M4 preserves files already present
  in the managed layout, verified with fixtures in tests. Markdown/JSON export
  and planned backups are postponed: M4 prioritizes manual recovery.
- Copying inactive payloads, instead of moving the extracted folder,
  tolerates Windows directory handles without DELETE sharing; every copy is
  re-checked with SHA-256 before activation. A Windows test reproduces the case.
- Schema comparison includes every object with declared SQL: it does not use `LIKE`
  on SQLite names, because the `_` character could hide unexpected triggers.
  Attachment names with a trailing dot or empty extension are rejected to avoid
  different aliases between Windows and Unix.
- `NODEX_DEV_BACKUP_FILE` / `NODEX_DEV_RESTORE_FILE` predefine only the result
  of the selector for repeatable QA, requiring explicit `NODEX_DEV_DATA_DIR` and
  absolute paths. The entire branch is excluded from release builds. No command
  accepts filesystem paths from React.
- UI Skills: frontend-design for existing hierarchy/palette and screenshot verification;
  vercel-react-best-practices for deferred loading. computer-use opened and
  read the native selector; subsequent inputs blocked by the tool, so
  the desktop round trip uses the default choice in debug, with real ZIP/DB.

## Extended sheet and optional catalog (23 October 2026)

- The request to modify M4 concerns the sheet delivered in M5. M4 maintains
  data recovery; the extension belongs to M5, before M6.
- The user's PDF is only a source of fields and hierarchy. No copy of logo,
  layout, or personal content is inserted into the repository. The sheet
  remains generic, with manual fields for combat, biography, values, and magic;
  a D&D preset adds labels, without invented formulas or values.
- Additive 006 migration: SQLite cache and compatibility boundary for new
  payloads. Added JSON fields have defaults to read M5 sheets; UUID,
  revisions, and sources remain stable. Previous backups remain restorable;
  a previous build must not open the 006 schema.
- Authorized network exception: only explicit GET towards D&D 5e API, edition
  2014. Frontend fetch limited to the host in the CSP; allowlist paths, timeout,
  limited sizes, and no redirects. Search by name performed on downloaded
  indices, without sending the typed text. No new HTTP dependencies.
- Parameterized Rust cache, maximum 150 responses; an import is an
  independent personal copy with reference to the source, stored in the backup.
  The catalog does not write to the graph and does not make rule descriptions facts.
  Read-only API: custom spells are not published.
- Skill: PDF for extraction and visual reading of the four pages; frontend-design
  and vercel-react-best-practices for interface and catalog loading.

## Search and images M6

- 007 Migration: search lines derived from canonical documents and FTS5
  external-content with trigger. Updates in the note/asset transaction;
  reconstruction on migration and in the restored copy, before activation.
  Quoted user text, no arbitrary FTS/SQL syntax; results from the only
  selected campaign with UUID and source block. No remote service.
- 008 Migration: image properties with composite FK for campaign/entry and file
  UUID in the attached M4 layout. PNG/JPEG/WebP validated with image 0.25.10
  (MIT/Apache-2.0, Rust >=1.88; local toolchain 1.99) and base64 0.22.1
  (MIT/Apache-2.0). Originals copied without recompression or EXIF loss.
- 20 MiB limits, 8192 px/side, 32 million pixels, and limited decoder memory;
  orientation applied only to previews. Reading via IPC with ID, no
  external/HTML/SVG executable path or general filesystem permission to the frontend.
- Deferred previews when visible; zoom of the original in the viewer.
  OperationContext reuses the editor flush and the app guard for image mutations.
- Temporary files outside the attachments folder to not compromise a backup
  after a sudden crash. Publication with new UUID without overwrites;
  metadata and SHA-256 verified in backup/restoration. Removal from the entry or
  deletion of the asset disconnects the metadata and keeps the file for recovery.
  Physical cleaning of orphans deferred and declared in the interface.
- frontend-design and vercel-react-best-practices skills for hierarchy, keyboard,
  lazy loading, and visual reading; no DB/testing skills available.

## Export and Logseq sources M6

- ZIP Export with coherent SQLite snapshot, Markdown for UUID, canonical JSON,
original images and manifests; no new dependencies and no MVP re-imports.
- Additive 009 migration: original sources immutable with composite FK and
checksum. The `importedFrom` marker survives autosave; the original copy
is independent of the editable document and is verified in the backup.
- Conversion via IPC into an empty debug profile: sessions in the Diary and index
pages in the Codex to preserve old references. No factual relation
inferred, conflicting aliases maintained in the text, no private data
versioned. Original photos included; partial transcription declared.
- Summary and new views loaded on request. Windows NSIS Installer generated,
Windows/macOS/Linux CI prepared; signing and installation QA remain pending.
- frontend-design skill for hierarchy and readability; vercel-react-best-practices
for composition and lazy loading. No specialized database/testing
skill available: Rust tests, frontend, and real WebView.

## Restyling and graph — extension requested at M6

Direction: readable medieval code, parchment #e6d8b8, ink #30251d,
leather #211a16, brass #b99855, burgundy #6e302b and green #354c3a. Dark
frame, light reading area, local Palatino/Georgia titles; no remote fonts.
Navigation and data semantics preserved. Visual reference generated with
dummy data in .tools/medieval-ui-target.png (1584x992), not an app asset.
The implementation adapts proportions and real controls: no pixel-perfect claims.
Graph with integrated COSE layout, compact subset of 18 nodes, explicit expansion
and detail on selection; arc labels only in highlight.
The subset contains exclusively existing nodes and arcs, without new
inferred relations. Filters in disclosure, accessible list preserved.
Skill: find-skills for CLI/catalog search, frontend-design and ui-taste for
materials/hierarchy and visual comparison; imagegen for the dummy reference only.
Anthropic webapp-testing consulted and evaluated; Tauri automation remains the
Playwright JS already in use in the repository, without global installations.

## Party — M6 extension

Additive 010 migration: member list per page UUID, free player/role,
status and revision for conflicts. Knowledge remains in the Codex document,
with mentions, search, images and existing autosave; no complete record
duplicated and no factual relation created by party membership.
The creation of the new character and membership is atomic. Confirmed removal
only disconnects the membership, preserving page and images.
Backup/restore includes the party; JSON export and Markdown index expose them.
The change of page type preserves the historical membership.
frontend-design skill for company registry and vercel-react-best-practices
for view/editor loaded on request; Rust and frontend tests for persistence,
conflicts, guards and error recovery.

## Wiki Open5e M6

Additive 011 migration for wiki cache separate from personal SRD 2014 catalog.
Paginated public search of Open5e does not replace local assets and does not
create facts in the graph. Source texts and metadata preserved together; each entry
remains distinct per document/edition. HTTP and cache limits applied, failed
refresh maintains the local copy with a warning. CSP limited to the new approved host.
Native proofs: real SRD entry, offline cache after restart, backup/restore and
second reboot with Party member, identical notes and image. Skills and sources
verified in docs/RESEARCH_DND.md; no additional runtime dependencies.


Final visual check M6: the organic layout can compress names in
dense zones of Speratia. The initial view therefore uses an ordered map with
calculated space even for labels; the COSE layout remains selectable.
No relationship is deduced from spatial position. Reorder only the
canvas coordinates, not the data or membership.

## M7 — local inference and model selection

Ollama portable isolated in the ignored path `.tools/m7-runtime`, without
system installation. Rust HTTP Adapter fixed on 127.0.0.1:11434, without
proxy/redirect, verify `/api/status` cloud disabled before each request,
manifest digest and local GGUF weights. Preloading without notes and GPU verification;
exclusive CPU locked, mixed loading declared. No model tools.

The candidate dnd-unified-1.5b Q4_K_M was actually fully loaded onto
GPU but fails the first Italian questions. The user explicitly chose
a more capable multilingual model with local D&D sources and citations.
Qwen3:4b-instruct Q4_K_M produces direct answers; Qwen3:4b standard exposed
reasoning in the content and is not the qualified model. Model licenses are
declared by the authors; weights not redistributed in the repository.

FTS5 Retrieval for campaign only and rule sources selected for edition;
copies with ID/block/revision/hash, conservative context limit. History
not used as a new source. Additive 012 migration, configuration initially
disabled, conversations deletable/exportable/backed up; weights excluded.
Citations verify belonging and version, not semantic truth.
vercel-react-best-practices skill for lazy loading and independent reads.

The actual evaluation showed that prompt instructions alone are not enough:
the model can repeat an attack or cite identifiers not provided. A prudent
lexical gate excludes before sending extracts with explicit signs of
manipulation, preserving other clean sources. If all are suspicious, stop
the question and keep copies for revision. Metrics track exclusions
and possible sending. It is not an infallible classification; possible false positives.
No model tools, no implicit writing in the game world.


## M8 — Campaign Adapter and derived GGUF copies

- AI settings for campaign (013), without changing preferences of other
  campaigns; migration preserves M7 choices already explicit.
- Local QLoRA on fixed Google Gemma 4 12B checkpoint, distinct from retrieval.
  Reconstruction from current snapshot to avoid accumulation of deleted notes.
- Ollama 0.40.10 no longer supports ADAPTER. The worker applies the compact adapter
  to GGUF copies, preserving unmodified tensors and the immutable base.
  Adapters and provenance are campaign data and go into backups;
  inference copies are reconstructible and remain outside the archives.
- No implicit activation: synthetic GPU/citation validation, explicit selection
  and invalidation if sources or policies change. Updated weights and loss
  do not demonstrate by themselves greater accuracy of answers.
- Isolated Python backend, not an additional server: worker distributed with the app,
  offline loading without remote code, cancellation and exit if parent dies.
Status and evidence: docs/AI_TRAINING.md and docs/STATUS.md.


## M10 — localization without data mutations

Atomic v1 JSON global preferences outside backup generations; no
SQLite migration. Local catalogs with Italian source hashes, fallback,
parameters, and editor dictionaries; no AI model or network required to change
language. Saved names/presets, UUIDs, Markdown, and sources do not pass to the translator.
Fantasy languages remain declared partial lexicons: do not invent a
complete translation. Braille/Morse/SGA separated from language, original semantics
and reversible package. Variants/fonts/sources/limits and proofs: I18N.md.

## M11–M13 — versioned writings and offline packages

New writings use original OFL fonts and ASCII codes linked to the explicit font
revision, not an invented Unicode alphabet. v2 preferences with conservative v1
upgrades and v2 reversible packages for Espruar/Dethek; SQLite unchanged.

Dice extremes are a pure classification of the already persisted result.
The replay remounts only the scene; it does not recall RNG or saving. Two local SVG
actors maintain control over direction, flames, and reduced movement.

Forgejo 12.0.4 of the origin allows ZIP up to 2048 MiB: five valid archives,
not ZIP extensions applied to raw data. Distribute only the official Windows GGUF
closure of the Gemma 4 12B base model; exclude the optional
MLX variant and any private data/adapter. New staging installation, complete
verification, and final move; no overwriting of different destinations.
Draft publication and checksums verified via download before rendering final.

## 2026-10-25 — M14: external automation over the running app

Use an opt-in authenticated loopback bridge and a dependency-free Node MCP stdio
adapter. The bridge is deliberately private, not MCP HTTP. This avoids a second
SQLite connection/root lock and keeps restores atomic through the existing
Arc<Mutex<Store>>. Use fixed domain tools and campaign-scoped writes. Revision
checks protect documents/player data; full-page etags protect metadata whose
updates do not increment document revision. GUI metadata forms also compare the
snapshot they opened, preserving drafts after an external update. Dirty editors
postpone refresh. The built-in assistant has no bridge tools. Discovery lives
outside backup generations; shutdown stops the thread explicitly to release its
AppHandle callback and removes the current credential. SQLite remains 015.

## 2026-10-25 — M15: signed updater and pre-install snapshot

Use Tauri updater 2.14 with authenticated version comments; fetch manifests and
packages through our bounded Rust HTTPS reader so redirects, sizes and anonymous
access stay explicit. Resolve Forgejo via its latest-release API and unique
latest.json attachment, not GitHub-only download aliases. Custom static manifests
are allowed on the same HTTPS origin as their artifacts. No automatic startup
request. Store update settings beside profile metadata, outside SQLite (015).

Create a real verified .nodex and hash/preferences receipt before each installer
handoff. Hold the active Store through snapshot/handoff; try_lock the AI slot in
Store -> AI order to avoid inversion with existing services. The external bridge
cannot issue updater commands. Preserve all safety copies. Windows uses passive
NSIS and closes without automatically restoring automation launch arguments.

MSVC integration tests that instantiate Tauri's mock builder need a separate
common-controls v6 manifest for TaskDialogIndirect. Add linker arguments only to
integration test targets; the app already embeds its own manifest. This fixes the
loader failure without changing system DLLs or duplicating app resources.


## 2026-10-25 — Chronological log and planned M16

Preserve historical IDs M0–M15, already used in commits and guides. Extensions
outside the roadmap receive retrospective suffixes a/b/c/d and are placed in their
actual delivery point; the order is explicit in the table, including M11 after
M12/M13. Do not rewrite tags/history, move already delivered features to the backlog
or mark as completed the acceptances still open.

The requested Wiki selector belongs to the new M16 along with scraping:
Default Wikidot in the future, Open5e as an explicit alternative, distinct SRD catalog.
The request is for planning: do not change the app preference first without
a working Wikidot provider. The current release remains Open5e. Requirements and
acceptance criteria in ROADMAP M16; no adapters, migrations, or UI added now.


## 2026-10-25 — M15a: herald as presentation of the M15 flow

- The policy (when to check, when to announce) is pure Rust and tested; the
  check reuses the refactored M15 function, so signatures, stable versions, and
  same-origin remain identical. An automatic failure shows nothing.
- Limits: one check per session (AtomicBool) and at most every 20 hours,
  recorded only after a successful check; backward clock does not block.
  Delay of 3 days and «ignore» are for version: a newer one is announced.
- Separate `update-announcements.json` file: adding fields to
  `update-settings.json` (deny_unknown_fields) would have broken the M15 reading.
- The popup does not install: «Update» leads to settings and starts the verified download
  ; the mandatory backup remains linked to the installation button.
- Waiting for an inactive app on the frontend side (guards, dialogs, text fields) plus
  a local command for AI/training/update in progress. A `<select>` with
  focus does not count as writing (bug found in desktop testing).
- Web Audio fanfare instead of a file: no license or audio assets, low volume,
  no new attempt if autoplay is blocked.
- No hand-drawn SVG figures (craft-floor of impeccable): geometric emblem
  until the user provides the raster illustrations.

## 2026-10-25 — M16 implemented: Wikidot adapter, separate cache, epoch

- The user asked to run M16: precedes M15a, which remains planned.
- Wikidot HTML read by the Rust backend, not by the WebView: no new host in the
  CSP, redirect/dimension/time checks and no cookies. `scraper` 0.29 (ISC,
  html5ever MIT/Apache, cssparser/selectors MPL-2.0 unmodified) without pre-defined
  features. The saved result is structured text, never the original HTML.
- The category index is downloaded and filtered locally: the typed term
  does not leave the device. One request at a time, ≥1,5 s between requests,
  no automatic retry (403/429 reported as a site limitation).
- Table `wikidot_cache` (migration 016) separated from `wiki_cache` Open5e, so
  each source empties itself without mixing keys or eviction. Schema backup 016
  not openable from previous versions (same criterion as past migrations).
- Preference `wiki-preferences.json` separated from `interface-preferences.json`: a
  the new field in the v2 file would have caused 0.4.0 clients to fall back into recovery
  Italian. Missing file = Wikidot not explicit; the pre-update receipt
  includes it. The restoration does not touch the root folder.
- Atomic cache Epoch: every clear increments it and cancels Wikidot requests
  writes (including Open5e from the frontend) that bring an old epoch are
  rejected inside the database lock, so nothing reappears after the clear.
- Optional `catalogSource.provider` and omitted for SRD: existing entries maintain
  the same JSON. AI `wikidot/<pagina>` keys use edition 5e-2014.
- Source change: dialogue with focus on action, Escape = rejection; only acceptance
  saves Open5e and repeats the search once; an Open5e error does not reopen proposals.

## 2026-10-25 — M15a before M16; deletable cache and source change on consent

Insert M15a between the delivered M15 updater and the planned M16 scraping, without
renumbering Wikidot or historical IDs. The vassal with trumpet and manifesto is a
presentation of the M15 flow: it does not replace signatures, user confirmation, or backup.
The startup check is a future switchable extension of the updater, not
authorization for automatic requests for wiki/AI or a function already implemented.

The M16 cache deletion concerns only derived source data, not saved copies,
campaign notes/images, preferences, or backups. Invalidating pending requests
prevents newly deleted data from reappearing without a new request.
Wikidot failure must propose an explicit source change: consent required
before consulting Open5e; persistent and visible choice, no silent fallback.
Both changes remain planned; code and version unchanged.

## 25 October 2026 — Derived and local wiki translations (M17)

The translation uses the already approved Qwen3 4b-instruct, without campaign context or adapter,
with first explicit inference and original preserved. A separate table
in the Store (017) links the draft to the provider, language, and hash of the
content with provenance: it does not make the translation a canonical source and allows
backup, invalidation, and clearing without rewriting the originals. The shared AI block
prevents concurrency with assistant, training, and updater installation.
Model replacement belongs to qualification M18.

## 25 October 2026 — Self-hosted server in a separate repository (M24, planned)

For the shared campaign, the user chose a self-hosted Chronexus server
instead of peer-to-peer: a single account for desktop and Android (M25), permissions for
single items, and availability even with other devices turned off. The server
is in an external repository (proposed `acelith/Chronexus-Server`) because it has its own
release cycles, dependencies, distribution (Docker), and security surface;
the app remains installable and usable without it. The boundary is a versioned HTTP API
with a contract published by the server; no manual copy of types or
schemas between repositories. Hosting, registration, and end-to-end encryption remain to
be decided at the start of M24.
