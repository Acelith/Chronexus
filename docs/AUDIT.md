# Chronexus code audit — M23 (first pass, 26 October 2026)

Scope: source version 0.8.1 on `main` at `6399a1b`, schema 018. Audit and fixes were
performed on macOS (arm64). The working tree was clean before the audit; every change
listed below was introduced by this audit and committed per topic after user approval:
`fa27012` (A-01), `08e7195` (A-02), `8bf6b75` (A-04), `4ca1cc8` (A-03, A-05),
`fee0dd2` (A-06), `2419419` (A-07). Nothing was published.

This is a **partial** audit. It is not a certification that the application is bug
free: passing tests only show the absence of the regressions they cover.

## 1. Executive summary

**Overall state.** The codebase is in good health for a single-user offline desktop
app. Persistence is consistently parameterized, revision-checked and transactional;
backup/restore is defensive (bounded ZIP parsing, checksums, schema replay,
generation switch with safety copy, no-clobber publishing). Network clients are
hardened (manual same-origin redirects, HTTPS only, timeouts, size limits). The
Tauri surface is minimal (no frontend filesystem/network plugins, strict CSP).

**Main problems found.**

| ID | Severity | Status | Summary |
| --- | --- | --- | --- |
| A-01 | High | Fixed | MCP automation bridge truncated or refused replies (RST on close; inherited non-blocking sockets on macOS) |
| A-02 | Medium | Fixed | Rust test suite red on macOS: platform-specific Ollama fixture; duplicated platform constants |
| A-03 | Medium | Fixed | Every SQLite constraint failure was reported as a duplicate session number |
| A-04 | Medium | Fixed | i18n scanner silently skipped every Rust message after a raw string |
| A-05 | Low | Fixed | Italian diagnostics left in Rust after M26 |
| A-06 | Low | Fixed | Four divergent copies of bounded-read/atomic-write JSON helpers |
| A-07 | Low (perf) | Fixed | N+1 alias queries in `list_pages` |
| A-08 | Medium | Open | Synchronous Tauri commands run on the main thread and can freeze the UI while the Store is locked |
| A-09 | Low | Open | ~45 live Rust diagnostics missing from the English catalogue |

**Baseline → after.** Rust: 134 pass / 2 fail → **140 pass / 0 fail** (8 consecutive
runs). Vitest 172/172, TypeScript, ESLint, Prettier, Clippy `-D warnings`, rustfmt,
i18n catalogue check, MCP stdio 5/5 unchanged and green.

**Limitations.** No dependency vulnerability scan (no offline `cargo audit`/advisory DB;
`npm audit` would upload the dependency list to a registry, which the M23 plan excludes).
No native GUI, Windows, Linux, installer or real-model runs. The assistant/training,
wiki translation and dice modules were reviewed only for panics, slicing and network
boundaries, not line by line. See §8 and §9.

## 2. Current architecture

```
React (src/, Vite, lazy feature chunks)
  └─ features/<domain>/api.ts ── invoke() ──► Tauri commands (src-tauri/src/lib.rs, ~90)
                                               ├─ Database(Arc<Mutex<backup::Store>>)
                                               │    └─ one rusqlite Connection, schema 001–018
                                               ├─ domain modules: journal, knowledge, graph,
                                               │  player, party, images, search, dice, catalog,
                                               │  wiki, wikidot, wiki_translation, export, backup
                                               ├─ assistant/ (local Ollama loopback, RAG, QLoRA)
                                               ├─ ai_setup/ (M22 pinned runtime/model setup)
                                               ├─ updates/ (Tauri updater + herald policy)
                                               ├─ backup_folder/ (M19 periodic backups)
                                               └─ automation/ (opt-in loopback MCP bridge,
                                                  shares the Store via try_lock)
```

Responsibilities are separated by domain; SQL lives only in Rust domain modules;
derived data (mentions, FTS index) is written in the same transaction as the source
document. Revision columns give optimistic concurrency to GUI and MCP writers.

Architectural observations:

- **`lib.rs` (1 100 lines)** mixes command registration, dialog plumbing and several
  inline flows (wiki loading, AI setup). Splitting commands per domain is planned in
  M23.3; it is mechanical and was not attempted in this pass.
- **`App.tsx` (1 430 lines)** owns navigation, campaign loading, save guards and many
  views. The save-guard design (flush before every navigation/close, block on failure)
  is correct; the component should still be split (M23.3).
