# Chronexus status — 26 October 2026: open milestones reprioritized

- Planning only, no code change: ROADMAP gains M28–M40 and a priority table for
  all open milestones (M28, M29, M30, M25, M31–M40, then M27). M25 is recorded as
  in progress (server S1–S7 in source 0.1.0; S8, release and deployment open).
- Next milestone by priority: **M28 — complete translations and multilingual
  installer**, which also clears the localization blocker below. Nothing starts
  without an explicit request.

# Chronexus status — 26 October 2026: mandatory localization gate and audit

- AGENTS.md, I18N.md and DEVELOPMENT.md now require localization review on EVERY
  interface change, including layout/accessibility/confirmation states and native
  installers. CI and the signed-release wrapper run the stricter `i18n:check`.
- New read-only audit checks 1,303 explicit UI messages, all nine translation catalogs,
  stable English source registration, parameters and the ten native installer languages.
  Detailed findings: docs/I18N_AUDIT.md. No baseline reset or copied-English bypass.
- Corrected 95 Italian translations, uncatalogued short labels/Italian source fragments,
  the herald startup checkbox in all nine translations and server role display labels.
  Italian explicit-UI gaps 64 -> 0; unregistered sources 15 -> 0 (s/d are invariant symbols).
- The full localization gate intentionally FAILS (exit 1): 267 UI messages remain
  untranslated in each of the other eight catalogs; NSIS remains Italian-only.
  Signing wrapper tested to stop BEFORE reading keys/building. Do not claim complete
  localization or publish a replacement installer from this incomplete inventory.
- Also fixed a genuine localization bug: translated combat section titles caused
  inspiration/death-save controls and summary to disappear. Match the stable field
  key instead; the new Italian test failed before the fix and now passes.
- Executed: 7 scanner/audit regressions; 182 frontend tests; targeted locale/sharing/
  updates 31 tests; TypeScript, ESLint, Vite build, catalog normalization passed.
  React Doctor changed scope: no diagnostics, score 83 before/after the combat fix.
  Changed-file formatting passed; full format check finds 78 unchanged files, documented
  separately from the localization gate.
  Fresh native layout/RTL/installer and Rust tests not rerun; no Rust/domain/schema change.
- Skills: systematic-debugging for the permissive old check; react-testing for localized
  confirmations/catalog regressions; react-doctor for changed React diagnostics.
- Source maintenance only, no version bump/new app release; public 0.9.2 remains immutable.
  Localization blockers above precede another signed build. Next functional roadmap
  milestone remains M25 deployment/TLS acceptance, followed by M27 Android.

# Chronexus status — 26 October 2026: 0.9.2 installer branding published

- NSIS now uses the existing Chronexus herald/wordmark: leather/brass/burgundy
  welcome/finish sidebar, compact header, explicit installer/uninstaller icons and
  matching uninstaller header. Standard native text, workflow, per-user mode and
  passive updater behavior remain; no custom NSIS template or new dependency at build.
- Generated RGB BMPs are committed (150x57 header, 164x314 sidebar). Reproducible
  Pillow compositor in `scripts/release/installer_branding.py` reads the approved
  originals only; source images unchanged. Artwork aspect ratios preserved.
- Verified Windows x64 signed NSIS build (including frontend TypeScript/Vite build),
  production signature/tamper test, all 27 release-tool tests, bitmap dimensions/RGB
  format, generated NSIS image/icon definitions, and diff whitespace. No domain code
  changed; full React/Rust suites were not rerun for packaging-only branding.
- Native wizard inspected with Computer Use after explicit authorization: welcome
  page, icon and directory-page header rendered correctly with readable ordinary
  headings/controls. Cancelled before installation; no installer window remained.
  Finish/uninstaller execution, actual install/upgrade and other platforms unverified.
- Published 0.9.2 from `ad68875`, tag `v0.9.2`, release ID 11. All three unique
  attachments passed anonymous SHA-256 verification, canonical manifest and public
  stable API checks. Installer: 34,118,247 bytes, SHA-256
  `11553df57cf6f4c75299fc2bc983d83b287a1a943619c363ea121ceb82098256`.
  Older published assets remain intact.
  Includes the 0.9.1 backup/startup fixes, schema 021 and automatic migrations unchanged.
- Skills: tauri-v2 for native bundle configuration, impeccable for preserving the
  existing visual identity, computer-use for the actual Windows wizard inspection.
  Impeccable mechanical detector returned no findings on the changed asset/config targets.
  Next functional roadmap work remains M25 deployment/TLS acceptance, then M27.

# Chronexus status — 26 October 2026: 0.9.1 hotfix published

- Reproduced the installed schema 018 backup failure: `dice_rolls` and
  `wiki_translations` differed from migration references only by CRLF/LF layout.
  Backup validation now normalizes SQL layout newlines, preserving quoted values
  and identifiers exactly. Integrity, schema objects/constraints, migration history,
  references, content and attachment checks remain enforced. No schema change.
- Regression failed before the fix; mixed Windows/Unix schemas 018 and 021 now back
  up, restore and automatically migrate to 021 with stable campaign/session IDs.
  Existing archives already migrate in `db::open`; no manual SQL is required.
- Startup checks run once at every launch unless disabled, including when the last
  check was recent. Wait for the update gate instead of dropping a busy startup
  check. Reminders, dismissals, idle display, signature and mandatory backup remain.
- Windows real WebView, isolated synthetic profile: recent-check herald visible,
  keyboard/focus/Escape and Axe (zero violations) passed; immediate restart checks
  again, respects the reminder and a repeated call does not recheck in the session.
- Checks: Rust lib 170 passed / 7 ignored; Vitest 179 passed with two workers (first
  unrestricted run had an unrelated ImageGallery 5 s timeout); TypeScript, ESLint,
  i18n normalization check, Vite build, rustfmt and all-target Clippy passed.
  React Doctor changed scope: no issues, 88/100. Updated the native herald QA script
  for the new launch policy and current English labels, waiting for WebView navigation.
- Installed archive opened read-only: verified .nodex backups created outside Git;
  an extracted copy migrated 018 -> 021 and produced another verified backup with
  unchanged counts. The installed source was not migrated/replaced during QA.
- 0.9.1 signed Windows x64 installer published from `f705438`, tag `v0.9.1`, release
  ID 10. Production signature/tamper test, all three anonymous asset SHA-256 checks,
  canonical manifest and latest API passed. Release tooling: 27 tests passed.
  Installer SHA-256: `ea9cba017cff6eb27243547ec176fd7248e3ef27d061f16d79fd311cbf8d2998`.
  Old installed updater
  code cannot repair itself: bootstrap this hotfix with its manual installer after
  preserving the verified backup. Actual installation/upgrade and other platforms
  remain unverified. Next roadmap work remains M25 deployment/TLS acceptance, then M27.
- Skills: systematic-debugging, rust-best-practices, sqlite-expert, tauri-v2,
  react-testing, react-doctor and webapp-testing for diagnosis, validation and native QA.

# Chronexus status — 26 October 2026: release 0.9.0 published

Windows x64 installer 0.9.0 (schema 021) published and verified on github.com, tag `v0.9.0`
(`d88425e`); Chronexus Server 0.1.0 published the same day. Other platforms, installer
installation/upgrade and the Docker image remain unbuilt or unverified; see docs/INSTALLERS.md.

Release follow-up verification: the production signature test executable passed on the
real installer and rejected tampering; all 27 release-tool unit tests passed. The Cargo
wrapper could not finish because the running debug app locked `chronexus.exe`, so the
already-built signature test executable was run directly. Two concurrent publishers
created six attachments; all six passed anonymous SHA-256 checks, then duplicate IDs
31, 34 and 35 were removed with explicit user approval. Exactly three unique assets
remain (30, 32, 33); the anonymous stable API and canonical manifest checksum pass.
No application code, schema, signing key or release tag changed in this follow-up.
Skill applied: `systematic-debugging` for the locked binary, credential context and
concurrent publication investigation. ROADMAP still lists M25 server acceptance next;
its server binary is now published separately, while deployment/TLS acceptance remains
open, followed by M27 Android (not started).

# Chronexus status — 26 October 2026: S5/S6/S4 desktop replication (schema 021)

Not published; source version 0.8.1, schema 021. Server side: `Chronexus-Server` commit
3e4629d (S5 incremental sync, idempotent mutations, notifications).

- **What works:** each page, session, relationship or party member can stay on this device,
  be replicated **privately** to the same account's other computers, or be **shared**. A
  campaign switched to automatic synchronization sends changes a moment after they are saved
  locally, receives the other computer's changes through a notification stream (polling every
  30 s as fallback), pauses on request, backs off when the server is away and stops when the
  session is refused. The header badge and the Sharing view say whether a change is only on
  this device, being sent, saved on the server, offline (trying again), in conflict or stopped.
  A second computer downloads a campaign from Settings; an expired cursor re-lists the campaign.
- **Real server acceptance (Windows x64, `Chronexus-Server` debug build, loopback HTTP):** two
  computers of one account stayed aligned; autosave-to-other-computer latency over 8 edits was
  min 88-156 ms, median 162-167 ms, max 170-488 ms across runs with a 60 s poll (so notification
  driven); the server was killed and restarted on its database (offline state shown, 3 changes
  recovered by themselves); a stored operation was replayed once after a simulated crash;
  concurrent edits became a resolvable conflict; sharing, withdrawal and 120-item paging were
  checked; a member never saw private items. These live tests are `#[ignore]`d (they need the
  server binary) and were run with `--ignored --test-threads=1`.
- **Real WebView check (Windows, isolated synthetic profile, debug build, Playwright over CDP):**
  scope selectors, scope summary, opt-in and pause of automatic synchronization, the header badge
  and the three destructive confirmations rendered and behaved correctly, with Axe reporting 0
  violations at 1200 and 760 px. The app accepts only HTTPS servers, so no real server was reachable:
  the link was seeded in the archive and "Synchronize now" honestly answered "Choose a sharing server
  first", the badge "Sign in to the sharing server to continue". It found a real bug the component
  tests missed (the scope selector read its value after the app's draft-flushing guard, so choices
  were silently ignored); fixed with a regression test that fails without the fix. Also fixed the
  checkbox layout and two "1 changes" phrasings. Sign-in, account deletion and downloading a
  campaign were not exercised in the window (they need a reachable HTTPS server).
