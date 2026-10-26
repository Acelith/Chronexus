# App and server audit — 26 October 2026

## Outcome and scope

**14 actionable findings: 12 P2 and 2 P3**, including an existing localization
blocker, a previously observed publisher race, and a backup size limit whose
consequences are now reproduced. These are distinct from **97 React Doctor
warnings**, which are hypotheses, not 97 confirmed bugs. No P0/P1 compromise,
remote code execution, authorization bypass or database corruption was established.
This is a bounded engineering audit, not proof that no other problems exist.

Audited source: app `e404194e5f07c6de700a8524d5b1ce0c362c6ebd`, server `7784820`
(local checkout). Published app 0.9.2 and server 0.1.0 were not replaced. No
production service was probed or changed, no credentials were collected, and no
personal campaign data was used. Source fixes are **not** part of this delivery.

P2 means a concrete correctness, recovery, privacy or release reliability problem
to address before relying on that workflow. P3 means a narrower information or
presentation defect. Confidence is high for the reported behavior; exposure and
preconditions are stated separately. A passing reproducer below asserts the
current *faulty* behavior, not that the issue is fixed.

## Prioritized findings

| ID | Priority | Area | Confirmed behavior |
| --- | --- | --- | --- |
| A01 | P2 | Archive/update | Valid live data can outgrow the backup format and block backups, updates and restore safety copies |
| S01 | P2 | Server restore | The replacement becomes active before migration and session revocation succeed |
| R01 | P2 | Publishing | Two publishers can upload duplicate assets, including two `latest.json` files |
| R02 | P2 | Publishing | Anonymous verification can fail after the release has become public |
| R03 | P2 | Release gate | Publishing does not enforce the required production-key signature test |
| A02 | P2 | Drafts | New Codex metadata drafts disappear during navigation without a guard |
| A03 | P2 | Campaign navigation | A late refresh of campaign A can overwrite the visible lists of campaign B |
| A04 | P2 | Graph | Switching from a loading assertion to a mention leaves the loading flag stuck |
| A05 | P2 | Herald | The announcement can open after the user starts writing during an awaited check |
| A06 | P2 | Keyboard | App shortcuts still act behind the native herald modal |
| S02 | P2 | Server events | Backpressure retains revoked streams and consumes connection slots |
| A08 | P2 | Localization | Eight catalogs and nine installer languages remain incomplete; release gate fails |
| S03 | P3 | Server privacy | Generic SSE hints disclose private activity timing in two scenarios |
| A07 | P3 | Localization | Dynamic UI labels bypass the catalog and its static coverage |

### A01 — Valid archives can become unbackuppable

Evidence: `src-tauri/src/backup.rs:20–21,80` limits a file to 256 MiB and the
archive contents to 512 MiB. Session creation has no aggregate capacity limit
(`journal.rs:146`); each document may contain up to 2,000,000 bytes
(`journal.rs:228`). Images allow 20 MiB per image and 100 per owner
(`images.rs:13,186`), also without a matching archive-wide budget.

A synthetic schema 021 database with 140 individually valid session documents
of 1,990,164 bytes reached **279,371,776 bytes**, with SQLite integrity `ok`.
The actual read-only backup acceptance test completed validation and then failed:
`Invalid backup: a file exceeds the 256 MiB limit. The current archive was not replaced.`

This blocks manual/periodic backups, the mandatory pre-update backup
(`updates/safety.rs:80`) and the safety copy before restore (`backup.rs:737`).
The protective refusal preserves the current archive, but leaves the user unable
to use those maintenance paths. No advance capacity warning was found in the
examined backup UI/docs. Deleting rows need not shrink the SQLite file.

The old `docs/AUDIT.md` O-05 recorded the aggregate cap as a low risk; this
reproducer establishes the practical upgrade/recovery trap. Preserve bounded
imports while aligning the format with permitted live growth: a versioned,
streamed format or explicit preventive capacity management, plus a recovery path
for already large archives. Do not merely remove all import limits.

### S01 — Server restore activates an incompletely prepared replacement

Evidence: server `src/backup.rs:125–132,221–225`. `verify` checks integrity,
identity/version, counts and image checksums, but not the complete expected schema.
`restore` moves the original aside, activates staging, and only then opens/migrates
the database and revokes sessions.