- **A-08 — main-thread commands.** Tauri runs non-`async` commands on the main
  thread. Most DB commands are synchronous and wait on the Store mutex; while a
  periodic backup, export or restore holds it (seconds for large archives), any such
  command blocks the UI thread. Recommended fix: `#[tauri::command(async)]` or
  `spawn_blocking` for DB commands, one domain at a time, with the save-ordering tests
  re-run. Not changed here: it alters scheduling of every command and needs desktop
  verification.

## 3. Problems found

### A-01 — MCP bridge replies lost or refused (High, fixed)

- **Files:** `src-tauri/src/automation/transport.rs` (`serve`, `response`).
- **Root cause (verified):**
  1. On refusal (401/403/413…) the server closed the socket without reading the
     request body. Closing with unread input makes the kernel send RST, which can
     discard the reply before the client reads it. The client saw `"HTTP/1.1 "` only.
     The reply was also written in two `write` calls, widening the window.
  2. The listener polls in non-blocking mode. On BSD/macOS, accepted sockets inherit
     `O_NONBLOCK` (verified with a standalone program: `read` → `WouldBlock`), so a
     client whose header had not arrived yet was refused with 400 before
     authentication.
- **Impact:** the known "flaky" `transport_auth_origin_scoping…` test failed every run
  on macOS; real MCP clients could receive empty replies or spurious 400s.
- **Fix:** accepted streams are set to blocking mode; the reply is written in one
  buffer, then the socket is half-closed and up to the body limit is drained for at
  most 2 s before closing.
- **Tests:** new `slow_clients_are_served_and_refused_bodies_do_not_truncate_replies`
  (delayed header + 20 refused 64 KiB bodies) fails on the original code and passes
  after the fix; the existing transport test passes; automation suite 10/10 on five
  consecutive runs and the full suite 8/8 runs.

### A-02 — Platform-specific setup test and duplicated constants (Medium, fixed)

- **Files:** `src-tauri/src/ai_setup/{mod.rs,download.rs,tests.rs}`, `lib.rs`.
- **Root cause:** the install test always packed `ollama.exe`, while extraction on
  non-Windows expects `ollama`. The executable name was spelled in two places and the
  supported-platform condition in two others.
- **Fix:** `ai_setup::EXECUTABLE` and `ai_setup::SUPPORTED_PLATFORM` are the single
  source for extraction, receipt checks, status and the install command; the test
  fixture uses `EXECUTABLE`. Behaviour is unchanged (install remains Windows x64 only).
- **Tests:** `ai_setup` suite 5/5 on macOS (previously 1 failure).

### A-03 — Misleading constraint error (Medium, fixed)

- **File:** `src-tauri/src/journal.rs` (`storage`).
- **Root cause:** any `ConstraintViolation` (foreign key, CHECK, other UNIQUE) became
  "check that the session number is unique in the campaign".
- **Fix:** that message is kept only when SQLite names `sessions.sequence`; other
  constraint failures get "Invalid operation: the change conflicts with existing or
  linked data. Reload and try again; nothing was saved." (catalogued in English and
  Italian; other locales fall back to English).
- **Tests:** `only_duplicate_session_numbers_report_the_session_number_message`.

### A-04 — i18n scanner lost Rust messages (Medium, fixed in tooling)

- **File:** `scripts/i18n/scan.mjs`.
- **Root cause:** the Rust string regex paired quotes naively; a raw string such as
  `r"\\?\"` (in `ai_setup/mod.rs`) or a `'"'` char literal desynchronized it, hiding
  every later message of the file. Running `pnpm i18n:scan` would drop ~94 catalogue
  entries that are still in use.
- **Fix:** `rustStrings()` consumes comments, raw strings and char literals before
  ordinary strings; exported and covered by a regression test in
  `scripts/i18n/test_scan.mjs`.
- **Not done:** the catalogue was **not** regenerated (see A-09).

### A-05 — Italian diagnostics after M26 (Low, fixed)

`assistant/training.rs` (3), `ai_setup/mod.rs` (1), `backup.rs` (1) and a debug-only
message in `lib.rs` were still Italian. Translated to English and catalogued with the
previous Italian text in `it.json`, so Italian users see the same wording. Folder
names `Backup periodici`/`Backup aggiornamenti` and the `prima-del-ripristino-` prefix
are storage identifiers and were intentionally left unchanged.

### A-06 — Duplicated JSON preference I/O (Low, fixed)

