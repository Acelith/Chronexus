# M0–M5 Verifications

## Automated Suites

- `pnpm test`: screens (creation/renaming, session, errors, navigation
  locked) and autosave (debounce, concurrency, flush, error and retry).
  Isolated UI tests replace the bridge with a mock; desktop smoke tests use
  real persistence. M4 adds backup forms, confirmations, errors, and autosave guards.
- `pnpm test:rust`: real database in temporary files, two identical paragraphs
  after reopening, numerical order, stable renaming, separate campaigns,
  validation, failed write, obsolete revision, and migrations.
- `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm build`.
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` and
  `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`.
- `pnpm build:desktop`: release executable without installer.

## Real desktop test on Windows

Executed via Playwright connected to Chronexus's WebView2: no mocks of
commands or database. The test profile remains in `.tools/`, excluded from Git.
The profile variable is available **only in debug builds**, ignored
in releases. The inspection port is an explicit test configuration;
do not set it for daily use.

1. Prepare a new and absolute profile folder, without personal data.
2. Start `pnpm dev` in a terminal (port 1420).
3. In another PowerShell terminal, with Rust available:

```powershell
cargo build --manifest-path src-tauri/Cargo.toml
$env:NODEX_DEV_DATA_DIR="$PWD/.tools/smoke-profile"
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS='--remote-debugging-port=9223'
Start-Process "$PWD/src-tauri/target/debug/chronexus.exe"
node scripts/desktop-smoke.mjs prepare
```

`prepare` requires an empty database and creates a campaign, renames it, adds
sessions 12 and 2, writes two paragraphs, and compares the real JSON in SQLite.
Then it adds a line and immediately requests window closure to test
the flush of pending changes.

4. Wait for the window to close, restart the same executable with the
   same profile and then run:

```powershell
node scripts/desktop-smoke.mjs verify
```

`verify` checks document equality (including block IDs), order,
last line, visible text, and bold/title/list formatting in a
second session. Control images are saved under `.tools/`.
The test does not delete data: to repeat from scratch, use another new profile.

## Complementary manual checks

- Navigate with Tab; verify visible focus, fields with labels, and form submission.
- Try a narrow window, long notes, accents, and 200 character names.
- Two instances on the same session: the second obsolete write must be
  stopped; copy notes before reopening. No merge is planned in M1.
- Do not force-terminate the process to simulate normal closure.

## Smoke M2 — Codex, links, and backlinks

Requires the same debug build, Vite server, and WebView2 port of the M1 test.
Use a **new** empty profile, for example:

```powershell
$env:NODEX_DEV_DATA_DIR="$PWD/.tools/m2-nuova-prova"
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS='--remote-debugging-port=9223'
Start-Process "$PWD/src-tauri/target/debug/chronexus.exe"
node scripts/knowledge-smoke.mjs prepare
```

The `prepare` phase uses real UI and commands to verify:

- Session 12 → `[[Varek` → draft creation → page opening and backlink.
- Rename to «Varek the gray», type/status/alias, and preserved UUID.
- Return from backlink to source block with highlighting, then page→page
  mention towards «Gilda» and backlink from the page.
- Alias «Guardian» shared by two pages: explicit choice, no duplicates.
- A second writer creates a name before menu confirmation: real duplicate
  error and `[[Contesa]]` text preserved in the editor and saved.
- Missing reference inserted via the real Rust command: explicit recovery
  as a draft with the same UUID, without modifying source links.

The window closes. Reopen it with the same profile and run:

```powershell
Start-Process "$PWD/src-tauri/target/debug/chronexus.exe"
node scripts/knowledge-smoke.mjs verify
```

`verify` compares all documents, UUIDs, and aliases before/after restart and
verify navigation and backlinks from sessions and pages. No persistence mock.
Expectations and screenshots are in `.tools/`, never in Git. Do not delete personal
profiles to repeat the tests: choose another empty test folder.

The isolated suites also cover validation, M1→M2 upgrade, block
recursion, mention removal, conflicts, and cross-campaign link rollbacks.

## Smoke M3 — graph and explicit relations

Use a **new and empty** debug profile, with Vite server and WebView2 as in the
previous smokes. Do not start other test instances on the same port.

```powershell
$env:NODEX_DEV_DATA_DIR="$PWD/.tools/m3-nuova-prova"
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS='--remote-debugging-port=9223'
Start-Process "$PWD/src-tauri/target/debug/chronexus.exe"
node scripts/graph-smoke.mjs prepare
```

`prepare` creates campaign/Session 12 and two mentions in the same note, then try:

-" Real query with only session→page arcs, without inferred Varek→Gilda relation.
-" Manual creation of «Varek accuses Gilda», suspicious certainty, evidence/notes, and source block.
- Real Cytoscape style (hatching/continuous, certainty text) and mouse click on
  nodes and arcs at the rendered coordinates. The test reads the local record
  of the canvas only to identify the click points: no data or event mocks.
- Opening the source on the original block, modification of certainty, filters of
  relation/session/center/depth and return to the full view.
- Unsaved form that prevents navigation, deletion canceled with Escape,
  confirmed deletion that preserves mentions and new relation for the restart.

The window closes. Reopen it on the same profile and execute:

```powershell
Start-Process "$PWD/src-tauri/target/debug/chronexus.exe"
node scripts/graph-smoke.mjs verify
```

`verify` compare graph, UUID, relation, certainty, source/evidence and document
with previous data; verify detail and style in the real canvas after the restart.
The Rust suites also cover removed sources, campaign boundaries, obsolete revisions,
M2→M3 upgrades, 1/2 neighborhood and 150 limits of nodes/400 arcs without missing extremes.
Isolated UI suites cover forms, errors, confirmation, and filters using a mock canvas;
the desktop test instead uses real Cytoscape, Tauri, and SQLite.

## M4 Backup and restoration

Rust Suite: snapshot with WAL active; round trip of two campaigns, documents,
aliases, mentions, relations with certainty/sources and PNG; reopening; return to the copy
preventive; migration of M1 backup to copy. Rejected altered checksums, DB
damaged with recalculated hash, unexpected triggers (including `sqliteXunexpected`),
future versions, incorrect counts, extra/missing files, duplicates, symbolic links,
absolute/traversal paths and sizes out of limits. They also test OS locks,
non-writable destinations, overwrite prohibition, and failure of preventive copy
or activation. Windows test dedicated to occupied directories without DELETE sharing.

Repeatable desktop smoke, only on empty test profiles in `.tools/`:

```powershell
# Prima compilare il debug, configurare Rust come nel README, avviare pnpm dev.
cargo build --offline --manifest-path src-tauri/Cargo.toml
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS='--remote-debugging-port=9223'
$env:NODEX_DEV_DATA_DIR="$PWD/.tools/m4-source"
$env:NODEX_DEV_BACKUP_FILE="$PWD/.tools/m4-portable.nodex"
Start-Process -FilePath "$PWD/src-tauri/target/debug/chronexus.exe" -WindowStyle Hidden
node scripts/backup-smoke.mjs seed
node scripts/backup-smoke.mjs create
node scripts/backup-smoke.mjs created
# created chiude normalmente la finestra dopo la ricevuta.
$env:NODEX_DEV_DATA_DIR="$PWD/.tools/m4-target"
$env:NODEX_DEV_RESTORE_FILE="$PWD/.tools/m4-portable.nodex"
Start-Process -FilePath "$PWD/src-tauri/target/debug/chronexus.exe" -WindowStyle Hidden
node scripts/backup-smoke.mjs select
node scripts/backup-smoke.mjs cancel
node scripts/backup-smoke.mjs select
node scripts/backup-smoke.mjs restore
# restore chiude normalmente dopo confronto e verifica della copia preventiva.
Start-Process -FilePath "$PWD/src-tauri/target/debug/chronexus.exe" -WindowStyle Hidden
node scripts/backup-smoke.mjs verify
```

The variables `NODEX_DEV_BACKUP_FILE` and `NODEX_DEV_RESTORE_FILE` replace
**only the selector result**, exclusively in debug with an explicit profile
do not simulate data, command, ZIP, or checks. Without these variables
the `create`/`select` steps require manual file selection in the native dialog.
Test branches do not exist in the release. The `.nodex` file must have a new
name: a second execution on the same path fails intentionally.
Keep previous fixtures and choose new names/profiles to repeat.
`NODEX_SMOKE_TARGET` can indicate a different target folder inside `.tools/`.

`verify` compares complete documents and metadata, UUID, graph, relations/sources and
SHA-256 of the image in the active profile after restart, then opens the real canvas.
Screenshots ignored by Git are visually checked. The target initially contains
a test campaign to verify also the replacement and the
preventive copy, in addition to recovery in a new profile.

Manual QA still necessary: complete native saving/opening on every
OS, cancel the selector, try unavailable external/network disk and
insufficient space. On Windows M4 `computer-use` observed the native selector;
subsequent inputs failed with a tool error on the foreground process.
The actual round trip uses the default choice in debug.

## Character and origin M5

Rust tests added: persistence of card/stats/PF/resources/slot, limits and
obsolete revisions, inventory with origin and renaming, independence of
ability markers, campaign separation, removed blocks, Codex type change,
atomic/idempotent 004→005 migration, write errors and M5 backup round trip.
UI tests added: modules preserved on error, navigation guards, waiting
counters, source selection, confirmed/Escape deletion, filters, failed reading
with retry and manual behavior of unknown adapters.

Smoke repeatable only on empty synthetic profiles, with Vite server and compiled debug:

```powershell
$env:NODEX_DEV_DATA_DIR="$PWD/.tools/m5-source"
$env:NODEX_SMOKE_SOURCE="$PWD/.tools/m5-source"
$env:NODEX_DEV_BACKUP_FILE="$PWD/.tools/m5-portable.nodex"
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS='--remote-debugging-port=9223'
Start-Process -FilePath "$PWD/src-tauri/target/debug/chronexus.exe" -WindowStyle Hidden
node scripts/player-smoke.mjs prepare
Start-Process -FilePath "$PWD/src-tauri/target/debug/chronexus.exe" -WindowStyle Hidden
node scripts/player-smoke.mjs verify
$env:NODEX_DEV_DATA_DIR="$PWD/.tools/m5-restored"
$env:NODEX_DEV_RESTORE_FILE="$PWD/.tools/m5-portable.nodex"
Start-Process -FilePath "$PWD/src-tauri/target/debug/chronexus.exe" -WindowStyle Hidden
node scripts/player-smoke.mjs restore
Start-Process -FilePath "$PWD/src-tauri/target/debug/chronexus.exe" -WindowStyle Hidden
node scripts/player-smoke.mjs verify-restored
```

`prepare` creates session/pages with real Rust commands, then uses the interface to
create/modify the card, resources/slot, object and ability; verifies guards,
zero quantity, equipment, filters and deletion confirmation. From the detail
of the key, opens Varek and the source block of Session 12 and returns to the key,
even when this is not the first item in the list. Verifies absence of automatic
factual arcs and implicit resource consumption, then creates the backup with PNG.
Each phase normally closes the window. `verify` and `verify-restored` compare
entire documents/card/asset/graph/UUID and image hash after restart.

The proofs of this execution use `.tools/m5-source-final` and `.tools/m5-restored`;
`NODEX_SMOKE_SOURCE` / `NODEX_SMOKE_RESTORED` choose alternative folders inside
`.tools/`. `NODEX_SMOKE_BACKUP` chooses the file that the smoke verifies, to be set
to the same path as `NODEX_DEV_BACKUP_FILE` and `NODEX_DEV_RESTORE_FILE`.
Use new backup files to repeat, without overwriting previous fixtures.
Only the selector result is default in debug, as for M4: persistence,
ZIP and validations are real. Card/inventory/ability screenshots checked;
the three views were also verified at 760 px without horizontal overflow.

## Card extension and SRD catalog 2014

Skills applied: PDF for extraction and visual inspection of the four pages of the
reference; frontend-design for sections and hierarchy; vercel-react-best-practices
for deferred compendium and derived local filters. No specific Skill for
database/testing available; checks with ordinary tools.

New automated tests: M5 payload defaults after 006 migration, card
limits and failed replacement on error, validated SRD source, persistent and
limited cache to 150 entries even with backward clock, card/cache backup. Frontend:
no network on opening, constrained GET, offline copy, visible fallback,
wrong/oversized responses and full disk; material/higher level import,
presets without formulas and preservation of module notes/markers/sources.

Executed Windows: 39 frontend test and 40 Rust; lint, typecheck, formatting,
Clippy and build debug/release. Real Smoke WebView2 with public API: Magic Missile
imported and renamed, original spell with search yielding no results,
consultation of classes/equipment/rules and subsection. Search by local name;
observed requests are only GET category/index, no personal names.
Real backup, restart, restore on empty archive and second restart compare
card, UUID, spells, sources and responses in cache. In offline steps, only the
unavailability of the API host is simulated; DB, IPC and backup are not simulated.
Screenshots inspected, loaded card verified at 760 and 1200 px without overflow.

To repeat with new folders/files, server `pnpm dev`, compiled debug and Rust
locale configured as above:

```powershell
$env:NODEX_DEV_DATA_DIR="$PWD/.tools/sheet-catalog-source-new"
$env:NODEX_DEV_BACKUP_FILE="$PWD/.tools/sheet-catalog-new.nodex"
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS='--remote-debugging-port=9223'
Start-Process -FilePath "$PWD/src-tauri/target/debug/chronexus.exe" -WindowStyle Hidden
node scripts/sheet-catalog-smoke.mjs prepare
Start-Process -FilePath "$PWD/src-tauri/target/debug/chronexus.exe" -WindowStyle Hidden
node scripts/sheet-catalog-smoke.mjs verify
$env:NODEX_DEV_DATA_DIR="$PWD/.tools/sheet-catalog-restored-new"
$env:NODEX_DEV_RESTORE_FILE="$PWD/.tools/sheet-catalog-new.nodex"
Start-Process -FilePath "$PWD/src-tauri/target/debug/chronexus.exe" -WindowStyle Hidden
node scripts/sheet-catalog-smoke.mjs restore
Start-Process -FilePath "$PWD/src-tauri/target/debug/chronexus.exe" -WindowStyle Hidden
node scripts/sheet-catalog-smoke.mjs verify-restored
```

`prepare` requires an empty profile and Internet access; every phase closes the
window normally. The file selector result is defaulted only in debug.
The expected fixture and screenshots remain ignored in `.tools/`. No PDF or
personal data in the repository. The search functionality in the release build
with origin `tauri.localhost` was not tested in this revision;
the release build and the CSP with explicit API host are verified.
M6 Update: GET Magic Missile from tauri.localhost release verified (200).

## Platforms

Windows x64: DB/frontend suite, debug build and WebView2 smoke executed.
Release build: compiled and started, shell and SQLite command verified by
`http://tauri.localhost/` with embedded assets. The empty personal archive was
only read, without adding test data. Do not start together
WebView with different debug arguments on the same WebView2 profile.
Windows NSIS Installer generated; installation/uninstallation not performed.
macOS/Linux and CI matrix prepared: not executed in this environment.
The native `computer-use` check was consulted but the window access request
expired: the actual smoke uses the real WebView and Rust DB.

## M6 — Windows verifications of 23 October 2026

- Frontend: 47 test in 15 file; Rust: 47 test. Lint, typecheck, format,
  cargo fmt/clippy and Windows build verified (see STATUS).
- Smoke images with isolated profile: real PNG loading, preview/zoom,
  search with source block, real `.nodex` creation. Rust tests cover
  corrupted files, hostile payload/path, properties and backup/restore.
- Speratia: 84 sessions, 209 pages, 18 assets, 36 images (32 archive + 4 photos),
  207 Markdown sources with verified hashes. Verified summary, card,
  photo viewer, read-only source and search. Two aliases match
  other titles: kept in text without merging.
- Source restart, restore on empty profile and restored restart: complete
  comparison of data, UUID, sources and byte-for-byte hashes of 36 images PASS.
- Real export: 209 pages, 84 sessions, 207 original Markdown and 36 images;
  checksums compared. Backup copied to Downloads with identical SHA-256.
- Profiles and acceptance scripts with personal data remain ignored in
  `.tools/`. The test uses the default debug selector, real SQLite/file/ZIP.
- Remaining QA: install/uninstall NSIS on test machine, run CI
  and check packages on macOS/Linux; distribution signatures not prepared.


## M6 Extension: graph, theme, Party and Open5e

- Frontend: 52 test in 18 file PASS; targeted graph re-executed after the last
  correction: 5 PASS. Rust: 49 test PASS. Lint/typecheck/format/clippy PASS.
- 010/011 additive migrations. Speratia backup schema 009 restored in the
  build schema 011: 84 sessions, 209 pages, 207 sources and 36 identical images.
- `scripts/m6-extension-smoke.mjs prepare/verify/restore/verify`: real PASS with
  member created from UI, autosaved notes, PNG, Open5e SRD spell 5.1,
  document/licenses, export, backup, restarts and offline. Only network unavailable
  and debug selector destinations are checked, not data/SQLite/ZIP.
- Six views checked at 1584/1200/760 px without horizontal overflow; final screenshots
  inspected. Graph: 18 nodes, real canvas selection, detail, focus
  and transition between Readable and Organic Map verified.
- NSIS installed in a new .tools folder, after verifying the absence of
  existing installations. Executable installed and started, SQLite read and GET
  Open5e 200 from `tauri.localhost` verified. Silent uninstallation without
  deleting data: executable/registration removed, 2 personal DB with SHA-256
  identical before/after. Interactive Wizard not inspected.
- Installer regenerated after final label correction; no changes
  to the installation/uninstallation flow between the two builds.
- macOS/Linux/CI not performed; installer not signed. No AI/GPU inference proof
  performed: nvidia-smi detects only the hardware for the planned M7.

To repeat the smoke extension (each phase closes the app):

1. Start debug with absolute new `.tools/m6-extension-source` NODEX_DEV_DATA_DIR,
   NODEX_DEV_BACKUP_FILE `.tools/m6-extension.nodex`, NODEX_DEV_EXPORT_FILE
   `.tools/m6-extension-export.zip` and WebView2 CDP 9223; Vite on port 1420.
2. `node scripts/m6-extension-smoke.mjs prepare`.
3. Restart the same profile; `node scripts/m6-extension-smoke.mjs verify`.
4. Start new `.tools/m6-extension-restored` profile with NODEX_DEV_RESTORE_FILE
   at the created backup; `node scripts/m6-extension-smoke.mjs restore`.
5. Restart the restored; `node scripts/m6-extension-smoke.mjs verify`.

Use absolute paths for all NODEX variables; do not use personal profiles.
The script contains only dummy data and a tiny test PNG; output in .tools/.
## M7 — local verification of 23 October 2026

- Portable Ollama Runtime 0.40.10, Qwen3:4b-instruct Q4_K_M on RTX 4080 SUPER.
  Identity/weights/licenses, configuration and limits: AI_LOCAL.md.
- Specific D&D 1.5B model actually loaded on GPU but discarded for repetitive
  Italian responses. Multilingual alternative explicitly approved by the user.
- 63 Rust test: PASS; Clippy -D warnings, debug build: PASS.
- 55 React, lint/typecheck and format:check test: PASS; final touches verified
  even with the 3 targeted tests. NSIS M7 Package: PASS; installation not repeated.
- Native tests on a dummy profile: streaming/cancel, cancellation during
  navigation, opening cited block, renaming with warning, choosing 2024 rules,
  confirmed cancellation, backup and export: PASS.
- Native backup restored in a new profile and restarted without Ollama:
  exact comparison of 90 conversations/sources/metrics, 25 pages, one member
  Party and configuration: PASS. Original image included in backup/export.
  Checksum manifest, source hashes and original PNG bytes verified even
  when reading the two archives; model weights absent.
- Errors with simulated local server (not real GPU failure tests): cloud
  active, model absent, exclusive CPU and OOM stop before sending notes;
  malformed NDJSON, excessive fragment, interrupted stream and invented citation
  retain error/draft. Canonical data unchanged. Runtime actually absent:
  error handled and retained; campaigns and history remain viewable.
- Test with cloud disabled and unreachable external proxies: 40 scenarios
  executed on the GPU. 80 samples, 173 runtime/executor connections, all
  towards 127.0.0.1. Not equivalent to physically disconnected network/firewall.
- The model alone does not pass the rigorous criteria on malicious documents:
  retrieves the data but repeats attacks and misleading doubts; one citation [S99]
  is correctly rejected. Added a cautious lexical gate before the
  model for explicit manipulation signals; 5 dedicated cases and benign tests.
  Not an infallible classification: possible false positives and new attacks.
- Final benchmark with the gate: 40/40 expected outcomes, 35 GPU inferences and 5 requests
  stopped before the model. Canonical data unchanged. Synthetic public script
  scripts/qa/local-ai-evaluation.mjs: only empty debug profile and flag
  CHRONEXUS_AI_QA=isolated. Verify responses as well, not just keywords.
- Missing: test with physically disconnected network/firewall block, GPU and
  macOS/Linux packages; physical OOM not provoked. No invented results.


## M10 — languages, scripts and integrity

113 Vitest and 79 Rust passed; typecheck/lint/format, clippy -D warnings,
i18n:check and Windows desktop build passed. Native QA in isolated profile,
compiled frontend: 13 languages × 13 views, three scripts, minimum Arabic 760×600,
restart, backup/restore 015, global preferences preserved and corrupted JSON
recovered from the menu. Snapshots compared without implicit data changes.
Axe EN/AR/JA on settings without violations; five local fonts loaded,
Monocraft actually blocked with normal text still readable. Unicode in
Markdown/visual and simulated composition, CJK search and original UUID preserved.
No remote requests in observed paths. No declared tests on
system IME, physical Braille reader/display, macOS or Linux.
Protected scripts, sources, repetition and limits: I18N.md. Local evidence .tools/m10.

## M16 Testing — Wikidot, source selection and cache

Uses a **debug** executable with Vite on port 1420, `NODEX_DEV_DATA_DIR` and
`WEBVIEW2_USER_DATA_FOLDER` on absolute **empty** folders under `.tools/m16/` and
`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223`. Set
`CHRONEXUS_WIKI_QA=isolated` and run `node scripts/qa/m16-wiki.mjs check`; close
the window normally, reopen it with the same folders and run `restart`.
The script actually reads a public index and a page from dnd5e.wikidot.com and, only
after the simulated consent, an Open5e search. Reports and screenshots in `.tools/m16/`.
The parser on the real pages is tested by saving them outside the repository and launching
`cargo test real_saved_pages -- --ignored` with `CHRONEXUS_QA_WIKIDOT_DIR`.

## M15a Testing — update herald

Compile a debug executable in a separate target if another instance is holding
`src-tauri/target` locked (`CARGO_TARGET_DIR=.tools/m15a/target`). For each phase
use absolute `NODEX_DEV_DATA_DIR` and `WEBVIEW2_USER_DATA_FOLDER` under `.tools/m15a/`,
`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9224`,
`CHRONEXUS_HERALD_QA=isolated` and the same `NODEX_DEV_DATA_DIR` for the script.

1. `fixture`: new profile with `NODEX_DEV_HERALD_VERSION=0.5.0` (debug only,
   no network or real package): popup, focus, axe, Escape = retry.
2. `quiet`: close normally and reopen the same profile: no check.
3. `real`: new profile without fixtures: real check of the public channel; with
   current 0.4.0 nothing should appear. Then disable the check at startup.
4. `optout`: reopen the same profile: no automatic request.


## M22 Testing — local AI from settings

Empty debug profile, CDP 9224, `CHRONEXUS_AI_SETUP_QA=isolated` and the same
`NODEX_DEV_DATA_DIR` for the script. `node scripts/qa/m22-ai-setup.mjs install`
actually downloads the official archive (about 1,6 GB) into the profile folder,
starts it and stops it. `pull` requires a local runtime without cloud already active with
the qualified model present and verifies the download path without downloading
17,7 GB.

## M20 Testing — README images

Empty debug profile, CDP 9224, `CHRONEXUS_README_QA=isolated`, then
`node scripts/qa/m20-readme-media.mjs`: create the invented campaign «The Tower of
Varek» and save the screenshots in `.tools/m20/`; convert them to WebP in `docs/media/`.

## M19 Testing — backups in Documents and periodic

Debug executable (separate target if `src-tauri/target` is locked), Vite on 1420,
CDP 9224 and, for each phase, the same `NODEX_DEV_DATA_DIR` (new profile under
`.tools/m19/`), `NODEX_DEV_DOCUMENTS_DIR` (simulated Documents with spaces and Unicode,
mai quelli reali), `NODEX_DEV_NO_OPEN=1` and `CHRONEXUS_BACKUP_QA=isolated`.

1. `node scripts/qa/m19-backups.mjs auto`: synthetic campaign with image,
   planning every 2 hours and 2 copies from settings; no backup nor
   folder while a field has focus; automatic backup after inactivity;
   "Run backup now" twice: rotation to 2 copies, `manuale.nodex` intact.
2. Close the app, then `… m19-backups.mjs age` (ages the last backup by 3 hours).
3. Reopen the same profile and `… m19-backups.mjs restart`: preferences preserved,
   expired backup performed after restart, verified copy of a backup
   `update-backups` in Documents with original preserved, restoration from the list
   with image and preferences unchanged.