Two synthetic probes pass. First, an integrity-valid schema 6 backup with
incomplete tables passes `verify`; restore returns an error after replacing the
healthy active file. The original survives as `.pre-restore`, but is not
automatically reactivated. Second, local fault injection makes session revocation
fail: restore reports failure while an old bearer from the backup remains valid
against the newly active database. The trigger used for fault injection is **not
a remote attacker capability**.

Validate the full supported structure, migrate and revoke sessions on staging,
then validate again before activation. Activation failure must preserve/restore
the original active state. Add failure-path tests, not only successful recovery.

### R01 — Publisher concurrency recreates duplicate release attachments

Evidence: `scripts/release/publish_app_update.py`, `publish`: receipt load, asset
listing and the upload loop are not protected by a publication lock or atomic
reservation. Each process trusts its own initial asset/receipt snapshot.

Two local fake clients, synchronized after reading the same empty release,
both complete successfully and create six assets: **two of each required file**.
This reproduces the already observed 0.9.0 incident without touching Forgejo.
`src-tauri/src/updates/network.rs:106–109` correctly rejects multiple manifest
assets, so this race can disable the update channel.

Serialize publication by repository/tag, atomically maintain receipts, and re-list
and verify the exact unique asset set before finalization. A machine-local lock
alone does not serialize independent publishing machines; define the supported
single publisher or use a server/CI serialization mechanism. Keep the refusal to
overwrite existing releases/assets.

### R02 — Public verification happens after finalization

Evidence: `publish_app_update.py`, finalization block: `PATCH {draft:false}`
precedes anonymous asset, canonical manifest and stable API verification.
A simulated anonymous download failure raises an error while the release is
already public and the receipt lacks `published:true`.

Authenticated draft checks do protect against the tested corrupt draft asset;
they cannot prove anonymous access to a still-private draft. Model the public
verification phase explicitly, preserve a resumable partial-publication state,
and report it accurately. The CLI HTTP error message currently says
`draft preserved` even when a post-publication HTTP failure occurs. Do not promise
that all failure paths leave a draft, and do not silently delete public assets as
an attempted rollback.

### R03 — The signature verification prerequisite is manual

Evidence: `publish_app_update.py:validate` compares hashes, target/version and
signature text equality, but does not cryptographically verify the package or
require evidence of the production-key verification test. `updater_manifest.py`
checks the encoded trusted-comment version and explicitly delegates cryptography
to the Rust test/client. `Build-SignedUpdate.ps1` builds/signs but does not execute
that acceptance test either.

A local probe supplies an invalid synthetic signature, matching manifest/report
hashes and simulated valid Git state: the real `validate` accepts it. This requires
an operator-supplied bad package/report; it is **not a bypass of the installed
Tauri client's signature verification**. The client still rejects bad signatures.
Previous release records include manually executed signature tests; this audit
does not claim those published packages are invalid.

Make production-key/version/tamper verification a mandatory publication step
bound to the exact artifact bytes. Preserve the independent client check.

### A02 — Codex metadata drafts lack navigation protection

Evidence: `src/features/knowledge/CodexWorkspace.tsx:79,217,238–245`.
`PageForm` owns local form state but does not register it with `SaveGuard`;
the document editor's separate guard does not cover this form.

Reproducer: open New page, type a title, switch to Journal, return to Codex.
The draft is gone without a save/confirmation. Register metadata dirty state and
define save/discard/cancel behavior for navigation and campaign switching.
Campaign/session forms share a similar pattern, but were not independently
reproduced and are candidates rather than additional confirmed findings.

### A03 — Late campaign refresh overwrites the new campaign's lists

Evidence: `src/App.tsx:128–140,301`. An external refresh captures `loadVersion`,
but `selectCampaign` does not invalidate that version. Listener cleanup prevents
new callbacks, not completion of one already running.

Reproducer: start refresh A; switch to B and complete B's reads; then resolve A's
read. The heading remains B while session/page lists show A and B's session is
absent. No database corruption or cross-campaign write was demonstrated.
Invalidate pending reads on selection and check both generation and campaign ID
before each state update. Test reversed completion orders.

### A04 — Graph loading stays stuck after selecting a mention

Evidence: `src/features/graph/GraphWorkspace.tsx:123–139` and
`GraphCanvas.tsx:76–78`. Selecting an assertion starts an async read. Selecting a
mention increments the selection generation but does not clear `relationLoading`;
the old request's `finally` correctly ignores the new generation, leaving the
flag true. Canvas edge callbacks remain available during loading.