- **Files:** new `src-tauri/src/json_file.rs`; callers `preferences.rs`,
  `wiki_provider.rs`, `updates/herald.rs`, `backup_folder/mod.rs`.
- **Problem:** four implementations with diverging guarantees: the interface
  preferences followed symbolic links and read the whole file before checking its
  size; only backup preferences synced the directory after the rename; Windows
  junction detection existed only in `backup_folder`.
- **Fix:** `read_bounded` (no links/junctions, size checked before and during the
  read) and `write_atomic` (refuses link destinations, temp file + fsync + rename +
  best-effort directory sync). Every caller keeps its exact user-facing messages.
- **Behaviour change:** a symlinked `interface-preferences.json` is now reported as
  damaged instead of being followed (consistent with the other files). A directory
  sync failure after a committed rename no longer reports the backup preferences as
  unsaved.
- **Tests:** `json_file::tests` (missing, oversize, directory and symlink cases;
  symlink target untouched); existing preference, wiki, herald and backup-folder
  tests pass.

### A-07 — N+1 alias queries (Low, performance, fixed)

`knowledge::list_pages` ran one alias query per page. It now loads all aliases of the
campaign in one indexed query. See §6 for measurements; test
`listed_pages_keep_their_own_sorted_aliases_within_the_campaign`.

### A-08 — Main-thread synchronous commands (Medium, open)

See §2. Proposed fix and cost in §9.

### A-09 — Uncatalogued backend messages (Low, open)

With the corrected scanner, ~45 live Rust diagnostics are not in `en.json` (e.g.
"The page metadata changed elsewhere…" was added in this pass; others such as
"Stop the managed runtime first." remain), so they are never translated. A full
`i18n:scan` also removes entries built dynamically elsewhere; the regeneration must be
reviewed key by key, not applied blindly.

### Other observations (open, by design or product decisions)

| ID | Severity | Observation |
| --- | --- | --- |
| O-01 | Low | A poisoned Store mutex (panic in a command) is reported as "Archive busy" and blocks the archive until restart. No panicking path was found in command code (`unwrap` only after validation, slicing on char boundaries). |
| O-02 | Low | Detaching an image removes the row but keeps the file, which is still included in backups and counts toward the 512 MiB backup limit. Likely intentional (no user-data deletion); needs a product decision. |
| O-03 | Low | Alias uniqueness is checked only for titles: an alias may equal another page's title or alias. Consistent with "ambiguous aliases stay explicit", but the duplicate-name message implies otherwise. |
| O-04 | Low | Renaming a page that already has 20 aliases fails, because the old title is appended as alias before the 20-alias check. |
| O-05 | Low | Backups are capped at 512 MiB total while each image may be 20 MiB; large illustrated archives cannot be backed up. Product limit, documented in the error. |
| O-06 | Low | Closing the window while another operation runs is ignored without feedback (`run` returns early). |

## 4. Database analysis

- **Schema (001–018):** UUID text keys, composite `(campaign_id,id)` foreign keys that
  prevent cross-campaign references, `ON DELETE RESTRICT` everywhere, `CHECK`
  constraints for enums, lengths and JSON validity. Mentions intentionally keep
  missing targets by ID (no FK) for explicit recovery.
- **Migrations:** each runs in its own transaction and records its version; no
  destructive statements (018 only disables retired models). Restores replay the
  migration chain and compare the full `sqlite_master` schema, so any new migration
  is automatically covered by backup validation.
- **Query plans:** checked with `EXPLAIN QUERY PLAN` for backlinks, alias listing,
  asset/relationship/image lookups, dice and assistant history: all are index
  searches scoped by `campaign_id` (covering indexes for history/backlinks). Child-row
  FK checks on `player_assets`/`relationships` scan within a campaign; acceptable at
  single-user scale, so **no index migration was added** (no measured need).
- **Integrity risks:** none found. Writes use optimistic revisions; derived rows
  commit with their sources; `foreign_key_check` and `integrity_check` run on every
  backup and restore.
- **Optimizations implemented:** A-07 only.

## 5. Refactoring

- Shared `json_file` module replaces four helpers (A-06).
- Single `EXECUTABLE`/`SUPPORTED_PLATFORM` constants (A-02).
- `rustStrings()` extracted and tested in the i18n scanner (A-04).
- No dead code removed: no unused dependency or module was found (Mantine packages
  are BlockNote peer dependencies).

## 6. Performance