- **Hermetic checks:** Rust lib 168 passed / 6 ignored (four of them the live real-server tests; the other two are older ignored tests); sync tests stable over 4 consecutive runs; Clippy `-D warnings`
  all targets and rustfmt clean; Vitest 178 passed; ESLint, `tsc --noEmit`, i18n catalog check
  pass. Backups of schemas 2-20 restore. Not run: macOS/Linux, GUI WebView, installers.
- **S6 desktop (same day):** losing access (removed, or the campaign was deleted) clears the
  copies received from other players, keeps own items, drafts and replication choices, restarts
  the cursor, stops automatic synchronization with a visible reason and resumes if switched on
  again after a new invitation; "Delete my copy on the server", "Delete the campaign on the
  server" (exact name) and "Delete my account" are confirmed actions that never delete a local
  item. Hermetic lifecycle tests plus a third real-server test (member removal and return,
  erasure, campaign and account deletion) passed against the S6 server.
- **S4 desktop (schema 021):** character sheet sections (identity, combat, equipment,
  spellcasting: only non-empty fields, never notes or conditions) and images can be **shared**
  (not replicated privately). Images are uploaded as originals within the server's limits
  (larger ones are reported instead of retried); members see sections as read-only text and fetch
  an image only on request, checksum-verified, and none of it becomes a local sheet or image.
  Real-server test 4 (validation, upload, download, no local creation on the owner's second
  computer) passed.
- **Not done:** private replication of sheets and images (the server has no kind that lets another
  computer rebuild them); deletions do not propagate into another computer's archive (they stop
  its replication); real WebView check of the new controls (component tests only); no new
  strings are machine-translated beyond the English fallback.

# Chronexus status — 26 October 2026: M23 complete, M6/M16 platforms, M24 client

Not published; source version 0.8.1, schema 019.

- **M7, M18, M26 closed** by user decision (unperformed checks not claimed).
- **M23 implemented** (report docs/AUDIT.md): MCP bridge fix, archive commands off
  the main thread (UI no longer freezes during backups), search 10 s → 19 ms on a
  12 000-block campaign, `lib.rs` split per domain, `App.tsx` shell split, shared
  helpers (JSON files, pending actions, blocking work, test HTTP fake), Ticinese/
  Klingon/Romulan removed with preference migration, catalogue and error fixes,
  backups of every schema 2–19 restorable. CVE scan still open (tool not permitted).
- **M6/M16:** macOS arm64/x64 .app and .dmg built (arm64 started; x64 not run, no
  Rosetta; ad-hoc signing only); Linux arm64/x64 .deb built, installed and started
  on clean Debian; real-WebView IPC flows 16/16 on Linux arm64; Wikidot parser
  verified on live pages; 93 wiki strings translated into eight languages.
- **M24 client implemented:** schema 019, sharing commands and views, contract v1
  in docs/SYNC_API.md, acceptance scenarios against an in-process contract fake.
  The server is now **M25** (separate repository, notes in docs/SERVER_NOTES.md);
  Android moved to **M27**.

Validation (macOS unless noted): Rust 152 pass / 0 fail / 2 ignored; Clippy,
rustfmt; Vitest 171; tsc, ESLint, Prettier, catalogue check, vite build; MCP stdio
5/5. Linux arm64: Rust 152, clippy, IPC flows 16/16. Windows not re-run.

# Chronexus status — 26 October 2026: M23 audit, first pass

First M23 pass on macOS; report in docs/AUDIT.md. Fixed: MCP bridge replies lost on
refusal and refused slow clients on macOS (RST on close, inherited non-blocking
sockets); platform-specific Ollama test fixture; misleading constraint error; i18n
scanner losing Rust messages after raw strings; leftover Italian diagnostics; four
duplicated JSON preference helpers unified in `json_file.rs`; N+1 alias queries in
`list_pages` (15.2 → 4.4 ms for 3 000 pages). No schema, format or identifier change.

Validation (macOS): Rust 140 pass / 0 fail (8 runs), Clippy, rustfmt, Vitest 172,
TypeScript, ESLint, Prettier, i18n check, MCP stdio 5/5, scanner 2/2, vite build.
Not run: Windows/Linux, desktop GUI, dependency audits. Open: async DB commands
(main-thread blocking), catalogue regeneration review, lib.rs/App.tsx split.
Commits: fa27012, 08e7195, 8bf6b75, 4ca1cc8, fee0dd2, 2419419 (one per topic);
not published.

# Chronexus status — 26 October 2026: English source and tooling completion

Completed the M26 language sweep beyond the visible interface: renamed the internal
Italian-named label map to `appText`, translated remaining Rust diagnostics,
Markdown export headings, future Logseq import reports, setup/installer and release
messages, code comments, test descriptions and native QA output/selectors. Remaining
Italian prose in source documentation and dice guides is now English.

The interface stays English-first; Italian remains selectable. Translation catalogs,
multilingual fixtures/detection and compatibility identifiers remain intentional
exceptions, documented in docs/I18N.md. Canonical campaign text, original Markdown,
aliases, saved locales, message IDs, schema 018 and legacy backup paths are unchanged.
No new dependency, migration or version bump. Published artifacts and Git history
were not rewritten.

Actual macOS validation:

- **172 Vitest tests PASS**, plus 2 targeted AssetForm tests after translating its
  mock controls; **14 i18n tests PASS**. TypeScript, ESLint, Prettier, stable-ID
  scanner and frontend build PASS. Existing editor chunk >500 kB warning remains.
- **134 Rust unit tests + 1 integration PASS** with two known failing unit tests
  excluded and two separately ignored tests (saved Wikidot fixture and real signed
  final package). The full unit run: 134 PASS, 2 FAIL, 1 ignored.
- Both failures reproduced against untouched commit **e1327d5** in a temporary
  source copy: `verified_archive_installs_atomically_and_bad_ones_leave_nothing`
  builds a Windows `ollama.exe` fixture that does not satisfy the macOS executable
  path; `transport_auth_origin_scoping_cleanup_and_live_store` fails its initial
  HTTP 401 assertion. No claim that the full Rust suite passes on macOS.
- Rustfmt, Clippy all targets/features with `-D warnings`, and native debug
  executable build PASS. Icons were generated locally before compiling.
- MCP stdio tests **5/5 PASS**, including English protocol errors; JavaScript syntax
  checks **35/35 scripts PASS**. Loopback tests executed outside the sandbox.
- Python 3.12: **23 release-tool tests + 5 local translation-tool tests PASS**.
  Windows PowerShell installer tests not run on macOS. Training-worker tests are
  blocked by missing `gguf`; no training dependencies or weights installed.
- Export regression verifies English wrappers around unchanged Italian titles and
  aliases, stable links and byte-identical original image contents.

No native GUI acceptance, installer/upgrade, model qualification or publication was
performed. Edited native QA scripts passed syntax checks; they were not run against
Windows WebView2. These checks do not certify a new distributable release.

Skills: reviewed the available catalog; no specialist skill was applicable to this
language-only source/tooling work. Used source inspection and focused regression
checks. Next planned milestone: **M23 complete code audit**, then M24 and M25.

# Chronexus status — 25 October 2026: M26 English-first

Implemented in source version **0.8.1**, not published. English is the primary
interface/source/fallback language for fresh profiles, package/app descriptions,
public documentation, agent instructions, commit conventions and AI prompts.
README.md is English; README.it.md preserves the optional Italian overview and
README.en.md links to the canonical English README. Source release notes are
English; published artifacts and historical Git commits are not rewritten.

Existing language choices survive. Pre-language profiles retain Italian through
a one-time local preference. Italian aliases/message IDs, original campaign text,
UUIDs, schema 018, legacy app ID and backup paths remain stable. No new SQL
migration. Cargo license metadata now matches the existing root Apache-2.0 license.
AI answers follow an allowlisted interface locale, with English fallback;
training examples use English wrapper text while quoting originals unchanged.
No startup inference, training, activation, download or external AI service added.

Actual validation:

- **172 current-project Vitest tests PASS**, 14 i18n tests PASS; TypeScript,
  ESLint, Prettier and frontend build PASS. Editor chunk >500 kB warning remains.
  Vitest now excludes `.tools`, installers and target copies. Earlier broad runs
  also counted historical checkout tests; this checkpoint counts only source.
- **137 Rust unit tests + 1 integration PASS**, 2 ignored (saved Wikidot fixture
  and real final-package signature). Rustfmt and Clippy all targets/features with
  `-D warnings` PASS. No new installer exists for a real-package signature test.
- Release scripts 27, local translator 5, training worker 5, MCP 5 and stable
  source-message-ID scanner 1 tests PASS. Worker tests do not train real weights.
- Native Windows isolated profile: fresh English default; Italian survives reload;
  English recovery survives reload; campaign identity unchanged. Axe 0 violations
  on language/settings sections; wide/narrow screenshots inspected.
- Real local Qwen3.8-27B: 4 English cases plus Italian selection PASS (5/5), valid
  citations, unconfirmed claims kept uncertain, missing information acknowledged,
  canonical pages unchanged. Initial model-switch warmup after a long Gemma
  document session timed out before sending context; clean runtime passed. This
  does not qualify automatic model switching or fix that runtime limitation.
- React Doctor **62/100**, identical to the original 0.8.0 source baseline;
  no introduced findings. Existing architecture warnings remain for M23.
  Impeccable static detector on changed controls: no findings; screenshot/axe
  checks cover rendering beyond the static detector.
- English public screenshots contain only synthetic campaign data, 459,016 bytes
  total. Herald is a documented UI illustration of real 0.8.0 notes; details in
  docs/media/PROVENANCE.md. Local Markdown links/headings validated.

