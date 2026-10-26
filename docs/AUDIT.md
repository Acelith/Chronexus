# Chronexus code audit — M23 (26 October 2026)

Scope: source version 0.8.1 from `6399a1b` (schema 018) to `bcad8d6`, plus the
platform checks requested for M6 and M16. Work was done on macOS (arm64), with Linux
verified in Docker (arm64 native, x64 emulated). Windows was not re-run in this pass.
Every fix is committed per topic; nothing was pushed or published. M24 (sharing
client, schema 019) followed in `11de3ef` and `fdaf4d2`.

Passing tests show the absence of the regressions they cover, not of all bugs.

## 1. Executive summary

The codebase is healthy for a single-user offline desktop app: parameterized,
revision-checked and transactional persistence; defensive backup/restore; hardened
network clients; a minimal Tauri surface. The audit fixed one high-severity defect
(the MCP bridge on macOS), removed the UI freeze during long archive operations,
made campaign search about 550 times faster on large campaigns, and closed several
correctness, i18n and maintainability issues.

| ID | Severity | Status | Summary | Commit |
| --- | --- | --- | --- | --- |
| A-01 | High | Fixed | MCP bridge truncated/refused replies (RST on close, inherited non-blocking sockets) | `fa27012` |
| A-08 | Medium | Fixed | Archive commands ran on the main thread and froze the UI during backups | `97e8eb8` |
| A-10 | Medium (perf) | Fixed | Campaign and assistant search re-ran FTS per document (10 s on 12 000 blocks) | `89b37a7` |
| A-02 | Medium | Fixed | Rust suite red on macOS (platform fixture), duplicated platform constants | `08e7195` |
| A-03 | Medium | Fixed | Every constraint failure reported as a duplicate session number | `4ca1cc8` |
| A-04 | Medium | Fixed | i18n scanner skipped every Rust message after a raw string | `8bf6b75` |
| A-09 | Low | Fixed | 17 live diagnostics missing from the English catalogue | `3485427` |
| A-05 | Low | Fixed | Italian diagnostics left after M26 | `4ca1cc8` |
| A-06 | Low | Fixed | Four divergent bounded-read/atomic-write JSON helpers | `fee0dd2` |
| A-07 | Low (perf) | Fixed | N+1 alias queries in `list_pages` | `2419419` |
| O-04 | Low | Fixed | Renaming a page with 20 aliases failed with a misleading message | `931fb46` |
| O-06 | Low | Fixed | Closing the window during an operation was silently ignored | `931fb46` |
| A-11 | Info | Done | Ticinese, Klingon and Romulan options removed (M23 scope, user confirmed) | `1826a4e` |
| A-12 | High | Fixed | Updater pulled zip 4.6.1 with RUSTSEC-2026-0367/0368/0369 (legacy bundle extraction) | see §3 |

## 2. Architecture after the audit

```
React (src/, Vite, lazy chunks per workspace and locale)
  App.tsx (shell state) ─ features/shell (sidebar, tabs) ─ features/<domain>
    └─ api.ts ── invoke() ──► commands/<domain>.rs (async)
                                └─ Database::run / run_store (blocking pool)
                                     └─ Store (one rusqlite connection, schema 001–019)
  Other modules: assistant, ai_setup, updates, backup_folder, automation (MCP),
  sync (M24 client), json_file (shared preference I/O), test_support (tests only)
```

- `lib.rs` went from 1 096 to about 330 lines: commands live in
  `commands/{ai, archive, campaign, knowledge, player, settings, sync, wiki}.rs`.
- `App.tsx` went from 1 433 to about 1 100 lines: sidebar, campaign tabs, periodic
  backup notice and entry forms are separate components with one navigation helper.
- One `usePendingAction` hook replaces four copies of the panel pending/error/notice
  logic; panels with named phases (AI setup, updates) and the restore workspace keep
  their own logic on purpose.
- One loopback HTTP fake (`test_support`) serves the network tests of four modules.

## 3. Findings

### A-01 — MCP bridge replies lost or refused (High, fixed)

Closing a socket with an unread request body made the kernel send RST and discard
the reply; on BSD/macOS accepted sockets also inherited `O_NONBLOCK` from the
polling listener (verified with a standalone program), refusing slow clients with
400. Fix: blocking accepted streams, one-buffer replies, half-close and bounded
drain. A regression test fails on the old code; the suite passed 8/8 consecutive runs.

### A-08 — Main-thread archive commands (Medium, fixed)

