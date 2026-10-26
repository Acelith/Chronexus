# Chronexus Development and Maintenance

Technical instructions moved from README to M20 without content changes. User guide: [GUIDE.md](GUIDE.md); testing procedures: [QA.md](QA.md); release: [UPDATES.md](UPDATES.md) and [INSTALLERS.md](INSTALLERS.md).

## Name, identifiers, and data

Personal diary for a TTRPG campaign player. Desktop, local data,
no account, and primary offline functions; online catalog searches
only upon request. Name and branding are centralized
in `src/strings.ts`, `package.json`, and `src-tauri/tauri.conf.json`.
The Tauri identifier determines the data folder: do not change it without migrating the data.
Chronexus is the new name for Nodex: the `it.nodex.desktop` identifier, the
technical database names, and the `.nodex` extension remain unchanged to reopen the
existing archives and backups. The executable is now called `chronexus.exe` on Windows.

## Prerequisites and startup

- Node >= 22.12 and pnpm 11 (`packageManager` fixes the version).
- Rust stable >= 1.90 with Cargo.
- Windows: Visual Studio C++ Build Tools and WebView2, MSVC toolchain.
- macOS: Xcode Command Line Tools.
- Linux: WebKitGTK 4.1 dependencies and development requirements from the distribution.
  See https://v2.tauri.app/start/prerequisites/ for exact packages.

```sh
pnpm install --frozen-lockfile
pnpm desktop
```

`pnpm dev` opens only the frontend: without Tauri it has no access to the database and
shows an error, not a simulated archive.

In this session, Rust was installed in `.tools/`, ignored by Git.
To reuse it from PowerShell in the project root:

```powershell
$env:RUSTUP_HOME="$PWD/.tools/rustup"
$env:CARGO_HOME="$PWD/.tools/cargo"
$env:PATH="$PWD/.tools/cargo/bin;$env:PATH"
pnpm desktop
```

## Moving the project between disks (Windows)

The pnpm store is relative (`pnpm-workspace.yaml`). After a cut/paste,
recreate the local links with `pnpm install --frozen-lockfile --force`:
do not copy the old `node_modules` links. The lockfile remains unchanged.
For the portable toolchain use `./scripts/Dev.ps1` (desktop startup), or
`./scripts/Dev.ps1 -Task test:rust` / `-Task build:desktop`: the paths are
derived from the current repository location, without references to C: or D:.
Ollama starts with `./scripts/Start-LocalAI.ps1`. Personal databases remain
in the app's data folder; they must not be copied or deleted during repair.
The local Python environment must be able to import `torch` and detect CUDA; if the
base Python was removed, recreate the environment following `AI_LOCAL.md`.

## Verifications

```sh
pnpm lint
pnpm format:check
pnpm typecheck
pnpm i18n:check
pnpm test
pnpm test:rust
pnpm build
pnpm build:desktop
```

Localization review is mandatory for **every interface change**, including layout,
accessibility labels, dialogs, native installers and displayed backend errors.
Run the strict check, update all affected catalogs and inspect the changed views
in English, Italian and affected locales/RTL. English fallback does not count as a
completed translation. `pnpm i18n:audit` reports missing UI messages and installer
languages without writing files; `--json` provides the detailed inventory.
See [I18N.md](I18N.md) and the actual [audit findings](I18N_AUDIT.md). CI and the
signed-release wrapper stop when this gate fails, before building/signing.

The desktop build produces the local executable without an installer. Distribution
and the Windows/macOS/Linux matrix are planned for M6.

## Data

SQLite is managed exclusively by Rust in the application data folder provided
by the operating system (`it.nodex.desktop` under the data directory).
Versioned, transactional SQL migrations applied only once. No campaign data
must be added to Git. Do not synchronize the open database
with file sharing services. After a restore, `active-profile.json` selects
the database and attachments in `profiles/<UUID>/`; before the first restore, the
database remains `nodex.sqlite3` in the base folder. Do not move the database alone.

Decisions and limits verified: `DECISIONS.md` and `STATUS.md`.

## New in M6

- **Campaign Search**, even with Ctrl/⌘ + K: FTS5 search in the content of
  blocks, titles, aliases, sheets, and assets; filters and opening of the found block.
  “Search maintenance” allows rebuilding the local index.
- **Summary**: last session, actual counts, sheet, and recent pages.
  Ctrl/⌘ + Shift + N opens the new session.