No installer build, installation, upgrade or publication for this delivery.
Other operating systems, physical offline/firewall tests and complete linguistic/
assistive review remain pending. Missing translations in non-English locales
fall back visibly to English; no fabricated complete coverage. Test profiles,
runtime logs, weights and reports remain outside Git. Only the temporary QA
runtime/window were closed; personal installations were not stopped.

Skills applied: React Testing (language persistence and aliases), Tauri v2/Rust
Best Practices (IPC, metadata, validation), Systematic Debugging (stale language
assertions and runtime handoff), Impeccable (existing surface and readable copy),
React Doctor (baseline comparison), Webapp Testing (isolated desktop QA).
Next planned milestone: **M23**, then M24 server in a separate repository and M25.


# Planning — 25 October 2026: M23, M24, M25

Added at user request after release 0.8.0, none implemented:
M23 full code audit (next), M24 shared campaign (proposal: server
Chronexus self-hosted with selective sharing, P2P evaluated and not chosen as
base; confirmed by user, to be developed in a separate repository), M25 Android APK app with the same account as the
server. Details in ROADMAP.

# Chronexus Status — 25 October 2026 (release 0.8.0)

Release [0.8.0](https://github.com/Acelith/Chronexus/releases/tag/v0.8.0)
with M19, M20, M21 and M22 published. Source compiled `c540c2d`, tag annotated `v0.8.0`,
`main` on origin. NSIS Windows x64 installer compiled from commit `c540c2d` (tag annotated `v0.8.0`),
updater signed and verified with the production key
(`updates_signed_release_package_matches_production_key`). Size 33.072.040
byte, SHA-256 `0079f8b8509836e006ad42d37338212593c25b9719119b1e49f2961bbb4d6b3a`.
Checks before build: 134 Rust test (`--test-threads=1`), clippy
`-D warnings`, 332 frontend test, tsc, eslint, catalog check, 27 Python test
of release scripts. Draft with three attachments uploaded and re-uploaded, then
finalized: anonymous downloads and API `releases/latest` = v0.8.0 verified.
Not performed: real installation or upgrade, macOS/Linux.

# Chronexus Status — 25 October 2026 (M19)

**M19 — Documents Backup, periodic and update.** Delivered on
Windows, not in a release, no push. Module `src-tauri/src/backup_folder`:
`Documenti/Chronexus/{Backup periodici,Backup aggiornamenti}` created only at the first
backup or requested opening, never through symbolic links/junctions or files at
the place of the folder. App Settings → Backup (even without campaign):
activation (default **off**), every day/week/N hours (2–72), copies
1–60, alternative folder only from system selector, cloud warning, last
success, next, last error with action, «Run backup now», «Open
folder». Preferences `backup-preferences.json` and index `periodic-backups.json`
(SHA-256) in the data root, outside of restore generations. Execution
only with the app open and idle (45 without input, no active text field,
no dialog/draft/operation; backend skips with AI, update, archive
busy or restore pending); an error waits for an entire interval. The
rotation occurs only after a new verified backup and deletes only files
registered with unchanged hash in the same folder. M15 backups go to
«Update Backups» (received with `backupPreferences`), with fallback warned in
`update-backups/`; if both fail, the installer does not start. Backup and
restore lists folders with type, date, size, M4 restore and copy
verified of old update backups without deleting the original.

Checks actually performed:
- `cargo test`: 134 passed with `--test-threads=1` (12 new M19, real junction
  Windows included). In parallel, the MCP test
  `transport_auth_origin_scoping…` fails intermittently, already unstable before M19 and green on its own.
- `cargo fmt --check`, `cargo clippy --all-targets -D warnings`: passed.
- `pnpm typecheck`, `pnpm lint`, `prettier --check`, `pnpm test`: 332 tests passed.
- Isolated desktop testing (`scripts/qa/m19-backups.mjs`, simulated Documents with
  spaces and Unicode): skip during writing, automatic backup at idle,
  rotation with manual file intact, resume after restart, legacy copy
  verified, real restore with image, preferences unchanged; axe without
  violations in both panels.
- Not verified: macOS/Linux, real redirected Documents, physical full disk and read-only
  disk, real installation of an update with backup in Documents;
  new strings not translated (Italian fallback).

Next step: no open planned milestones; potential release with
M19–M22 only upon request.

# Chronexus Status — 25 October 2026 (M21, M22, M20)

Executed at user request; M19 moved to the bottom of the roadmap. Source
version 0.7.0, no new release, no push.

**M22 — Local AI from settings.** App settings → Local AI:
components. "Check components" (only on click): Ollama, cloud blocked, GPU via
`nvidia-smi`, free space, status of Qwen3.8-27B and Gemma 4 12B compared to qualified
weights. "Install Ollama..." downloads Ollama 0.40.10 from the official URL only
GitHub (redirects allowed only to GitHub asset hosts), verifies size and
SHA-256 `d52aea2d…` (compared with the official `sha256sum.txt`), extracts to a
temporary folder with path checking and activates it only after verification is complete
(`ai-runtime/ollama-0.40.10` in the data folder, outside of backup and Git). Explicit start and
stop; the managed runtime closes with Chronexus, does not touch existing runtime
or occupied ports and requires cloud disabled. "Download model..."
asks the active runtime for only the chosen model and declares it ready only if the
weight digest matches the M18 policy. Removal limited to the managed runtime.

**M21 — Visual identity.** App icon from the herald (`assets/chronexus.svg` =
`assets/brand/chronexus-icon.svg`, `pnpm icons` generation tested), vertical logo
in the sidebar with accessible title "Chronexus".

**M20 — README.** Italian and English README with header, real badges, function
table with project icons, installation, warnings, credits and Apache-2.0
license of the LICENSE file. Technical contents moved without loss to `docs/GUIDE.md` and
`docs/DEVELOPMENT.md`. Five WebP screens from synthetic campaign (approx. 0,5 MB).

Verifications actually performed:
- `cargo test`: 122 test, including 5 new M22 (download/hash/redirect, archive
hostiles, cancellation, pull with weight verification, offline status); 10 executions
complete without M22 failures after correcting a keep-alive in the fake server
of the test. `transport_auth…` (MCP) fails intermittently even on its own and
even on the clean HEAD commit: pre-existing instability. clippy and fmt PASS.
- `pnpm test` 326 PASS; lint, typecheck, format, i18n:check and build PASS.
- Windows Desktop debug, isolated profiles: `scripts/qa/m22-ai-setup.mjs install`
real (official 1,59 GB download, verification and extraction in 128 s, start with
cloud disabled, stop, no partial files); real pull of Gemma 4 12B already
present in the development runtime: log re-check and weights verified
«Ready» in 2 s. Logo at 1440/1200/760 px, axe 0 violations on sidebar and
AI panel. README screenshots from `scripts/qa/m20-readme-media.mjs`.

Limits: full download of 17,7 GB of Qwen3.8-27B via interface not
repeated; guided installation only Windows x64; `Cargo.toml` declares MIT while
`LICENSE` is Apache-2.0: inconsistency reported to the user, not modified; new
strings with Italian fallback; macOS/Linux not tested.

Skill: frontend-design and impeccable (craft-floor) for README, project SVG icons
instead of emojis and logo composition; accessibility for AI panel and logo name
; react-testing for tests; imagegen not necessary (user images).

Push of the 25/10/2026: `main` on origin at 7f2dd90 (no release). README rendering
verified on the real page of github.com (Forgejo 12.0.4): callout WARNING/
IMPORTANT/NOTE, two collapsible sections, centering, three tables, all images
e i badge loaded (release v0.7.0), 12 internal links with response 200.

Next and only planned milestone: M19.

# Planning — 25 October 2026: M22 along with M21 logos

Added M22: guided installation of Ollama and models from App Settings,
in the same next phase as M21 logos, before M19/M20. Qwen3.8-27B primary,
Gemma optional secondary; component status, requirements/space/licenses,
explicit downloads with progress/cancel and integrity check. Pre-existing
runtimes and campaign activations preserved, no cloud or automatic
setup. QLoRA excluded from ordinary download. Planning only: code,
version, schema and 0.7.0 package unchanged; no compilation/installation
or publication. Documentary verification and `git diff --check`, app tests not performed
for this documentation-only change. Details and acceptance in ROADMAP M22.

# Chronexus Status — 25 October 2026: M18

Windows implemented, version 0.7.0 compiled and delivered locally. Official Qwen3.8-27B
Q4_K_M is the first choice for assistant/wiki/translation tool, Gemma 4 12B
explicit secondary and sole QLoRA base. Shared policy with fixed weights;
48 GPU/batch layer 256, context 8192: mixed GPU/RAM execution on 4080 SUPER
16 GB. 99 layer profile discarded for memory pressure/latency. No
cloud, download, campaign activation or automatic fallback.

018 Schema disables old global/per-campaign Qwen without rewriting
names/digests, responses or citations. Real restoration of synthetic backup 017
verified in the new app; Gemma active preserved. Translator v2 with selection
explicit and cache coherent with model; v1 copies valid in backups, never attributed
to the new model. Old Qwen installer scripts withdrawn; Gemma bundle only with
--secondary-gemma. Identity, setup and measures in docs/AI_MODELS.md.

Actual verifications:
- Qualification before changes: independent SHA-256 GGUF, Qwen and Gemma 35/35
  on identical sources; native benchmark 40/40 each, canonical data unchanged.
- UI restoration/migration: current history and citations intact, old Qwen
  rejected, consent required, Qwen first, Gemma secondary, correct training.
- Native Wiki: Italian, numbers/negation/radius preserved, original intact;
  visible cache with runtime off and HTTPS browser blocked. Cancellation and
  cache clear prevent partial/late copies and release the AI block.
- Axe 0 violations on settings/voice; 1200/760 px views inspected.
- Frontend 162 test PASS; i18n 14 PASS; lint/TypeScript/build PASS. Pre-existing chunk
  editor >500 kB warning. Final formatting PASS.
- Rust 117 unitaries + 1 integration PASS; 2 ignored (local Wikidot fixture and
  signature on final package). Signature test then explicitly performed on
  actual package: PASS, tampered copy rejected. Clippy all-targets/all-features
  -D warnings PASS.
- Release script 27, local translation 5 and MCP 5 PASS. Windows debug build PASS.
- React Doctor 84/100 (baseline 81), TrainingPanel size warning; no errors.
  Impeccable static on four components: no reports, static limits
  compensated by screenshots and axe. Native detector: pre-existing warning of long lines
  in general wiki help, external to modified controls.

Local delivery 0.7.0: source/tag `v0.7.0` → `2052df7`
(`feat(ai): adotta Qwen3.8-27B e mantiene Gemma secondaria`). Build NSIS x64
firmata updater from isolated commit checkout, 32.630.931 byte; SHA-256
`69b9ef340f43f177b266c99ce1f9e1eac9320fdf3229ff1500106389350e270e`.
Installer, signature, manifest, and report in
`installers/Chronexus-0.7.0-Windows-x64/`, outside Git. Real signature with production
key PASS; no installation. The first push was rejected by the
server due to incorrect/expired credentials before the publisher's start.
The user then requested to leave the publication: do not resume without
a new request. No 0.7.0 release created; previous public channel 0.6.0.

Limits: qualification on a Windows GPU, no installation on personal profile
or physical test without network; other OS/hardware pending. Translations to be reviewed
(especially meaning/terminology), no guarantee of official rules.
Next planned milestone: M21, then M19/M20 according to ROADMAP.
Skills applied: Rust Best Practices/Tauri v2 (policy and IPC), SQLite Expert
(migration/backup), Impeccable (consistent states with existing UI), React Testing
and React Doctor (regressions), Systematic Debugging (memory/format/semantics),
Webapp Testing (isolated desktop tests). Weights/fixtures/reports outside Git.

# Planning — 25 October 2026: M21 first of all

Only documentation and assets. The user chose the herald logos (icon,
horizontal brand, vertical logo): originals in `assets/brand/source/`, variants
prepared in `assets/brand/` (icon with transparent corners tested with `tauri icon`).
Per their instruction, they are not yet integrated: new M21 in ROADMAP, to be executed
**before** M18, M19, M20, and any other open milestone. An integration
started in this turn was canceled before the commit; app, version, and
release unchanged.

# Planning — 25 October 2026: M20

Only documentation. New M20 in ROADMAP: high-quality README inspired by the projects
indicated by the user (centered header, real badges, synthetic screenshots,
function and installation tables, callouts and collapsible sections, README.en.md,
technical content moved to docs). Code, version, and release unchanged.

# Planning — 25 October 2026: M19

Only documentation. New M19 in ROADMAP: `Chronexus/` folder in Documents with
«Periodic Backups» and «Update Backups», configurable periodic backups
in the app (only when app is open and idle, rotation only of recorded periodic ones) and
M15 pre-update backups moved there with fallback in the data folder and no
automatic deletion. Code, schema, version, and release unchanged; no
publication.

# Chronexus Status — 25 October 2026: M17

M17 implemented on Windows: explicit translation of the wiki entry into the
app's selected language, for Wikidot and Open5e. Original/source and imports
unchanged; separate and offline-consultable automatic drafts. Additive 017 schema,
cache limited to 100 copies, included in backups and in clearing for provider.
Checks discard incomplete results, altered numbers, and late writes.

Actual verifications:
- Lint and TypeScript PASS; frontend 159 test PASS; i18n 14 test PASS.
- Rust 115 overall test PASS, 2 ignored (local Wikidot fixtures and test of
  signature on the final package); signature test then performed PASS, see below. 016 → 017 migration,
  sources unchanged, cache for source/language and backup/restore verified.
- Frontend build PASS (pre-existing warning chunk >500 kB); Windows debug build
  PASS; Clippy without warnings PASS. Final formatting PASS.
- QA desktop on isolated synthetic profile: Qwen3 4b-instruct on RTX 4080 SUPER,
  GGUF verified, cloud disabled, 37/37 GPU layer. Italian translation,
  German and Arabic with numbers/negation preserved in the fixture; variable titles/terms
  confirm that it is not a linguistic revision or official rules.
- Original preserved; copy reread even with runtime off and public browser
  requests blocked. Not equivalent to a physical proof without network/firewall.
- Real cancellation without partial copy; cache clear during inference
  interrupts work and refuses late writing; shared AI block released.
- Axe on 0 violations; 1200/760 px view inspected. React Doctor 81/100,
  no new reports after correcting block identities.
- Test script release 26 PASS; MCP protocol 5 PASS, no new tools exposed.

Distribution **0.6.0 published**: https://github.com/Acelith/Chronexus/releases/tag/v0.6.0
(release id 5, three attachments). Source/tag `v0.6.0` → `b4f04c4`
(`feat(wiki): traduce le voci nella lingua dell'app con cache locale`).
Build NSIS Windows x64 signed updater, installer 32.603.355 byte; SHA-256
`a7bbe026e68ef4122499f8f8ac1d1bc50d2551bbdd7e1a73110338d984b8f675`.
Real package signature with production key PASS, tampered copy rejected
(ignored test explicitly performed). Upload, redownload/checksum and download
anonymous of the three attachments, static manifest and stable latest API verified by the
publisher. Installer and report in `installers/Chronexus-0.6.0-Windows-x64/` outside Git.
Not installed on personal profile: real upgrade 0.5.0 → 0.6.0 still to be tested.
No private content/fixture or AI weight in Git. Local proofs in `.tools/m17/`,
repeatable scripts in `scripts/qa/m17-*.mjs`, guide `docs/WIKI_TRANSLATION.md`.

Limits: first translation requires Ollama/GPU and already present approved Qwen;
24.000 byte/500 fragments/240 s, error and original for tests beyond limit;
Ticinese and other languages to be revised, Klingon/Romulan with explicit fallback.
macOS/Linux, real assistive readers and installed upgrade remain open.
**Next milestone: M18**, replacement of Qwen with the qualified local model
still planned. Not anticipated by M17.

Skills applied: Tauri v2 and Rust Best Practices (IPC, runtime and validations),
SQLite Expert (migration/cache), Impeccable (existing context and UI states),
React Testing and React Doctor (test and regression control), Systematic Debugging
(JSON/numbers format), Webapp Testing (desktop QA) and Computer Use (window reconnaissance).

# Planning — 25 October 2026: M18

Documentation only. Request: remove all Qwen and use «Qwen3.8-max».
Verification: Qwen3.8-Max has 2,4 T parameters and is a cloud API or weights from multi-GPU server;
not suitable for RTX 4080 SUPER 16 GB nor for the «no external AI» rule.
User choice: Qwen3.8-27B open locally. New M18 in ROADMAP (M17 is used
by a concurrent wiki translation job, untouched). Code, schema,
version 0.5.0 and release unchanged; no publication.

# Release 0.5.0 — 25 October 2026: published

https://github.com/Acelith/Chronexus/releases/tag/v0.5.0 — release id 4, three
attachments. Publisher: draft, upload and redownload SHA-256 verified, then
publication with verification of anonymous downloads, the static route `latest.json`
and the API `releases/latest` (v0.5.0, not draft, not preview). Independent curl
check PASS. Tag `v0.5.0` → deef244; main on origin at
7a96ec5 before
this checkpoint. The remote main was already at a4e1fb4 before the push of this

Incident: during a version check, it was started by mistake
`.tools/m15a/target/debug/chronexus.exe` without `NODEX_DEV_DATA_DIR` (for about one
minute, then closed normally). A debug build without override uses the personal data folder
`it.nodex.desktop`: if the archive was not locked by another
instance, it may have migrated it to the 016 schema (additive) and written
`update-announcements.json`. Not verified: reading of the personal folder was
denied by the permissions system. If the installed 0.4.0 reports a
newer schema, install the published 0.5.0 (data preserved).
Outcome: the user confirmed that the installed 0.4.0 opens normally, therefore
the personal archive was not migrated to 016.

# 0.5.0 build details

At the user's request: integrated herald illustrations (daed026), version
0.5.0 (deef244, compiled source, annotated tag `v0.5.0`). NSIS build signed
updater: `installers/Chronexus-0.5.0-Windows-x64/` (outside Git), setup 32.558.794
byte, SHA-256 d854b0e8768d980ce3b1d288c12261b23b1d253537da33f503044142e5ca2e51;
`.sig`, `latest.json`, SHA256SUMS, report and READ_ME. Cryptographic test ignored
performed: valid signature with production key, tampered copy rejected.
26 release scripts test PASS (M11 version test made generic).
Installer not installed on this computer to avoid touching the personal
installation; actual 0.4.0 → 0.5.0 upgrade from client not yet tested.

# Chronexus Status — 25 October 2026 (M15a)

## M15a — Update Herald: Windows operational (illustrations to be provided)

- Light automatic check after startup (6 s): one per session and at most
  every 20 hours, can be disabled in **App Settings → Updates**; contact
  only the M15 updates channel, never wiki or AI models. Silent errors.
- If a newer and compatible version exists, `<dialog>` popup: herald with
  trumpet (temporary geometric emblem), manifesto with version and notes as
  plain text, **Update**, **Remind me later** (3 days, per version),
  **Ignore this version**; Escape = dismiss. No double announcement.
- Waits for an idle app: no saving/module/restore/search, no
  dirty draft, open dialog or text field with focus, AI/training or
  update in progress. Focus on title and returned on close.
- Synthesized fanfare in Web Audio (no file), can be disabled; audio blocked
  by platform = full announcement without sound or new attempts. Animation
  of ~1,5 s skippable, static with reduced movement.
- **Update** opens settings and starts the verified M15 download;
  installation remains the explicit action with mandatory backup.
- Preferences in `update-announcements.json` outside of restores, included in the
  pre-update receipt. SQLite remains 016.

Verifications actually performed:
- `cargo test` 109 PASS (3 new policies), clippy `-D warnings` and fmt PASS.
  The unstable pre-existing MCP test failed once, then 2 green executions.
- `pnpm test` 152 PASS; lint, typecheck, format:check, i18n:check, build PASS.
- Windows debug Desktop, isolated profiles, CDP 9224, `scripts/qa/m15a-herald.mjs`:
  `fixture` (synthetic offer only debug: popup at idle app, focus, axe 0
  violations, Escape = dismiss), `quiet` (restart without check within 20 hours),
  `real` (real Forgegit channel: 0.4.0 is current, registered check and no
  popup), `optout` (no automatic request). 1200 px and 760 px screens with
  reduced movement. The initial block for a `<select>` with focus was
  corrected and covered by tests.

Limits: real upgrade from popup between two signed releases not tested (requires a
0.5.0 published); raster illustrations of the heraldry and the scroll to be provided
(prompt and activation in `assets/herald/README.md`); real sound in WebView2 not
heard by a human; new strings with Italian fallback; macOS/Linux not tested.
During testing, a Codex session used the same Vite (1420) and its own
debug build: untouched, testing performed on CDP port and separate targets.

Skills read and applied: frontend-design and impeccable (craft-floor, animate) for
visual direction, a single animated moment and geometric emblem instead of a
fake SVG illustration; accessibility for dialogue, focus, reduced movement and
audio; react-testing for tests with fake timers; imagegen consulted but not
executable here (no integrated tools or OPENAI_API_KEY): the user will provide
the images. tauri-v2/rust-best-practices consulted for commands and preferences.

Commit: 126d250 implementation; documentary checkpoint in the next commit. No push.
Next milestone: none new planned; residuals in ROADMAP.

Correction of checkpoint M16: the phrase "no specialist Skills available"
was imprecise. Local Skills in `~/.agents/skills` existed but were not
searched for, therefore in M16 they were neither read nor applied.

# Chronexus Status — 25 October 2026 (M16)

## M16 — Wikidot, font choice and deletable cache: Windows operational

Implemented at the explicit request of the user **before M15a**, which remains
planned. Source version still 0.4.0; SQLite schema **016** (additive).

- **App Settings → D&D Sources / Wiki**, even without a campaign: Wikidot D&D 5e
  (default) or Open5e. Global preference `wiki-preferences.json` v1 outside
  of restoration generations; missing file = Wikidot, never written in read.
- Read-only Rust Adapter for `https://dnd5e.wikidot.com/`: GET HTTPS without
  credentials/cookies, one request at a time spaced ≥1,5 s, 2 MiB, timeout,
  cancellation, redirects only to allowed pages, no new automatic attempts.
  Categories: spells, feats, species, backgrounds, classes/subclasses, magic
  items. Only the category index is downloaded; the searched name remains local.
- HTML treated as inert text (`scraper` 0.29, ISC): scripts, frames, modules,
  media and advertisements discarded; depth limits/blocks/text; title and
  content missing → error. Spells: real fields or list of missing ones,
  never invented values. Declared source, origin (published/UA/homebrew/not
  indicated), edition 5e-2014, URL and license declared by the page.
- Separate Wikidot cache (`wikidot_cache`, max 200 entries + indices) included and
  validated in backups. **Clear offline cache** for Wikidot, Open5e, or both, with
  confirmation, warning on approved AI sources and invalidation of ongoing requests
  (Rust-side epoch, even for Open5e saves). No automatic redownloading.
- Wikidot without information (no result, network/HTTP error, unrecognized fields):
  dialogue «Do you want to use Open5e?». Accepting saves Open5e and repeats a
  search once; refusal/Escape stay on Wikidot without requests to Open5e.
- Explicit spell import: preview → editable module in
  Spells → **Save entry**. `catalogSource.provider = "wikidot"` stored;
  the SRD entries maintain the previous JSON. Export with `SOURCES-WIKIDOT.txt`.
- Local assistant: cached Wikidot entries are 5e-2014 rule sources approvable;
  if cleared, new questions receive the already existing explicit error.

Verifications actually performed:
- `cargo test`: 106 PASS + 1 QA test ignored; performed separately on real pages
  saved outside Git: 574 spells, 199 talents, 247 classes/subclasses, 102
  background, 83 species, 882 items; Acid Splash without missing fields. `cargo fmt`
  and `clippy --all-targets -D warnings` PASS.
- Pre-existing instability: `automation::tests::running_bridge…` and
  `transport_auth…` sometimes fail in parallel; reproduced also on commit
  base 66865f3 (3 failures on 9 executions). They pass alone; not modified.
- `pnpm test` 146 PASS / 35 files; lint, typecheck, format:check, i18n:check, build PASS
  (pre-existing warning on the chunk editor).
- Windows Desktop debug, empty isolated profile, `scripts/qa/m16-wiki.mjs`
  `check` + `restart` PASS: default without campaign and without network on opening;
  real Wikidot index and page via Rust (no request from the WebView);
  import saved only explicitly; rejection without Open5e traffic;
  acceptance with a single Open5e request; clearing canceled and confirmed,
  Open5e and spell intact; ordinary closure and restart without requests.

Limits: new strings with Italian fallback (catalogs not regenerated); macOS/
Linux not tested; robots.txt and license verified on 25/10/2026 but the page may
declare different rights and game content belongs to the publishers:
no catalog redistributed. Future HTML structure of the site not guaranteed.
No package, version, or release created in this delivery.

Commit: 2fbf17a backend/migrazione 016; 923516f interface and testing; the
documentary checkpoint follows. No push.

Skill: no specialist skills available in this session other than general
ones; ordinary tools, Rust/Vitest and Playwright tests of the project used.

Next milestone: **M15a** (epic announcement of updates).

# Planning Update — 25 October 2026

## Next phases: M15a, then M16

Documentation only: M15a inserted before M16, preserving historical IDs.
M15a plans an epic update announcement with vassal/herald, animated/audio
controllable trumpet and parchment manifesto, limited/deactivatable start
check, deferral/closure and draft protection. The download/signature and
mandatory backup path remains M15, without implicit installation.

M16 updated: deletable offline cache for source or total with confirmation,
cancellation and invalidation of pending requests; imports, campaigns,
images, preferences and backups preserved. If Wikidot does not provide information,
ask before switching to Open5e; acceptance saves the source and allows a
new search, refusal/closure maintain Wikidot and do not contact the alternative.
Future Wikidot default confirmed. Manage cache copies, errors and duplicate popups.

ROADMAP, PROJECT_SPEC, AGENTS, DECISIONS, RESEARCH_DND and UPDATES aligned.
Version 0.4.0/SQLite 015, application sources, settings, packages and releases
unchanged. No popup, scraping or new selector implemented in this turn.
Documentary checks PASS: 28 agreed milestone/order, 60 valid commits,
27 local links, only seven Markdown files and git diff --check;
no app/build or network tests, because changes concern only Markdown.
Skill: available catalog evaluated, no specialist skills necessary for
this documentary change; ordinary Git/file tools.

Next new milestone: M15a, to be implemented only on request; then M16.
No publication or new version for this planning.
The following checkpoints are historical and their previous order M16 is surpassed.

# Planning — 25 October 2026

## Reconciled Roadmap and planned M16

Exclusively documentary update requested by the user: all existing milestones
have status and Git evidence; log and sections follow the actual order.
IDs M0–M15 preserved; added retrospective milestones M4a/M5a, M6a–M6d, M7a and
M8a–M8c for renaming, sheet/API, theme/graph, Party/Open5e, AI installer, moving
to D and GUI/editor. M12 and M13 are before distribution M11, without rewriting
history. Already delivered requests do not become new work to be redone.

**M16 to be implemented:** public Wikidot HTML scraping, Wikidot/Open5e choice
in global settings, Wikidot default when an explicit choice is missing,
persistent preference, secure and separate parser/cache, explicit origin and import.
SRD 2014 catalog and already saved spells preserved. Specification,
research and AI instructions aligned; obsolete M11–M13 planning corrected.

Runtime unchanged: version 0.4.0, SQLite 015, D&D Wiki currently Open5e. No
changes to UI, data, dependencies, installer, tags or release; no M16 implementation
declared. Acceptances M6/M7/M8/M10/M11/M15 already documented remain.

Checks for this delivery: comparison with Git history, order validation,
ID/commit/document-link validation and git diff --check: PASS (27 milestones,
60 valid commits, 27 local links, only 6 Markdown files). App tests/build were
not run because only Markdown changed; the results below remain historical.
Skills: evaluated the available catalog; no specialist skill was needed for
this documentation reordering. Used ordinary Git and file tools.

Next new functional milestone: M16, only upon an implementation request.
No publication/version for this planning change.

# Chronexus status — 25 October 2026

## M15 — operational on Windows, public release 0.4.0

Release published and verified without authentication:
https://github.com/Acelith/Chronexus/releases/tag/v0.4.0
Stable API: https://api.github.com/repos/Acelith/Chronexus/releases/latest
Release ID 3, three attachments: Windows x64 setup, .sig and latest.json. Upload,
download, SHA-256, anonymous downloads and latest API PASS. M11 draft ID 2 unchanged.
Tag v0.4.0 identifies the compiled source d75f5f3; subsequent changes only affect
documentation/publication tools. Code and tag on origin.

App settings: explicit check, cancellable download and official Tauri installation
with mandatory verified backup. Stable Forgejo API discovery with a unique
latest.json or configurable HTTPS manifest. No client account, startup check or
campaign uploads. Signature bound to package and version.
Before every installation: complete .nodex with managed images/attachments and
SHA-256/preferences receipt in update-backups. Failure blocks the installer;
Store locked until handoff, active AI rejected, backups never deleted.
Encrypted private key/Windows DPAPI password outside Git; client contains only the
public key. SQLite 015/appID unchanged. AI weights/runtime separate. docs/UPDATES.md.

Checks actually performed:
- pnpm test PASS: 136 tests / 32 files; lint/typecheck/build/format:check PASS.
- cargo test offline PASS: 96 unit tests + 1 cryptographic integration test. The
  real-package test, ignored in ordinary runs, was explicitly executed: PASS for
  the final installer's signature and rejection of its tampered copy.
- cargo fmt and clippy --all-targets -- -D warnings PASS.
- Python manifest 4 tests PASS, publisher 4 PASS; MCP Node 5 PASS.
- React Doctor changed 82/100, no new findings.
- Standalone debug desktop/synthetic profiles: screen/version, HTTP rejection,
  unpublished-channel error, then public-channel discovery through both API and
  static manifest, no reinstall of the current version, persistent endpoint after
  restart and ordinary shutdown PASS. Axe: 0 findings in update settings.
- Real backup/restore with images and installer callback blocked on error PASS.
- Updater-signed Windows NSIS built; licenses/fonts and mcp.mjs inspected inside
  the setup. 32,006,516 bytes; SHA-256:
  c8d4f7138b5be438f05ee1511f55676e109cc37cb340bd0ba31d849867da1b15.

Local outputs: installers/Chronexus-0.4.0-Windows-x64, with manifest, setup/signature,
checksums/report/receipt and LEGGIMI. Sources: c7d95ca feature, d75f5f3 licenses,
db8fc68 publisher. Manual bootstrap from versions without an updater, with an
ordinary backup before the first installation; subsequent updates use the new flow.
Limits: a real public upgrade between two updater versions has not yet been run,
installer lacks Authenticode, macOS/Linux not certified, new strings fall back to
Italian. Do not declare personal installations or upgrades performed when they are not.

Skill: tauri-v2/rust-best-practices for updater and Store; react-testing/react-doctor
for UX/regressions; frontend-design for the theme; systematic-debugging for the
Windows test manifesto; webapp-testing for synthetic desktop and accessibility.
The personal browser was stopped by the user in the previous shift and is no longer
monitored. The repository visibility was modified by the user and verified.

Next M15 acceptance: upgrade from 0.4.0 to a subsequent signed release in
isolated environment and macOS/Linux runner. Distribution Milestone M11 still
open for large AI packages; no new uploads of them during M15.
The following checkpoints are historical.

## M14 — hidden integration for external assistants, version 0.3.0

Operational on Windows: authenticated local bridge, disabled at ordinary startup,
stdio MCP adapter included in resources, 18 tools for sessions/notes,
Codex, sheet, party and assets. Writing explicitly enabled on a single
campaign; reads/revisions/etag, no SQL, deletion or AI control.
The integrated assistant remains excluded. No menu or button added.
Clean views updated by events; dirty editors trigger refresh, metadata drafts
preserved and passed saves rejected. SQLite 015 and backups unchanged.
Practical instructions and client configuration: docs/AUTOMATION.md.

Verifications actually performed:
- `pnpm test`: PASS, 131 test / 31 file; including refresh and Codex draft.
- `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm format:check`: PASS.
- `node --test scripts/automation/mcp-check.mjs`: PASS, 5 test.
- `cargo test --manifest-path src-tauri/Cargo.toml --offline`: PASS, 90 test.
- `cargo clippy --manifest-path src-tauri/Cargo.toml --offline --all-targets -- -D warnings`: PASS.
- `cargo build --manifest-path src-tauri/Cargo.toml --offline`: PASS, desktop debug.
- React Doctor changed: 82/100, no new findings (not a full audit).
- App debug Windows + real Node MCP process, separate synthetic profile: PASS
  ordinary startup without bridge, catalog, session/note creation UTF-8,
  passed revision and denied AI, persistence after forced stop/restart,
  credential rotation and refused writing in read-only mode.
- Real `.nodex` backup and restoration with active bridge: PASS in Rust tests;
  subsequent writes use the new Store, credential absent from ZIP.

Limits: the automated graphical closure of the desktop debug did not terminate the
process within 15 seconds even without automation; test failed, no
attribution of cause without evidence. Synthetic processes were closed
forcibly. Bridge cleanup/shutdown verified in Rust tests, not with
native GUI closure. No macOS/Linux/third-party MCP client acceptance. Node must be
installed separately. The new conflict error uses Italian fallback.
No 0.3.0 installer/release published: the native exit verification must be
closed first, without presenting a partial delivery as a verified release.
M11 v0.2.0 retains its own draft and the block on large AI attachments.

Skills used: rust-best-practices, tauri-v2 and sqlite-expert for local services and
shared Store; react-testing/react-doctor for refresh and drafts;
systematic-debugging to distinguish native results from successful tests.

Next check: verify Windows desktop closure and then prepare the
0.3.0 distribution. M11 remains the open publication milestone; no large
uploads were resumed during this request. The checkpoints below are historical.

# Chronexus Status — 24 October 2026

## M12/M13 operative Windows → M11 resume on local network

M12: two SVG dragons, single die extremes (inverted d100), replay without RNG,
skip/reduced movement. M13: Local Espruar/Dethek OFL, v2 preferences compatible
in v1 reading, versioned reversible packets and fallback. SQLite 015 unchanged.

Verifications: 127 frontend test, 81 Rust, 2 Node font/licenses and 13 distribution PASS;
lint/typecheck/format/clippy/i18n PASS; React Doctor changed 100, detector impeccable
without findings. Isolated Desktop: 14 real extremes, replay, mixed rolls, font/fallback,
axe 0; 173 identical rolls after close/restart and real backup/restore.
Windows Installer 0.2.0 built/installed and uninstalled in QA folder; bytes
identical to build except for the official NSIS marker. Release start on personal
profile avoided; start/IPC tested in the isolated debug build of the same source.

M11: code and tag v0.2.0 published (compiled source 43467fb). Release draft
id 2, not published. Lightweight app package (29 MiB) uploaded, re-uploaded and SHA-256
verified; five complete AI ZIPs ready locally, large uploads blocked.
Two independent failed attempts: second HTTP 502 after 297.304.064 bytes in
235,52 s; APIs declare 2048 MiB limit, curl proxy_used=0. No invented server
cause: requested gateway details/logs from user. Authenticated access OK.
Resume authorized by user on October 24, with explicit transport
http://192.168.162.26:3000. The previous stop is bypassed for this delivery.
Local service verified: Forgejo 12.0.4, same repository id 13 and same
public site draft v0.2.0. No change in Git origin or compiled tag.
LAN support added with exact whitelist, redirect block and identity comparison;
18 distribution test PASS. Sending/verifying the five missing attachments still
pending; draft kept until full check. Authentication in RAM only.


Output: installers/Chronexus-0.2.0-Windows-x64-final, six ZIPs (one app plus
five app/AI), SHA256SUMS.txt and package-report.json. Ollama 0.40.10 and Gemma 4 12B
public base, licenses and checksums; no private data. AI actually installed
and repeated execution PASS: cloud disabled, Italian response, 49/49 main layer
and 5/5 GPU draft. Initial package out of limit archived in .tools.
Tools now also report gateway HTTP code; 13 release test PASS.
M11 remains incomplete until upload/download of the five large ZIPs and exit from
draft. Remaining limits: signature, macOS/Linux, personal upgrade and M10 revisions.

Skill: find-skills for tool search (no installation required),
frontend-design/impeccable/accessibility for rendering and movement, react-testing and
react-doctor for regressions, Rust/Tauri and systematic-debugging for persistence
and distribution. Details in I18N.md, DICE.md and releases/v0.2.0.md.
The following sections are previous checkpoints.

## M10 — operative on Windows; linguistic and assistive acceptance open

- **App Settings → Language and writing** in the left menu, even without
  campaign: immediate and persistent choice, distinct from campaign AI settings.
  Italian recovery always ordinary, even with damaged preferences.
- 11 natural languages (PT Brazilian, Simplified Chinese, Ticinese in draft),
  Klingon and Rihannsu romanized with partial/fallback lexicon; Italian Braille
  in subset, Morse and SGA Minecraft. 1427 candidate messages for catalog
  natural, local editor fonts/dictionaries. Non-certified translations.
- Arabic RTL/bidi, CJK, local dates/numbers/plurals; decorative glyphs with text
  semantic and reversible laboratory. Names, documents, UUIDs, presets, D&D fonts
  and AI responses remain original. JSON preferences v1 external to backups;
  SQLite **015** and `.nodex` unchanged. No personal archives used in QA.
- **113 frontend tests and 79 Rust PASS**, clippy -D warnings, lint, typecheck,
  format, i18n:check and desktop release build Windows PASS. React Doctor last
  changed: 68, no new findings; impeccable detector without findings.
- Desktop with compiled frontend: **13 languages × 13 views**, three scripts,
  semantically available hidden text, Arabic 760×600, restart, restore
  015 and error recovery PASS. Backup created in DE and restored maintaining EN;
  global JSON absent from ZIP and compared data unchanged. Axe settings
  EN/AR/JA without violations; no complete accessibility certification.
- Five local fonts, real Monocraft failure with readable normal text,
  Unicode Markdown/visual, simulated composition, CJK search and original UUID
  PASS. No remote hosts in observed QA paths. Log/screens in .tools/m10;
  fonts, scripts, maintenance and limits in [I18N.md](I18N.md).

**Start**: `./scripts/Dev.ps1 -Task desktop`; compiled executable
`src-tauri/target/release/chronexus.exe`. Previous installers not regenerated.

**Implementation commits**: 79376ee (preferences and catalogs), af92934 (views and
scripts), a2d0e1c (fixes/acceptance). This checkpoint is completed by the
M10 documentation commit. No remote push.

**Skill usate**: impeccable accessibility for readability/RTL/semantic text;
react-testing and webapp-testing for behavior and Playwright testing of the
project; Rust/Tauri/SQLite for atomic preferences separate from data;
systematic-debugging and react-doctor for regressions and verifications.

**Open limits (5)**: native/Ticinese review and partial invented lexicons;
IME OS and physical assistive devices not tested; macOS/Linux and distribution still to be
validated; additional fonts about 40 MB and editor size warning; pre-existing React
debt on complexity/large components, without new findings in the changes.

**New planning — 24 October 2026**: reversed order at request:
M11 versioned releases and app/AI packages on Forgegit; M12 animated dragons for
extreme outcomes of a single die (inverted d100); M13 Elphic/Dethek alphabets.
None of the three are implemented; M10 revisions already indicated remain open.

**Next planned functional step**: M11, verifying server capacity,
versioning and packages before implementing the release. This request
only swaps the milestones: do not implement or publish now.

**Publication**: origin verified `https://github.com/Acelith/Chronexus.git`.
Permanent instruction recorded to publish future verified milestone deliveries
with versioned releases/packages, unless subsequent prohibition. **No
publication in this execution**, including pushes, remote tags, releases, and uploads.
Modify only roadmap/specifications/guides. Available skills evaluated: no
specialization requires application for this documentary modification.
Verifications of this request: diff and requirements consistency; no application tests,
no build, and no verification of new declared features.

The following sections preserve previous checkpoints and the verification path.

## M9 — operational and tested on Windows

- Dice roller from left menu: d4/d6/d8/d10/d12/d20/d100, mixed compositions,
  quantities from 0 to 50 per type and 1–100 dice per throw. Reset only after
  confirmation; errors retain selection and ID for retry without duplications.
- Campaign history in SQLite 015: values, subtotals, total, date, UUID and
  pagination at 30. OS CSPRNG and rejection sampling in Rust;
  results saved before the scene and unchanged after skip or view change.
- Original local dragons/textures/fire, geometries and figures rendered by code;
  sequence of 2,5 seconds, slot, skip and reduced movement. Maximum 14 representative dice
  in the scene, all values in details and in history.
  The total of the new throw is not anticipated in the history during the sequence.
- 85 frontend tests PASS (12 new), 77 Rust PASS (8 new); clippy -D warnings,
  lint, typecheck, format and Windows desktop build PASS. React Doctor: no
  problems in changes, 74/100 unchanged; impeccable detector: no findings.
- Native check: all types, d100, mixed throws and 100 dice, values compared with
  SQLite, retry, interruption, skip/reduced, isolation and history on 187 synthetic throws
  PASS. Measured times 2528/2520/2524 ms for 1/7/100 dice. No
  Internet request at throw with remote requests blocked; local IPC allowed.
- UI Backup/restore and JSON export 015 PASS; closing and restarting after restore
  PASS with identical results. Archive 014 migrated without loss covered by Rust.
  Arrows/Tab/Shift+Tab/Enter/double Enter and keyboard details PASS; single
  press for double enter. Separate screenshots with explicit fixture for 6/9/100.
- Axe WCAG A/AA on empty scene and result: zero violations detected; visual/keyboard
  verification completed, without declaring certification or proof with NVDA.
  1586×992/1200×800/900×700/760×540 Windows without window overflow.
- Reports/screenshots and synthetic archives: .tools/m9 (ignored). Personal campaigns
  not modified. macOS/Linux, installers updated and physical offline test not
  performed; pre-existing Vite warning on editor chunk weight. No push.
- Commit: 3b0e2ac backend/migration; 7aed999 UI/scene; 5fba9fc detection and
  graphic fixture. Final checkpoint in the subsequent documentation commit.
- Skill: rust-best-practices/sqlite-expert/tauri-v2 for data and IPC;
  impeccable/imagegen for graphics; react-testing/accessibility for testing;
  systematic-debugging/react-doctor for corrections. Next function: M10.

## Visual Editor/Markdown and final testing — 24 October 2026

- Persistent bar with styles, titles, quotes, lists/activities, highlighting,
  alignment, external links and Codex pages, undo/redo. Markdown mode
  directly editable, application, undo, and explicit saving.
- Navigation/closing guard includes the source. Unsupported syntax or
  invalid links keep the draft; UUID and block ID/sources unchanged
  preserved. Visual block formats unchanged preserved in the round trip.
- Test: 73 frontend PASS; baseline 69 Rust PASS from new position (no
  Rust/schema changes). Typecheck, lint, format and frontend build PASS.
  Desktop Windows build from D PASS; final reconstruction after refactoring
  verified in the consolidation commit. Vite warning on editor chunk still present.
- Repeatable desktop test `scripts/qa/gui-editor.mjs check`: PASS on isolated
  synthetic archive; scroll at three resolutions, formats, UUID mentions, blocking
  errors and settings menu. Orderly closing and new opening of the same
  archive: `restart` phase PASS, contents and formats recovered from SQLite.
- AI Repair: Python of the venv on D/CUDA available; Ollama started from D,
  Gemma 4 12B responds «OK» with VRAM detected. No new training performed.
- Guide: `docs/EDITOR.md`; JSON schema v1 and SQLite 014 unchanged; no
  personal campaign modified. Markdown does not represent all Word formats:
  tables, HTML, images and code blocks are explicitly rejected.
- Skill: react-testing, systematic-debugging, react-doctor for checks and corrections;
  impeccable for the final detector (no pattern reported after correction).
- GUI Commit: d5b07a1; graph layout: f8d6b68; movement: 313e056.
  Editor: 64d65c6; M10 in the subsequent documentation commit. No push.
- Final React Doctor on new files included: 74/100, unchanged compared to the
  first scan; one residual complexity warning in the editor component.
  No lint/types error; final impeccable detector: empty array.

## Reference GUI and navigation — 24 October 2026

- Resume the attached composition: dark leather, parchment, local OFL fonts,
  compass rose, original engraving, tabs with icons and side detail of the graph.
  Character illustrations depend on real attachments; no data
  from the example inserted in personal archives. Pixel-for-pixel correspondence is
  with the image not certified: icons, engraving, and data geometry are original.
- Campaign settings and assistant in the left menu. Compact action menu,
  campaign selector and last modification derived from available documents.
- Diary and Codex: list and document scroll independently from the frame;
  old horizontal mobile rule removed even at minimum size.
- Graph with medallion nodes, visible labels, stable layout with
  reduction of crossings on small graphs (duplicate pairs excluded), zoom,
  advanced filters and sources/certainties maintained. Real portrait in detail, if attached.
- Verifications: 14 targeted App/graph tests PASS; typecheck and lint PASS; frontend build
  PASS (pre-existing warning on editor weight). Native tests with isolated fixtures
  at 1586×992, 900×700 and 760×540: no window overflow, independent vertical lists
  and local fonts loaded. Screenshots and reports in .tools/ui-refresh/.
- Skill: impeccable for comparison and final detection; imagegen for materials and
  offline engraving; react-testing for regressions; react-doctor for React diagnosis.
  Editor consolidated in the previous section; multilingual planned as M10.

## Repair after move to D — 24 October 2026

- node_modules links recreated with unchanged lockfile: previous ones
  pointed to C. Relative store in pnpm-workspace.yaml and Dev.ps1 launcher.
- Baseline from new position: 59 frontend tests and 69 Rust PASS;
  typecheck and Vite 8.3.5 PASS. venv Python on D imports PyTorch
  2.14.1+cu130, CUDA available. No personal campaign modified.
- Skill: systematic-debugging for the cause of broken links; tauri-v2
  for portable toolchain verification. GUI/editor remake in progress.

## Milestone and next step

M7 operational and tested on Windows: local assistant with sources, GPU, and history.
**Full acceptance still partial**: missing proof with physically
disconnected network/firewall block. Proxy test and loopback connections are distinct.
M6 macOS/Linux/CI real and revision of the interactive Windows wizard also remain.
M8 operational and tested on Windows: local Gemma 4 12B, campaign settings for
(013), real QLoRA and adapter with backup/restore (014). Acceptance
on other platforms and physical offline/firewall test still pending.
**M9 delivered on Windows. Next functional milestone: M10 — Multilingual.**
M10 added to roadmap: all requested 16 languages/modes, RTL, CJK,
Braille accessibility, Morse, and fantasy alphabets; planning only,
no localization implemented in this intervention.
No push authorized or executed.

The specific D&D 1.5B model was tested on GPU and discarded for quality.
The user explicitly approved Qwen3:4b-instruct multilingual with local sources,
**not fine-tuned D&D**. Verifiable setup and identity: [AI_LOCAL.md](AI_LOCAL.md).

## Actual M8 Verifications

- 69 Rust and clippy tests offline with `-D warnings`: PASS. 59 frontend tests:
  PASS; final touches also covered by 7 targeted assistant tests.
  Lint, typecheck, format and frontend build: PASS. Python Worker: 5 PASS.
- `pnpm build:desktop` and `pnpm package:desktop`: PASS; unsigned Windows
  NSIS installer generated. M8 installation not repeated, do not confuse with M6.
- GPU RTX 4080 SUPER 16 GB: 4 Qwen cases and 4 Gemma with expected result in the app.
  Training from the menu on 4 excerpts/8 steps, then 74 excerpts,
  74 examples/74 steps: weights changed, full coverage, three checks for
  citations/missing information/GPU, activation and a question about the last
  source PASS. Peak PyTorch: 11,705,906,688 bytes (about 10.9 GiB).
- Real cancellation after the first GPU step: PASS, active model unchanged.
  Restart, native backup/restore, removal of only the synthetic model and its
  reconstruction from the adapter without new training: PASS; citations still valid.
- Synthetic 2014/2024 rules kept separate, wrong edition rejected, malicious source
  excluded from answers and blocking training, explicit exclusion: PASS.
  Ollama actually stopped: actionable error and `sentToModel=false`; runtime restarted.
- Python/CUDA backend and checkpoint also verified in the standard path
  `%APPDATA%/it.nodex.desktop/ai-training`. Personal campaigns unchanged.
  Runtime and checkpoint excluded from archives; compact adapters included and verified.
- Repeatable script with synthetic fixtures: `scripts/qa/m8-local-ai.mjs`;
  original reports in `.tools/m8/`, ignored. The new harness's boundaries phase
  was rerun; seed/train/recover/coverage derive from the same native scenarios
  executed before consolidation, without a second complete run of the new harness.
  Temporary derived models removed after import/testing; no physical offline test
  or simulated hardware failure presented as a real check. Missing CUDA covered
  by a controlled test.
- Commits: a99355e settings; 1fde390 training; 4d007f1 full coverage.
  Guide and testing consolidated in the following commit. No push.

## Working features

- M0–M6: campaigns and journal/autosave, Codex UUIDs/backlinks, relationships with
  source and certainty, extended sheet, inventory/spells, FTS5, dashboard, managed
  images in backups, Markdown/JSON export and immutable Logseq originals.
- Parchment/leather/brass theme, ordered/organic graph with filters and details;
  Party on Codex pages; multi-source Open5e wiki with offline cache.
- Optional assistant, initially disabled: Rust adapter on fixed loopback,
  verified cloud-disabled status, GGUF identity/digest, GPU preflight before notes
  are sent. No download, startup inference, cloud fallback or model tools.
- Lexical retrieval scoped to one campaign and cached rules chosen by edition;
  bounded excerpts with ID/block/revision/hash. Reopenable sources with
  changed/missing warnings; NPC claims never automatically promoted to facts.
- Streaming, cancellation during answers, persistent drafts and recovery.
  Paginated history, confirmed deletion, conversation/source backup and export;
  runtime/weights excluded. No implicit writes to notes/graph/sheet.
- Conservative gate excludes excerpts with possible model instructions. If all
  are suspicious, it stops the request and preserves copies for review.
- M7 schema **012 additive**; old backups migrated in a copy, new backups require a
  compatible version. Legacy it.nodex.desktop/nodex.sqlite3/.nodex identifiers kept.

## M7 checks actually performed

- `cargo test --offline --manifest-path src-tauri/Cargo.toml`: **63 PASS**.
- `cargo clippy --offline --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`:
  PASS. Debug build: PASS.
- `pnpm test`: **55 PASS / 19 files**; final adjustments also verified with the
  3 targeted assistant tests. Lint, typecheck, format:check: PASS.
- `pnpm package:desktop`: PASS, unsigned Windows NSIS installer. M7 installation
  was not repeated; M6 installation/startup/removal had been verified,
  preserving two personal DBs with identical SHA-256.
- Real GPU: Ollama 0.40.10, Qwen3:4b-instruct Q4_K_M, context 8192, **3539 MiB
  entirely in VRAM** on the RTX 4080 SUPER. Performance depends on load.
- Final Benchmark **40/40 expected results**: 20 campaign, 10 original rules of
  test in conflict between editions, 5 absences with GPU inference; 5 attacks blocked
  before the model. Canonical data unchanged. Not universal accuracy.
- Native tests: streaming, cancellation after GPU token with non-empty draft,
  navigation, cited block, rename, 2024 rules, delete, backup/export: PASS.
- Restore and second restart without Ollama: identical **90 conversations/sources/
  metrics, 25 pages, one Party member and configuration**. Original image
  included in backup/export. No test campaign in personal profile.
- Simulated native protocol errors: cloud active, missing model, CPU,
  OOM, incomplete/malformed/excessive stream, invented citation; no note submission
  in the first four cases. Runtime actually absent: error preserved.
- Cloud disabled + external proxies unreachable: successful real inference;
  **80 samples, 173 runtime/executor connections, only 127.0.0.1**.
  Not a physical offline test or firewall verification. No GPU failure provoked.

## Pre-existing private campaign

Speratia M6: 84 sessions, 209 pages, 18 assets, 36 images, 207 original Markdown.
Backup schema 009 verified in build 011 during M6; UUID/checksum preserved.
Partial Oran transcription; current PFs reported unreadable, to be updated.
Backup already delivered: C:/Users/Joel/Downloads/Speratia_Chronexus_M6_2026-10-23.nodex
(52.321.017 bytes), SHA-256
58a3e5fdc05670b46536c911eb92e5c83d7b8f86b5721c3cadda5b893fd714c.
Restore replaces the entire archive with a preventive copy, does not merge campaigns.
Archives/photos/DB/profiles/models remain outside Git; no private data published.

## Commit M7

- e6f1763 feat(ai): integrates local GPU inference and persistent conversations
- a89874e fix(ai): avoids duplicate tests and retrieves party roles
- d63ba16 fix(ai): restricts sources to names present in the prompt
- cf39425 fix(ai): excludes suspicious instructions before inference
- 4ac9f7f feat(ai): adds assistant interface and local startup
- Guide and final checkpoint: see the last Git commit.

## Startup, Skill and limits

App M8 installer in root: `installers/Chronexus-M8-Windows-x64/`.
The previous `Chronexus-0.1.0-Windows-x64/` contains the M7 distribution and its
Qwen runtime; it was not overwritten. The new app installer does not incorporate
the Google checkpoint from 24 GB or the QLoRA environment. On this machine the backend
is already prepared; for other computers follow [AI_TRAINING.md](AI_TRAINING.md).

Startup: `powershell -File scripts/Start-LocalAI.ps1`, then the new Chronexus
or `pnpm desktop` in the configured Rust environment. Campaign → Campaign Settings
→ Check Ollama → gemma4:12b → confirm multilingual → Activate.
Retrain on new data and Activate adapter are two distinct actions.
Installer details and limits: [INSTALLERS.md](INSTALLERS.md).

Skill M8 read/applied: **vercel-react-best-practices**, for conditional loading,
independent local requests, progress and error recovery.
AI Skills/databases missing from the catalog were not applied.

Skill M7 effectively read/applied: **vercel-react-best-practices**, for
deferred loading, independent requests, and streaming updates.
The existing theme is maintained; no new AI/Rust/database Skill is available
applied. Skill/design M6 research already documented in RESEARCH_DND.md.

Limits: structurally controlled citations, not semantic truth; verbose model
and non-expert D&D trained ad hoc; lexical gate with possible false
positives/new attacks. Retrieval by extracts, not entire campaign or embeddings.
Wiki primarily English/expellable cache; a single playable PG, Party in Codex;
large bundle editor, manual backups. Next verifications: physical offline M7 and
residual M6 activities macOS/Linux/CI and Windows wizard. See ROADMAP.md.
## M10 in progress — linguistic foundations

Global preferences versioned in `interface-preferences.json`, independent from
campaign backups and without SQLite migration (015 unchanged). Global menu
Language and writing available even without a campaign; change without restart,
Italian restoration, fallback, and bidirectional isolation. Catalogs in preparation:
automatic translations are not linguistic revisions. No campaign data
is sent to the model: local preparation reads only UI strings.

Foundation verifications: 3 frontend test and 4 selected Rust test passed;
TypeScript and lint passed after correcting the error pattern.
React Doctor: 84, no regression compared to the M9 reference 74.
Skill: accessibility, react-testing, impeccable for settings and semantic text;
Rust/SQLite/Tauri for atomic local preferences, without changing saved data.
Remaining to complete: integration of all views, transcriptions, catalogs,
desktop testing, and final documentation.
### M10 — verified integration, desktop testing in progress

Views connected to catalogs: 1429 candidate messages for each
natural language, Italian fallback, local BlockNote dictionaries, local dates/numbers,
search plurals, and offline Arabic/CJK fonts. Translations are drafts:
correct Portuguese terms remained in English; Chinese normalized with OpenCC.
Klingon/Rihannsu: only verified lexicon and Italian for the rest; glossary with
romanized script. Six-dot Italian Braille in literary subset,
Morse and SGA Minecraft/Monocraft: decorative labels with semantic text,
reversible laboratory and Italian recovery. No conversion of notes.

Checks performed: 113 frontend tests passed, TypeScript and lint passed.
Current React Doctor: 63 and no new findings in changes; comparison
repeated with the same tool on commit M9 6ef5222: 61. Historical scores
74/84 are not comparable with this execution/version. Resolved new
reports on formatter and components, separating backup dialog, images, and job.
The backup dialog now uses native dialog; jsdom requires a shim in the test only.
Primary desktop tests: 13 languages × 13 views and axe EN/AR/JA without detected violations.
To finish: native transcriptions, restart, restoration, font/IME, and final build.
Skills added to verification: systematic-debugging and react-doctor for regressions;
webapp-testing for reconnaissance and browser tests, using the existing Playwright JS
runner in the project. Linguistic revision and real assistive testing not performed.
### M10 — acceptance corrections and final tests

Corrected main labels and counts (including Items in German), added
repeatable editorial lexicon in core-labels.json, normalization/pruning
catalogs, full sentences in restore confirmation and translation of backup/export statuses
and known public diagnostics. Corrected CSS of hidden semantic text:
the "transcription only" choice works, preserving the accessible name.
Restore dialog centered, smooth, and readable in the minimum window.

Tests: 113 frontend and 79 Rust PASS; typecheck/lint/format and clippy PASS;
1427 catalogs natural keys with intact parameters; React Doctor last 68,
no new findings on changes (baseline M9 repeated: 61).
Impeccable Detector executed: no findings. Desktop release build PASS.
Native on frontend compiled: 13×13 matrix PASS, three transcriptions and hidden
semantic text PASS; axe settings EN/AR/JA without violations. Restart,
backup/restore 015, Escape/focus of the dialog, corrupted preferences recoverable
PASS. Backup created in DE and restored maintaining EN: preference actually
external to the backup; also verified the absence of the JSON in the ZIP archive.
Five local fonts and Monocraft absent, Unicode Markdown/visual, composition
simulated, CJK search and UUID of the first block PASS. Real OS IME not tested.
No real campaign open and no remote host contacted in QA paths.
Details, scripts and limits: docs/I18N.md. Linguistic/assistive review open.

M13 implemented: Espruar/Dethek with original OFL fonts, semantic fallback,
v2 preferences compatible in v1 reading and reversible versioned packages.
37 targeted frontend tests + 2 Node font/licenses + 6 Rust preferences PASS;
typecheck/lint PASS; React Doctor changed 100/100. Native/distribution QA pending.
The additional DiceSceneFeedback refactor resolves the finding remaining in commit M12:
the first DiceCast extraction, alone, was not sufficient.

M11 final: the five valid ZIPs are in installers/Chronexus-0.2.0-Windows-x64-final;
core 1972,7 MiB, volumes 1800/1800/1800/1806,4 MiB, all below the 2048 limit.
Real and repeated AI installation PASS, no overwriting. The old out-of-limit
test is archived under .tools, excluded from delivery. Remote publication
still to be executed and verified; not declared finished in this commit.