Tauri runs non-async commands on the main thread; most archive commands waited on
the Store mutex there. `Database::run/run_store` now wait on the blocking pool;
preference files are read without the lock; busy/epoch checks that must happen under
the lock still do (AppHandle state lookup, shared wikidot epoch counter). Measured
in the real macOS app with the IPC harness: during a 3.9 s backup a lock-free command
answered in at most 1 ms, versus 3 869 ms on the previous commit. The same check
passes on Linux arm64 (worst 2–3 ms). Commands may now run concurrently; the Store
mutex still serializes archive access and revisions guard writes.

### A-10 — Full-text search join order (Medium, performance, fixed)

`EXPLAIN QUERY PLAN` showed SQLite scanning the campaign's documents and re-running
the FTS5 query for each. `CROSS JOIN` keeps the match as the outer loop, in campaign
search and in the assistant's lexical retrieval. A plan test fails on the old join.
A first hypothesis (computing snippets before the limit) was measured, did not help,
and was dropped.

### A-02 to A-07, A-09, O-04, O-06

See the commit messages above: platform executable constants; accurate constraint
messages; scanner tokenizer for raw strings, char literals and comments; diagnostics
catalogued in English and Italian; shared `json_file` (no symlinks, bounded reads,
atomic writes, directory sync); one alias query per campaign; an explicit message when
a rename cannot keep the old title as alias; a visible message when closing during an
operation. The close message has no automated test (App tests run without the Tauri
window API).

### A-11 — Language options removed (M23 scope)

Saved Ticinese preferences open in Italian, Klingon/Romulan in English, keeping the
script choice. Ticinese wiki translations already saved remain valid archive data, so
existing archives still back up and restore (test added).

### A-12 — Dependency vulnerabilities (High, fixed)

Scan run with user approval on 26 October 2026: `cargo audit` 0.22.2 (RustSec
database, 1 378 advisories) and `pnpm audit` 11.25.0.

- **Rust, before:** 3 vulnerabilities in `zip 4.6.1` (RUSTSEC-2026-0367 SUID/SGID
  bits, 7.3 high; -0368 symlinks outside the destination; -0369 permissions through
  symlinks, 9.1 critical), pulled only by `tauri-plugin-updater 2.14.0` (latest
  stable) through its default `zip` feature. The plugin calls `ZipArchive::extract`
  only on Windows for legacy Tauri v1 bundles (`.msi.zip`, `.exe.zip`); updates are
  signature-checked first, so exploitation required a validly signed archive.
- **Fix:** the updater is used with `default-features = false` and only
  `rustls-tls` and `system-proxy`. Chronexus publishes v2 artifacts only
  (`createUpdaterArtifacts: true`; the publisher accepts only `_x64-setup.exe` and
  `latest.json`), and macOS `.app.tar.gz` updates use tar/flate2 as unconditional
  macOS dependencies of the plugin. `zip 4.6.1` is gone from `Cargo.lock`.
- **Rust, after:** 0 vulnerabilities (520 crates). Two warnings remain, both
  transitive through Tauri's GTK3 stack on Linux and not fixable here:
  `glib 0.18.5` unsound `VariantStrIter` (RUSTSEC-2024-0429; not used by Chronexus)
  and unmaintained build-time `proc-macro-error` (RUSTSEC-2024-0370).
- **npm:** `pnpm audit` reports no known vulnerabilities.
- **Verified:** Rust tests 152/152 and clippy on macOS and Linux arm64. A Windows
  target check could not run on macOS (`ring` needs MSVC headers): the Windows
  updater path must be checked at the next Windows build.
- **Licences (offline review):** 520 crates and 309 npm packages, no GPL; MPL-2.0
  (BlockNote, cssparser/selectors, dtoa-short, option-ext) and CDLA-Permissive-2.0
  (webpki-root-certs) need attribution in third-party notices.

### Remaining observations

| ID | Severity | Observation |
| --- | --- | --- |
| O-01 | Low | A poisoned Store mutex is reported as "Archive busy" until restart; no panicking path found in command code. |
| O-02 | Low | Detached image files stay on disk and in backups (likely intentional; product decision). |
| O-03 | Low | Alias uniqueness is checked for titles only; ambiguous aliases are allowed by design. |
| O-05 | Low | Backups are capped at 512 MiB while each image may be 20 MiB. |
| O-07 | Low | On today's live Wikidot homepage, background rows are grouped under lineage headings ("All Lineages › Setting Specific"); entries parse correctly. Not changed without a fixture review. |

## 4. Database

- Schema 001–019 (019 added by M24 sharing, additive). Composite foreign keys keep
  campaign boundaries; `ON DELETE RESTRICT`; CHECK constraints for enums and sizes.
- New test: backups written at every schema version 2–19 restore into the current
  one and migrate.