- **Images** in Codex pages, sheets, and inventory/ability entries. Add
  portraits, maps, and PNG/JPEG/WebP references (20 MiB, 8192 px/side, 32 MP).
  The app keeps an original copy in the archive; previews and zoom work
  offline. For a map, use a Place page and the Map image type.
- Images and their associations are included in `.nodex` backups and verified
with SHA-256. "Remove from entry" unlinks the image but keeps the file for
recovery: it remains included in backups until a dedicated cleanup exists.
- **Export campaign** creates a ZIP with Markdown, full JSON, linked images
and manifest. Markdown links use stable UUIDs. For app recovery, use
`.nodex`: the readable export is not a re-import format.

## Desktop packages

Full Windows package with app installer and offline AI in the root:
`installers/Chronexus-0.1.0-Windows-x64/`. Keep the `AI` folder next
to its installer. Instructions and regeneration: [docs/INSTALLERS.md](INSTALLERS.md).

`pnpm icons` generates icons from the SVG source; run it before Cargo commands
on a new checkout. `pnpm desktop` and `pnpm build:desktop` do this automatically.
`pnpm package:desktop` creates native packages for the current platform:
Windows NSIS `.exe` (Italian, current user), macOS `.app`/`.dmg`, Linux
`.deb`/`.AppImage`. Outputs are in `src-tauri/target/release/bundle/`.

Verified locally on Windows x64: installer `Chronexus_0.1.0_x64-setup.exe`
generated, release started, SQLite access and real API from `tauri.localhost` succeeded.
The installer is not signed and was not automatically installed on the system.
The `.github/workflows/desktop.yml` pipeline prepares checks and packages for the three
OSs; it was not run on GitHub in this session and was not pushed.
macOS/Linux remain to be verified on their respective runners.

## Main dependencies and licenses

React, Vite, Mantine, Cytoscape.js, rusqlite, zip, uuid: MIT (uuid also Apache-2.0).
Tauri, tauri-plugin-dialog, sha2 and tempfile: MIT/Apache-2.0.
M7: reqwest 0.13.5 MIT/Apache-2.0 (HTTP loopback, predefined features excluded),
Tokio 1.54.1 MIT. Licenses and versions verified in local package manifests.
BlockNote core/react/mantine: MPL-2.0, used without
modifying sources and without XL commercial features. TypeScript: Apache-2.0.
Future distributions must include applicable license notices.
Resolved versions and transitive dependencies are in the two lockfiles.


## Logseq distribution and import

`pnpm package:desktop` generates icons and the current platform package.
On Windows, the installer is located in
`src-tauri/target/release/bundle/nsis/Chronexus_0.1.0_x64-setup.exe`.
Build and Windows startup verified. NSIS installation, startup, and uninstallation
tested in silent mode, preserving personal databases with identical hashes.
The interactive wizard was not inspected; macOS/Linux signing and verifications
remain to be performed. The CI matrix is in
`.github/workflows/desktop.yml`; it was not run from this session.

The `scripts/prepare-logseq.py` and `scripts/import-logseq.mjs` tools prepare
a Logseq archive in a **blank and isolated debug profile**, via real Rust
commands. They are not a general importer in the interface. Example:

```powershell
py scripts/prepare-logseq.py C:/path/campaign.zip .tools/logseq-source
# First run pnpm desktop with an absolute, empty NODEX_DEV_DATA_DIR,
# WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223
node scripts/import-logseq.mjs .tools/logseq-source "Sample campaign"
```

Only Markdown and raster images are read: configurations, Git, and graph scripts
are not executed. Original Markdown sources remain immutable,
viewable in the app and included in backup/export. Mentions retain UUIDs and
backlinks; they do not generate factual relations. Sessions have an index page
in the Codex linked via backlink to the diary. Ambiguous aliases are not
merged. Photos, notes, reports, and personal profiles remain in `.tools/` ignored.
The conversion does not promise full Logseq format equivalence: for doubts
consult the original source and the import report.


## Version 0.2.0 — Windows distribution

The novelties include animated dragons on the extremes of the single die and alphabets
Espruar/Dethek with local fonts. The replay preserves the original throw.
The Windows app packages + Gemma 4 12B offline are documented in
[INSTALLERS.md](INSTALLERS.md) and in the [notes 0.2.0](releases/v0.2.0.md).
For the app alone, use the ZIP Installer-Windows-x64. For app + AI, download the
remaining five ZIPs; extract only the Windows-x64 and use
Installa-AI.cmd for the other four. No personal data or training is included.

The 0.2.0 publication is currently in draft: HTTP gateway 502 on large AI
attachments. Complete packages available locally; real status in docs/STATUS.md.