The synthetic canvas callback sequence leaves “Opening relationship…” and a
disabled New relationship button until reset/remount. Clear loading for the new
non-loading selection, or derive status from a selection-scoped state machine.

### A05 — Herald idle check has an asynchronous gap

Evidence: `src/features/updates/useStartupHerald.ts:48–62`. The hook checks
focus/dirty conditions before awaiting `heraldApi.blocked()` and opens the
announcement afterward without repeating those checks.

A deferred response followed by focusing/typing in a textarea opens the modal
over the new edit. Focus and guard state can change without a parent rerender,
so effect cleanup is insufficient. Revalidate eligibility after the await and
immediately before display; retain the compatible-release and reminder checks.

### A06 — Global shortcuts omit native dialogs

Evidence: `src/App.tsx:402` only checks `[role=dialog],[role=alertdialog]`,
while `src/features/updates/HeraldAnnouncement.tsx:81` uses a native `<dialog>`.
With that dialog open, the synthetic Ctrl+Shift+N test opens New session behind it.

Include open native modal dialogs in the shortcut guard and test actual modal
focus/inert behavior on supported desktop platforms. This audit reproduced the
handler behavior in jsdom; it did not run a fresh native Windows keyboard test.

### S02 — Backpressure prevents revoked event streams from releasing slots

Evidence: server `src/events.rs:127,136,140`. Bounded-channel sends await outside
the select loop, so a full queue stops subsequent authorization/lifetime checks.

The router-level probe holds three unread response bodies, fills their queues,
revokes the old sessions and logs in again. Across 101 seconds of advanced Tokio
keepalive ticks the new valid session still receives 429: old streams retain all
three account slots. This is **not** an external network load test or a test of
ten minutes of real wall-clock lifetime (`std::time::Instant` is not Tokio time).

Use coalesced/nonblocking hints or bounded sends selected together with
cancellation, authorization and expiry. Test cleanup when consumers stop reading.

### A08 — Known localization gaps remain release-blocking

Fresh read-only audit: **1,305 explicit UI messages**, zero unregistered static
sources and zero parameter mismatches. Italian has zero missing explicit UI
translations; German, French, Spanish, Portuguese BR, Japanese, Korean,
Simplified Chinese and Arabic each lack **267**. NSIS supports only Italian;
English and the other eight requested installer languages are missing.

The full candidate inventory also contains 13 missing Italian and 694 in each
other catalog; those candidates include non-UI content and must not all be
presented as visible bugs. See `docs/I18N_AUDIT.md` for the earlier baseline
(1,303 messages, before the OS-language change).

The strict gate exits 1 as designed. This is an existing tracked blocker, not a
new discovery and not a reason to weaken the gate. Complete M28 and validate
native layouts, long translations and RTL. The static catalog pass alone cannot
prove visual completeness or catch arbitrary dynamic strings (A07).

### S03 — Event hints disclose private activity timing

Two independent probes confirm the documented “private edits notify their author
only” rule is not preserved in all paths:

- Server `src/events.rs:120–121`: broadcast lag emits an unscoped `changed` hint.
  Bob subscribed only to his own campaign receives it after 100 private writes
  by Alice in a different, inaccessible campaign.
- Server `src/content.rs:546–547`: deleting any page marks the event public.
  Deleting a never-shared private page with no public dependencies notifies
  another member of the same campaign.

Only existence/timing of activity is exposed: **no content, item ID or author is
included**. Scope lag notifications by authorized audience and notify other
members of deletion only when previously shared content/dependencies require it.

### A07 — Dynamic labels escape localization coverage

Evidence: `src/features/player/AssetForm.tsx:115,117` renders `Add oggetto` and
`Add incantesimo` in English; both were rendered in the synthetic tests.
`src/features/journal/Editor.tsx:233,238` constructs `Create draft «…»`,
` · Draft` and ` · Aliases:` directly (source inspection).

These are additional to A08's static missing keys. Use complete parameterized
messages and localized display-kind labels, preserving canonical stored kinds.
Extend coverage to dynamic label construction and assert representative non-English
editor suggestions; do not translate user note/alias contents.

## Dependency, accessibility and performance observations

- `pnpm@11.25.0 audit --json`: zero known npm advisories, 343 total dependencies
  reported. This is registry advisory coverage, not a source security proof.