- Query plans checked: backlinks, alias listing, asset/relationship/image lookups,
  dice and assistant history are index searches by campaign; no index migration was
  needed. The FTS join was the only measured bottleneck (A-10).

## 5. Performance (release build, macOS arm64, synthetic campaign)

Benchmark: `cargo test --release --lib perf_ -- --ignored --nocapture`
(300 sessions × 40 blocks with mentions, 2 000 pages × 3 aliases, 1 000 relationships,
13.3 MiB).

| Operation | Before | After |
| --- | --- | --- |
| Search "guild debt" (relevance) | 9 992 ms | 18.8 ms |
| Search "mill" (recent) | 2 144 ms | 17.8 ms |
| `list_pages` (3 000 pages, separate run) | 15.2 ms | 4.4 ms |
| Open archive | 0.28 ms | — |
| `list_sessions` with documents | 6.2 ms | — |
| Save session document (index + search) | 2.1 ms | — |
| Graph, bounded view | 5.7 ms | — |
| Rebuild search index | 715 ms | — |
| Write verified backup | 234 ms | — |

Desktop: peak Rust process RSS about 250 MiB during the IPC flows with three
1 400 px images (debug build); release build idle about 130 MiB. Frontend bundle:
largest chunks are the graph canvas (443 kB, 141 kB gzip) and the editor; locales
are lazy.

## 6. Security

Fixed: A-01; interface preferences no longer follow symlinks (A-06). Reviewed with
no issue: loopback MCP bridge (token, constant-time compare, Origin/Host checks,
limits), updater/Wikidot/Ollama/runtime HTTP clients, image import limits, backup ZIP
parsing, CSP and capabilities. M24 client: HTTPS only, no redirects, bounded and
validated responses, token outside backups with 0600 permissions, remote text
rendered as text. Residual: the two transitive GTK3 warnings in A-12; Windows updater path to re-check on Windows.

## 7. Platforms (M6 and M16)

| Check | macOS arm64 | macOS x64 | Linux arm64 | Linux x64 |
| --- | --- | --- | --- | --- |
| Rust tests, clippy, fmt | PASS (152 with M24) | — | PASS (152 with M24) | PASS (146 before M24, emulated) |
| Release bundle | .app + .dmg (checksum verified) | .app + .dmg (checksum verified) | .deb | .deb |
| Installed/started, archive created | PASS (isolated HOME, schema 18) | not run: no Rosetta | PASS (clean Debian) | PASS (clean Debian, emulated) |
| Real WebView IPC flows | 15/15 with the window visible; later runs stall after the backup step while the session is idle (WebKit suspends hidden pages; same on the old binary) | — | 16/16 (WebKitGTK under Xvfb, with M24) | — |
| Wikidot parser on live pages (M16) | PASS (574 spells, 199 feats, 247 class rows, 102 backgrounds, 83 species, 882 items) | — | — | — |

macOS packages are ad-hoc signed only (no Developer ID, no notarization). AppImage,
Windows ARM64 and a Windows re-run were not done. The 93 M16 wiki strings were
translated into the eight other languages (machine-prepared, native review open).

## 8. Tests

| Check | Baseline | Now |
| --- | --- | --- |
| Rust unit (macOS) | 134 pass, 2 fail | 152 pass, 0 fail, 2 ignored (Wikidot fixture, perf) |
| Vitest | 172 | 171 (5 removed with the fantasy locales; hook and M24 tests added) |
| tsc, ESLint, Prettier, catalogue check, vite build | pass | pass |
| MCP stdio | 5/5 | 5/5 |
| Scanner / IPC harness | 1/1 / — | 2/2 / 16 flows |

Not run: Windows, Playwright CDP scripts, real model runs, Python training tools.

## 9. Technical debt

| Priority | Item | Cost | Depends on |
| --- | --- | --- | --- |
| 1 | Re-check the Windows updater build and install path without the `zip` feature | 0.5 day | Windows machine |
| 2 | Third-party licence notices bundled with releases (MPL-2.0, CDLA) | 0.5 day | — |
| 3 | macOS Developer ID signing and notarization | 1 day | Apple developer account |
| 4 | Translations of the new diagnostics and M24 strings beyond Italian | 1 day | native review |
| 5 | Split the main workspace rendering out of `App.tsx` | 1 day | — |
| 6 | Lighter `list_pages`/`list_sessions` payloads, cached thumbnails | 1 day | measurements on real data |

## 10. Next

M25 Chronexus Server in its own repository (docs/SERVER_NOTES.md), then M27 Android.
Windows re-verification at the next authorized build.