| Measurement (release build, macOS arm64, synthetic campaign) | Before | After |
| --- | --- | --- |
| `list_pages`, 3 000 pages × 2 aliases, mean of 10 calls | 15.2 ms | 4.4 ms |

The benchmark was a temporary ignored test, removed after measuring. Frontend: the
production build already splits locales, editor, graph and every workspace into lazy
chunks (largest: graph canvas 443 kB / 141 kB gzip). Recommended next steps, not
done without measurements on real data: `list_pages` returns every page document
(payload grows with notes); image thumbnails are decoded and re-encoded on every
request; vitest creates jsdom 41 times (≈50 % of test time).

## 7. Security

- **Fixed:** A-01 (availability/robustness of the authenticated loopback bridge),
  A-06 (interface preferences no longer follow symbolic links; bounded reads).
- **Reviewed, no issue found:** loopback-only bridge with per-launch 256-bit token,
  constant-time comparison, Origin/Host checks, body limits; updater, Wikidot,
  Ollama-download and runtime HTTP clients (no automatic redirects, same-origin or
  allowlisted redirects, HTTPS, timeouts, size limits, cancellation); image import
  (format allowlist, dimension/pixel/allocation limits, no source path retained);
  backup ZIP parsing (path allowlist, duplicates, special files, sizes, checksums,
  `trusted_schema=OFF`); CSP and capabilities (no frontend fs/shell/http plugin).
  No secrets in tracked files were found in the reviewed paths.
- **Residual:** no dependency CVE scan (see §8); a local process with the user's
  rights can still read the discovery token while the bridge is enabled (documented
  opt-in design).

## 8. Tests and validation (actually executed, macOS arm64)

| Check | Baseline | After |
| --- | --- | --- |
| `cargo test --locked` (unit) | 134 pass, 2 fail, 1 ignored | **140 pass**, 0 fail, 1 ignored; 8 consecutive runs |
| Updater integration test | 1 pass, 1 ignored | 1 pass, 1 ignored |
| `cargo clippy --all-targets -D warnings`, `cargo fmt --check` | pass | pass |
| Vitest | 172/172 | 172/172 |
| `tsc --noEmit`, ESLint, Prettier check | pass | pass |
| i18n catalogue check (`prepare-catalogs --check` + i18n vitest) | pass | pass |
| MCP stdio (`node --test scripts/automation/mcp-check.mjs`) | 5/5 (STATUS) | 5/5 |
| Scanner tests (`scripts/i18n/test_scan.mjs`) | 1/1 | 2/2 |
| `vite build` | pass | pass |

New tests: 1 automation transport, 1 knowledge, 1 journal, 1 json_file, 1 scanner.

Not run: Windows/Linux builds and tests, native GUI flows, installer/upgrade, real
Ollama/model runs, Python release/training tools, Playwright QA scripts, dependency
audits. Coverage is not measured by the project tooling.

## 9. Technical debt

| Priority | Item | Impact | Indicative cost | Depends on |
| --- | --- | --- | --- | --- |
| 1 | A-08 async DB commands | UI freezes during long Store operations | 1–2 days incl. desktop QA | — |
| 2 | Dependency/licence audit (`cargo audit`, `cargo deny`, pnpm audit) | Unknown CVE exposure | 0.5 day once tools/advisory DB are approved | user approval for tool install/network |
| 3 | A-09 catalogue regeneration review | Untranslated diagnostics | 0.5 day + translations | A-04 (done) |
| 4 | Split `lib.rs` per domain, split `App.tsx` | Maintainability | 2–3 days | — |
| 5 | O-04 alias limit on rename, O-03 alias policy | Edge-case failures, confusing message | 0.5 day | product decision for O-03 |
| 6 | Lighter `list_pages` payload / cached thumbnails | Large campaigns | 1 day | measurements on large data |
| 7 | O-02 orphan image files | Backup size | 0.5 day | product decision |

M23 roadmap items still open: removal of the Ticinese/Romulan/Klingon options (a
functional change that needs explicit confirmation), the remaining M23.3 unifications
(fake test servers, `perform`/waiting states in React panels) and desktop testing of
the main flows on an isolated profile.

## 10. Recommended roadmap

1. A-08 async commands, domain by domain, verified on Windows desktop.
2. Offline dependency/licence audit once the tooling is approved.
3. Catalogue review (A-09) and translations.
4. `lib.rs`/`App.tsx` split and remaining M23.3 unifications, without format,
   schema or identifier changes.
5. Measured optimizations (page payload, thumbnails) on large synthetic campaigns.