- Official `cargo-audit 0.22.2`: zero **vulnerability-class** advisories for both
  lockfiles. App still has `RUSTSEC-2024-0429` (`glib 0.18.5`, **unsound** iterator)
  and `RUSTSEC-2024-0370` (`proc-macro-error 1.0.4`, unmaintained). Server has no
  warnings. The glib issue concerns the Linux GTK dependency chain; reachability
  from the app was not established. Do not claim “zero Rust security warnings”.
  These two advisories were already documented in the M23 audit.
- RustSec database: 1,378 entries, commit
  `a78282a1414d6c28cc228c4eae3570451affb0dc`, updated 26 October 2026.
  [glib advisory](https://rustsec.org/advisories/RUSTSEC-2024-0429.html),
  [proc-macro-error advisory](https://rustsec.org/advisories/RUSTSEC-2024-0370.html).
- React Doctor **0.9.18**, full scope, schema 3 report: coverage complete,
  202 analyzed/scanned files, no skipped checks, zero errors, **97 warnings** in
  29 files, score **63/100**. Categories: 37 maintainability, 15 performance,
  13 accessibility and 32 tagged as bugs by the tool. Source revision matches
  the app audit revision. No exclusions or rule suppressions were added.
- Eight custom-dialog and five autofocus warnings need runtime keyboard/screen
  reader review. They are not 13 established WCAG failures. A06 is independently
  reproduced. No fresh native screen-reader, contrast, RTL or reduced-motion
  certification was performed.
- Five repeated Intl formatters, eight lookup patterns, one context value and
  one eager state initializer are optimization candidates. No measured user-facing
  slowdown was established. Nineteen complex functions and sixteen giant components
  identify maintenance hotspots, not automatically unsafe behavior.
- Vite succeeds but warns about a **1,053.53 kB** minified editor chunk
  (310.41 kB gzip). Treat as a cold-load/memory profiling candidate; desktop assets
  are local and the graph/editor are already split. Do not increase the warning
  threshold and call the performance problem solved.
- Full formatting previously reported 78 unchanged files. It was not rerun as a
  fresh global style audit or changed across the tree during this audit.

## Method, negative results and coverage limits

Skills actually consulted/applied: **find-skills**, **sharp-edges** and
**variant-analysis** for selecting tooling, unsafe API/default review and expanding
known root causes; **systematic-debugging**, **rust-best-practices**,
**sqlite-expert**, **react-doctor**, **react-testing** and **accessibility** for
domain review and synthetic validation. Trail of Bits skills were installed only
under ignored `.tools/audit-skills/`. The large-codebase variant workflow explicitly
uses parallel reviewers; archive, frontend and server review were separated.

Primary skill sources:
[Trail of Bits skills](https://github.com/trailofbits/skills),
[variant workflow](https://github.com/trailofbits/skills/blob/main/plugins/variant-analysis/skills/variant-analysis/SKILL.md).
Read the React Doctor canonical triage playbook and retained the pinned JSON
baseline. Diagnostics were followed through callers/guards before promotion to
findings. This request identifies problems; it does not authorize treating every
warning as a requested refactor.

Examined areas include archive/migrations/attachments, restore/update handoff,
publisher receipts/finalization/signature prerequisites, external refresh/drafts,
graph/editor/modal behavior, localization gates, server auth/roles/content/events,
and dependency/configuration boundaries. Targeted app review also checked fixed
loopback AI, cloud-disabled/model identity checks, bounded runtime setup downloads,
Tauri CSP/capabilities and opt-in automation configuration. This was not a complete
line-by-line review of every AI training, wiki/parser or automation path.

Negative results and rejected candidates:

- No server IDOR confirmed. Existing tests exercise campaign isolation, private
  visibility even from the campaign owner, author/revision controls, dependency
  constraints, transactional role checks, operation deduplication, cursor expiry,
  attachment bounds/checksums and recovery.
- Desktop autosave serializes writes and re-flushes newer generations; Player and
  Party register draft guards. No lost autosaved journal note was reproduced.
- The historical translated-title identity bug is already fixed with stable field
  discrimination. Model identifiers are technical pins, not missing translations.
- React Doctor's `find(...)!` in TrainingPanel has a preceding matching guard.
  General Graph/DndCatalog loading warnings have error/finally handling; A04 is
  the separately reproduced stale-generation variant, not that blanket warning.
- Publisher redirects remain on allowed HTTPS paths/origin and checksums are
  bounded. No credential-forwarding-to-foreign-host finding was established.
- Desktop restore uses an inactive generation and schema/content checks; S01 is
  a separate server implementation defect, not evidence that both behave alike.
- No E2EE/CRDT is a documented v1 limitation, not a newly discovered defect.
- Server `backup.rs:218` ignores WAL/SHM move errors: reliability candidate needing
  real filesystem fault reproduction. No journal corruption was demonstrated.

No Docker/Compose, production reverse proxy/TLS, macOS/Linux runtime, Windows
ARM64, physical offline/firewall, power-loss recovery or actual installed upgrade
was tested here. Semgrep/CodeQL were unavailable and were not run. Normal Rust
tests leave explicit hardware/signature/profile acceptance cases ignored; none
were silently counted as passes. A local real-server suite is recorded separately.

## Executed validation and local evidence

All scratch probes, logs, downloaded tools and synthetic databases remain ignored
under `.tools/`; none are committed. These local probe files are evidence for this
workspace, not shipped regression tests or a fresh-clone acceptance suite.

| Check | Actual result |
| --- | --- |
| Full frontend Vitest, two workers | 46 files, **188 passed** |
| Existing targeted frontend tests | 5 files, **21 passed** (subset of the full suite) |
| New frontend behavior probes | 4 files, **7 passed**, asserting defects |
| App Rust library suite | **171 passed, 7 ignored**, zero failed |
| Server existing Rust suite, offline | **71 passed**, zero failed |
| Server synthetic probes | **5 passed**, asserting restore/events defects |
| Release Python unit tests | **27 passed** |
| Synthetic publisher probes | **3 passed**, asserting race/order/gate gaps |
| Archive capacity acceptance probe | **1 failed as expected**, reproducing valid-archive backup refusal |
| Localization scanner regressions | **7 passed** |
| Catalog normalization | Passed |
| Strict localization audit | **Failed (exit 1)** for the gaps in A08 |
| MCP transport checks | **5 passed** |
| TypeScript and ESLint | Passed |
| Vite production frontend build | Passed, large editor chunk warning |
| Server debug build, offline | Passed |
| Desktop/client acceptance against the real local server process | **4 passed**, synthetic accounts/data over loopback HTTP |
| npm / Rust advisory scans | Results and warnings above |

Local reproduction commands (portable Cargo environment configured as in
`docs/DEVELOPMENT.md`):

```powershell
node node_modules/vitest/vitest.mjs run --maxWorkers=2
node node_modules/vitest/vitest.mjs run --config .tools/turbo-audit/frontend/vite.config.ts
python .tools/turbo-audit/release_probes.py
cargo test --offline --manifest-path .tools/turbo-audit/server-probes/Cargo.toml --target-dir ../Chronexus-Server/target -- --nocapture
cargo test --offline --manifest-path src-tauri/Cargo.toml 'sync::tests::live' -- --ignored --test-threads=1
node scripts/i18n/audit.mjs
```

The capacity probe used `CHRONEXUS_QA_BACKUP_PROFILE` pointing only at the synthetic
`.tools/turbo-audit/archive-limit` profile and `CHRONEXUS_QA_BACKUP_OUTPUT` inside
that directory, then ran the ignored exact test
`backup_tests::installed_archive_can_be_backed_up_without_modifying_the_source`.
The source is opened read-only. Never aim audit scripts at personal data by default.

Evidence locations: `.tools/turbo-audit/frontend/{result,existing}.log`,
`frontend-full.log`, `server-probes/src/lib.rs`, `release_probes.py`,
`react-baseline.json`, `rust-app.json`, `rust-server.json`, `i18n.log`,
`vite-build.log`, `sync-live.log`, `server-build.log`, plus `.tools/turbo-rust-app.log` and
`.tools/turbo-npm-audit.json`. Large synthetic databases are intentionally not
included in version control.

## Recommended delivery order

1. Fix A01 and S01 with capacity/failure recovery acceptance. Preserve existing
   user archives and old backup compatibility; do not bypass mandatory backups.
2. Fix R01–R03 before another publication; test concurrency and partial success
   without modifying an existing remote release.
3. Fix A02–A06 and S02–S03 with durable regression tests for navigation,
   reversed responses, modal input and scoped event backpressure.
4. Complete **ROADMAP M28 — Complete translations and multilingual installer**,
   including A07/A08 and native layout checks. It remains the next exact planned
   milestone by the current priority table, followed by M29 and M30; M25 still
   requires deployment/TLS acceptance. No new release is claimed by this report.
