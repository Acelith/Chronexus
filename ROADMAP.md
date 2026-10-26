# ROADMAP.md — Chronexus: milestone and real delivery order

Updated on 25 October 2026. The historical numbering M0–M15 remains stable to
avoid ambiguity in commits, guides, and releases. The suffixes **a/b/c/d** identify
extensions inserted between existing phases: those already delivered are retrospective;
M16 was executed before M15a at explicit request; sections remain
in the original order to avoid moving references, the table follows Git.
The sections and the table follow the order of Git implementations, not the
numerical order of the IDs: **M12 and M13 precede M11**, executed at the end upon request.
Dates indicate deliveries/start of work, not a multi-platform certification.
Partial phases remain at the point of the first implementation; subsequent completions
are indicated in the status, without pretending they occurred earlier.

## Method and status

- Execute only the milestones or parts authorized by the user. On 25 October
  the user requested to execute M16 and then M15a: both implemented, IDs unchanged.
- Divide the work into verifiable parts: implementation, real tests,
  corrections, detailed commits, and checkpoints in docs/STATUS.md.
- «Windows Operational» does not mean full acceptance on macOS/Linux,
  linguistic revision, or personal installation. Keep residuals visible.
- Original milestones and retrospective extensions share the same code:
  they are not features to be implemented a second time.
- M16 and M15a are included in the 0.5.0 release. M17 introduces the local translation of the wiki at the request of 25 October 2026.

## Chronological log

| Order | Milestone | Delivery | Date | Git Evidence | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | M0 | Desktop foundation and SQLite | 23/10/2026 | `6b7c073` | Windows |
| 2 | M1 | Campaigns, sessions, editor/autosave | 23/10/2026 | `34f480b → 414415b` | Windows |
| 3 | M2 | Codex, mentions and backlink | 23/10/2026 | `e9c1fc0 → 5a8034d` | Windows |
| 4 | M3 | Relations and navigable graph | 23/10/2026 | `4e27374 → eecab02` | Windows |
| 5 | M4 | Backup and restore | 23/10/2026 | `02f77cd → 8277c78` | Windows |
| 6 | M4a | Rename Chronexus | 23/10/2026 | `9eabd4d` | Delivered |
| 7 | M5 | Sheet, inventory and spells | 23/10/2026 | `e756ea4 → e964e94` | Windows |
| 8 | M5a | Reference sheet and SRD catalog | 23/10/2026 | `a15366e → 55dea13` | Windows |
| 9 | M6 | Search, images/backup, export, summary, Logseq and first distribution | 23/10/2026 | `70e7880 → f984a3c` | Windows; other OS open |
| 10 | M6a | First medieval theme/graph restyling | 23/10/2026 | `b22a033` | Windows |
| 11 | M6b | Party and member knowledge | 23/10/2026 | `dc29fe6 → f5bb67b` | Windows |
| 12 | M6c | Multi-source Open5e Wiki | 23/10/2026 | `d765db1` | Windows |
| 13 | M6d | Readability of dense graphs | 23/10/2026 | `6735251` | Correction delivered |
| 14 | M7 | Local assistant with GPU | 23/10/2026 | `e6f1763 → 4ac9f7f` | Windows; physical offline open |
| 15 | M7a | Local app + AI installers | 23/10/2026 | `24946bc` | Local packages |
| 16 | M8 | Campaign settings, Gemma and QLoRA | 24/10/2026 | `a99355e → 9baee29` | Windows |
| 17 | M8a | Repair after C → D move | 24/10/2026 | `313e056` | Delivered |
| 18 | M8b | Reference GUI, settings menu, scroll and graph | 24/10/2026 | `d5b07a1 → f8d6b68` | Windows |
| 19 | M8c | Visual editor and Markdown source | 24/10/2026 | `64d65c6` | Windows |
| 20 | M9 | Dice roller and history | 24/10/2026 | `3b0e2ac → 6ef5222` | Windows |
| 21 | M10 | Alternative languages and scripts | 24/10/2026 | `79376ee → 3eaf56a` | Windows; open revision |
| 22 | M12 | Animated dragons on the edges | 24/10/2026 | `45c0268` | Windows |
| 23 | M13 | Espruar and Dethek | 24/10/2026 | `26d1c83` | Windows |
| 24 | M11 | Forgegit app/AI distribution | 24/10/2026; app completed 25/10 | `43467fb → 4abb4e3; M15` | Partial: large open AIs |
| 25 | M14 | Hidden external MCP assistants | 25/10/2026 | `fa38d2e` | Windows |
| 26 | M15 | Updater, pre-installation backup and release 0.4.0 | 25/10/2026 | `c7d95ca → ad7760d` | Windows; public channel |
| 27 | M16 | Wikidot scraping, source selection and deletable cache | 25/10/2026 | `2fbf17a → 923516f` | Windows; other OS open |
| 28 | M15a | Epic update announcement: vassal, trumpet and manifesto | 25/10/2026 | `126d250`, `daed026` | Windows; release 0.5.0 |
| 29 | M17 | Local wiki translation into the app language | 25/10/2026 | `b4f04c4` | Windows; release 0.6.0, open linguistic revision |
| 30 | M18 | Replacement of Qwen models with local Qwen3.8-27B | Implemented Windows | 018 | Real qualification and comparison, secondary Gemma; other OS pending |
| 31 | M21 | New visual identity: herald logo, app icon and branding | 25/10/2026 | `467ca7b` | Windows; release 0.8.0 |
| 32 | M22 | Guided installation of Ollama and models from settings | 25/10/2026 | `54a6b42` | Windows; release 0.8.0 |
| 33 | M20 | Quality README with images, quick guide and credits | 25/10/2026 | `d1d1e89` | Render verified on github.com |
| 34 | M19 | Backup folder in Documents, periodic and update backups | Delivered on Windows, release 0.8.0 | — | Moved to the bottom on user instruction; executed on October 25 2026 |
| 35 | M23 | Full code audit: bugs, duplication, multilingual support, remove Ticinese/Romulan/Klingon, optimization | Planned, **next** | — | Requested on 25/10/2026 |
| 36 | M24 | Shared campaign with self-hosted server and selective sharing | Planned | — | After M23; server confirmed, in a separate repository |
| 37 | M25 | Android App (APK) connected to the server with the same account | Planned | — | Depends on M24 |
| 38 | M26 | English-first app, manifests, documentation and AI instructions | Implemented Windows, source 0.8.1 | — | Existing data/locales preserved; not published |


## M0 - Foundation and real local database

**Updated status:** Operational on Windows. Foundation and real archive; untried platforms are not declared accepted.

**Git Evidence:** `6b7c073`. Verifications and limits in [docs/STATUS.md](docs/STATUS.md).
Goal: a bootable Tauri 2 / React / TypeScript desktop app backed by a real Rust + SQLite persistence layer.

Deliverables:
-" Initialize or safely adapt repo, package manager (prefer pnpm), Vite + React + TypeScript strict, Tauri 2 Rust project.
-" Cohesive app shell in Italian: sidebar, navigation, dark theme, empty states, no fake product data presented as real.
-" SQLite initialization in OS app-data directory and first reversible/traceable versioned migration.
-" Typed bridge to Rust commands; clear error handling, no raw SQL in React.
-" Basic read/write smoke operation proving data survives app relaunch (test or repeatable manual smoke procedure).
-" Scripts for dev, lint, typecheck, test, Rust test and build; gitignore, README setup for Windows/macOS/Linux, `docs/STATUS.md`.
-" Initial focused tests and a meaningful Git commit with exhaustive message body.

Acceptance:
-" Dev app boots (if build environment supports Tauri).
- Typecheck and available local tests pass; startup with empty DB is handled.
- DB schema is migrated once and remains valid on second startup.
- No remote API required at runtime.

## M1 - Campaign/session first useful vertical slice

**Updated status:** Operational on Windows: campaigns/sessions, editor and persistent autosave.

**Git evidence:** `34f480b`, `414415b`. Verifications and limits in [docs/STATUS.md](docs/STATUS.md).
Goal: create campaigns and journal sessions with **real, local persistence**.

Deliverables:
- Create, select, rename campaign (archive optional until later).
- Session list and new session form: sequence number, title, optional date.
- Editor supports at least plain note blocks and basic formatting via chosen block-editor integration; SQLite stores canonical editor document.
- Autosave with saved/saving/error indicators; journal reopens accurately after app restart.
- Delete/archive needs confirmation and no accidental cross-campaign data access.
- Tests for DB round trip, campaign boundaries, autosave logic and basic screen behaviors.
- Commit important units separately (e.g. persistence, session editor) with detailed bodies.

Acceptance:
- Create campaign -> create session -> write 2 paragraphs -> restart app -> see identical saved notes and session order.
- Invalid input and data-write failures generate an intelligible UI error, not silently erased notes.

## M2 - Codex pages, `[[links]]` and backlinks

**Updated status:** Operational on Windows: pages, UUID, mentions and persistent backlinks.

**Git evidence:** `e9c1fc0`, `5a8034d`. Verifications and limits in [docs/STATUS.md](docs/STATUS.md).
Goal: the first useful Logseq-style knowledge workflow.

Deliverables:
- Typed knowledge pages, optional aliases and stable IDs.
- `[[` mention autocomplete, select existing or create new/stub page, link display and navigation.
- Persist mention index derived from canonical editor content.
- Backlinks with source session and block preview.
- Rename page -> backlinks/links still resolve; ambiguous aliases are resolved explicitly.
- Tests for link extraction, creation, missing/renamed page, ambiguous name, campaign separation.

Acceptance:
- Type `[[Varek]]` from Session 12, navigate to Varek, see Session 12 backlink, rename Varek, link remains valid after restart.

## M3 - Meaningful graph

**Updated status:** Operational on Windows: explicit relationships distinguished from mentions and source navigation. Subsequent restyling is M6a/M6d/M8b.

**Git evidence:** `4e27374`, `eecab02`. Verifications and limits in [docs/STATUS.md](docs/STATUS.md).
Goal: navigable graph with evidence-aware typed relationships, not a decorative network.

Deliverables:
- Cytoscape graph sourced from the database with separate mention and asserted-relationship edges.
- Manual add/edit/remove asserted relationship, direction, label, certainty and optional session/block evidence.
- Node click -> page; edge click -> relationship/source evidence.
- Filters by entity type, certainty and depth (1-2 hops), graph legend, loading/empty states.
- Tests for graph data query and no accidental conversion of co-occurrences into factual assertions.

Acceptance:
- Varek and Guild can both occur in a note without an inferred alliance; an explicit suspected accusation appears as a labeled, differently styled graph edge.

## M4 - Portable backup and recovery (protect the data early)

**Updated status:** Operational on Windows: portable backup, validation, and protected restoration. Managed images were added in M6, pre-update backups in M15.

**Git Evidence:** `02f77cd`, `c95a861`, `8419bda`, `8277c78`. Verifications and limits in [docs/STATUS.md](docs/STATUS.md).
Goal: preserve a campaign before adding more character complexity.

Deliverables:
- SQLite-consistent snapshot + attachments archive, manifest, checksums, ZIP-based `.nodex`.
- User-triggered backup; safe backup destination chooser; visible errors and overwrite rules.
- Restore validation, path traversal protection, DB integrity checks and pre-restore safety copy.
- Basic Markdown/JSON export if it can be done without blocking recovery work.
- Automated backup->restore round-trip test with pages, sessions and references.

Acceptance:
- Export `.nodex`; simulate a fresh test profile; restore; compare sessions, links, relationships and attachment counts.

## M4a — Renaming Nodex → Chronexus (retrospective)

**Status:** delivered before the implementation of card M5, at the request
concurrent with M5. **Git Evidence:** `9eabd4d`.

Product name, titles, and documentation updated to Chronexus. Legacy identifier
`it.nodex.desktop`, data paths, and compatibility `.nodex` preserved;
no destructive migration or new campaign created for the name change.

## M5 - Player character, inventory and spells

**Updated status:** Operational on Windows: manual sheet, resources, inventory, and spells with provenance. Sheet extension recorded separately in M5a.

**Git Evidence:** `e756ea4`, `e964e94`. Verifications and limits in [docs/STATUS.md](docs/STATUS.md).
Goal: integrate playable data with knowledge, without inventing rules.

Deliverables:
- System-agnostic PC model and editable stats/HP/resources with persistence.
- Inventory CRUD, quantity and equipment state, acquisition provenance linking session/NPC/place/quest.
- Spellbook/manual ability entries, known/prepared flags and configurable resource/slot counters.
- Links from inventory and spells into knowledge pages; context navigation back to the campaign journal.
- Ruleset adapter interface and documentation, but NO unverified automatic D&D/Pathfinder formulas.
- Tests for changing counters, persistence, data validation, provenance links.

Acceptance:
- Add key received from Varek in Session 12 -> item page can open source note and NPC; restart and data still present.

## M5a — Reference sheet and D&D catalog (retrospective)

**Status:** operational on Windows, delivered before M6. The request called
«M4» the sheet; the M4 backup remains distinct and this extension concerns M5.
**Git Evidence:** `a15366e`, `55dea13`.

Scope: fields of the four-page manual sheet provided as reference,
D&D/SRD search 2014, editable import of spells and creation of
custom spells using an API entry as a base. The API remains in read-only
mode and does not publish personal spells. Preserve sources and manual fields.


- Expand the manual sheet using the four-page PDF reference: combat, abilities/
  skills/saves and training, biography/proficiencies, wealth/equipment and magic.
- Add optional SRD 2014 catalog search/preview, local response cache and explicit
  editable spell import; retain homebrew creation and lookup from a custom entry.
- No automatic formulas or publication of personal content to the read-only API.
- Acceptance: fill extended sheet, import/customize a real API spell, create a
  homebrew spell, restart offline and restore backup to a fresh profile. Compare
  new fields, source identity, UUIDs and cache; errors must preserve open drafts.
- Schema 006 and previous backups must remain supported by the current build.

## M6 - Search, polish and cross-platform release

**Updated status:** Functional Windows delivery verified; multi-platform acceptance still partial. Search, images in backups, export, summary and Logseq campaign preparation are included.

**Git evidence:** `70e7880`, `0bf403b`, `858085a`, `ca0e79e`, `738eb62`, `f984a3c`. Verifications and limits in [docs/STATUS.md](docs/STATUS.md).
Goal: reliable daily-use experience across all target OSes.

Deliverables:
- FTS5 search and tested index rebuild across notes, page titles and supported character assets.
- Keyboard shortcuts, refined dashboard, visual usability/accessibility, performance tuning.
- Markdown/JSON export completion and attachment handling.
- User-requested images for PC/NPCs, maps and items: managed local copies,
  previews/zoom, ownership, safe decoding and tested image-inclusive backup.
- After implementation, prepare a separate test campaign from the supplied
  Logseq archive and Oran photos; keep originals/private fixtures out of Git,
  preserve uncertainty, verify restore and save its `.nodex` backup in Downloads.
- CI pipeline to run tests; actual Windows/macOS/Linux build matrix if runners available.
- Package installers (.exe/.msi, .dmg/.app, .deb/.AppImage as supported by tools), verify names and packaging constraints.
- README with real local install/backup/restore instructions, limitations and manual QA checklist.

Acceptance:
- Search source note, restart, run backup/restore, navigate graph, validate on supported OS build environments without presenting untested builds as verified.

## M6a — Medieval restyling and first graph revision (retrospective)

**Status:** operational on Windows, after the first M6 delivery and before the Party.
**Git evidence:** `b22a033`.

- Medieval graphic theme: parchment, leather, typography and ornaments; ordinary,
  readable and accessible navigation, without turning it into a game scene.
- Graph redesigned with organic layout, details and navigable connections;
  factual mentions and relations remain distinct, without deducing new links.
- Corrections to dense campaign labels arrive in M6d; the second
  pass on the reference GUI and performance is M8b.

## M6b — Party and member knowledge (retrospective)

**Status:** operational on Windows. **Git evidence:** `dc29fe6`, `f5bb67b`.

Dedicated Party section for members, players, role and presence; note information
in the canonical Codex document linked via UUID, with images, backlinks and
search. Revisions and guards protect drafts; removing a member from the Party
does not delete the page. Backup/export include the data (schema 010). Only one PG
has the complete playable sheet: do not declare complete sheets for all members.

## M6c — Multi-source Open5e Wiki (retrospective)

**Status:** operational on Windows, after Party and before the M7 assistant.
**Git evidence:** `d765db1`.

D&D Wiki via Open5e v2, explicit search, sources/editions/licenses and cache
SQLite offline (schema 011). SRD 2014 catalog of the sheet kept separate.
No campaign submission, automatic import of facts or silent copy of
personal spells. Wikidot scraping was not implemented here: it is M16.

## M6d — Readable names in dense graphs (retrospective)

**Status:** Windows correction delivered after Open5e, before M7.
**Git Evidence:** `6735251`.

Correct overlaps and name readability in dense campaigns, maintaining
selection/details and node identities. Do not introduce new relations or change
sources to make the display more orderly.

## M7 - Local D&D Assistant with GPU

**Updated Status:** Operational on Windows with GPU and local sources; specific D&D candidate discarded after testing and replaced, by explicit choice, by multilingual Qwen3. Physical test without network and other OS remain to be verified.

**Git Evidence:** `e6f1763`, `a89874e`, `d63ba16`, `cf39425`, `4ac9f7f`. Verifications and limits in [docs/STATUS.md](docs/STATUS.md).

Explicit request: questions and analysis of own campaign with local
Ollama/equivalent adapter inference, specific D&D model when available,
verified real GPU and no cloud. Specification, candidates, and acceptance in
[docs/AI_LOCAL.md](docs/AI_LOCAL.md).

- M7.1: evaluate D&D model/licenses and GPU/VRAM compatibility with real benchmarks.
- M7.2: local retrieval for campaign and separate rules per edition, Italian
  responses with reopenable citations, uncertainty, and refusal of invented facts.
- M7.3: streaming/cancellation/errors, explicit configuration, privacy,
  potentially persistent conversations and backups without model weights.
- Acceptance: real inference on GPU and offline, questions with sources and without
  response, campaign/edition isolation, renamed sources and malicious documents.
- No fact, relation, counter, or note modified without user review.
- M7 implementation subsequently authorized: Ollama Rust adapter, schema
  012, retrieval, UI and history/backup/export present. The specific D&D
  candidate was tested on GPU but discarded for quality; the user approved
  multilingual Qwen3:4b-instruct with local sources, not fine-tuned D&D.
- Additional guard before inference: extracts with explicit signs of
  manipulation excluded and reported; if clean sources are missing, the request is
  stopped. No modification of notes and no absolute semantic guarantee.
- Current evidence, counts, and limits: docs/STATUS.md and docs/AI_LOCAL.md.
  Physical offline/firewall disconnected acceptance test remains;
  unreachable proxies and loopback observation are distinct verifications.

## M7a — Local Installers with offline AI (retrospective)

**Status:** local Windows package prepared after M7 and before M8.
**Git Evidence:** `24946bc`. Guides: [docs/INSTALLERS.md](docs/INSTALLERS.md).

Collect app installers and AI runtime/model actually available in a
`installers/` folder in the root, with local startup, instructions, and licenses.
Runtime/weights outside Git and campaign backups; no training, profile or
personal content in the packages. This first local delivery does not equate
to the subsequent Forgegit M11 publication or the M15 updater.

## M8 - Gemma 4 12B and local campaign retraining

**Updated Status:** Operational on Windows: campaign settings, Gemma 4 12B and true local QLoRA training. Settings were implemented before training; it is not a fine-tuned D&D model.

**Git Evidence:** `a99355e`, `1fde390`, `4d007f1`, `9baee29`. Verifications and limits in [docs/STATUS.md](docs/STATUS.md).

Physical offline/firewall test and macOS/Linux verification remain pending. Campaign settings, Gemma inference, and real QLoRA with adapter
they are implemented and tested on synthetic data; checks and limits updated in
[docs/STATUS.md](docs/STATUS.md) and [docs/AI_TRAINING.md](docs/AI_TRAINING.md).

### M8.1 - Model qualification and replacement

- Required target: **Gemma 4 12B**, replacing Qwen3:4b-instruct.
  Before implementation, verify existence, exact name,
  license, available weights, and local runtime support on official sources. Not all
  hardware targets are certified; availability and Windows checkpoints are
  verified in AI_TRAINING.md. It is not a fine-tuned D&D model.
- Measure inference and training on the available GPU, with VRAM consumption,
  quantization, and quality of Italian responses compared to M7. Do not
  assume that a model executable in inference is also trainable on the
  same GPU. If the target is unavailable or incompatible, document the
  block and request a choice from the user without implicit replacements.
- Keep the previous model usable until the validation and explicit activation of the
  new one; provide configuration restoration. Preserve local retrieval,
  citations, separation of editions and campaigns, without cloud calls or
  automatic changes to facts.

### M8.2 - Campaign settings

- Add a recognizable access to **Campaign Settings** from the
  selected campaign, creating the menu if absent. The required configuration
  must be reachable here, even if global AI settings exist.
- **Local AI** section: campaign enablement, active model and adapter,
  version, runtime/GPU status, context limits, and memory compatible with
  the hardware. Distinguish campaign preferences from shared runtime
  configurations; no implicit changes to other campaigns.
- Related useful settings: D&D edition, approved rule sources,
  inclusion/exclusion of notes and other supported local content,
  date of last knowledge update and last training,
  summary of new, modified, or deleted data.

### M8.3 - New data and true retraining

- Insert the **Retrain on new data** button in **Campaign Settings
  → Local AI**. Before starting, show included sources, differences
  from the last successful training, sizes, and measurable requirements. The start
  must be explicit; no automatic background training.
- Implement a true update of weights or a dedicated adapter for the
  campaign, with a compatible local backend, for example LoRA/QLoRA if supported
  by the model and the GPU. Separately verify the training backend:
  do not assume that the Ollama inference API offers this function.
- Keep **Update knowledge** distinct, which updates retrieval for normal
  changes to notes: rebuilding an index is not retraining the
  model and does not satisfy this milestone alone.
- Keep base weights immutable and versioned adapters per campaign. For correct,
  excluded, or deleted sources, rebuild the adapter from an approved
  snapshot when necessary: an incremental update does not guarantee the removal
  of already learned information. Current retrieval remains the reference for
  responses with citations, even after training.
- Treat documents as data, preserving provenance and distinction between
  facts and claims of the characters; exclude AI-generated responses by default.
  Do not include different campaigns or introduce unplanned OCR.
- Show real states of preparation, training, validation, success,
  error, and cancellation. Handle insufficient memory, missing runtime, and
  interruptions without losing data; keep the adapter active until a new
  successful validation and allow return to the previous version.
- Record model/version, identifiers, and source revisions,
  configuration, outcome, and dataset and adapter footprints. Define backup and
  restoration of adapters and metadata with declared sizes and limits
  compatible with archives; base weights remain excluded from ordinary backup.
  Any migrations will be versioned and non-destructive.

### M8 Acceptance

- Gemma requested verified and actually executed on the GPU, with documented
  comparison with M7; real training demonstrated by artifacts and
  weight/adapter verifications, without exchanging an index update for training.
- On synthetic data, add information to the campaign, update
  knowledge, and start retraining from its menu; verify Italian
  responses with re-openable citations and absence of contamination between campaigns.
- Verify source corrections/deletions, uncertainty, different editions,
  malicious documents, cancellation, GPU errors, restart, rollback, and backup/restore.
- Test operation without external network; separately declare the
  platforms actually tested and the hardware constraints remaining open.
- Residual M6/M7 verifications remain tracked separately: this milestone
  does not declare them completed.

## M8a — Repair after moving to D (retrospective)

**Status:** environment verification and correction delivered before the restyling.
**Git Evidence:** `313e056`.

Check Node/pnpm dependencies, modules, Rust toolchain, and startup commands after
the cut/paste of the folder from C to D; correct dependent references from
the path without recreating or overwriting user archives. Do not guarantee immutable
paths: verify the checkout directory at every new execution.

## M8b — Reference GUI, side settings, and independent scroll (retrospective)

**Status:** Windows implementation delivered before the M8c editor.
**Git Evidence:** `d5b07a1`, `f8d6b68`.

- Resume the requested reference screen 1:1: frames/parchment,
  medieval sidebar, and campaign hierarchy. The delivery is a concrete GUI;
  do not declare a certified pixel-perfect match without a comparison.
- Access to campaign settings in the left menu; global settings
  available from the same area and distinct from AI configuration.
- Lists of sessions/Markdown pages and document content with independent
  scrolling: many sessions do not force scrolling the entire window.
- Limit the cost of graph layout and verify node IDs;
  preserve selection, data, and source navigation.

## M8c — Visual editor and Markdown code (retrospective)

**Status:** operational on Windows, after GUI/scroll and before the M9 dice roller.
**Git Evidence:** `64d65c6`. Tests in the editor checkpoint of docs/STATUS.md.

- Usable editor with the mouse as requested: command bar, titles, formatting,
  lists/checklists, tables, alignment, links, and undo/redo.
- Also maintain direct editing of the Markdown source, with import/export and
  controlled preview/application. Do not reduce the request to only the visual editor.
- Canonical blocks, UUIDs, mentions, autosave, and drafts remain protected; if a
  conversion does not represent a format, report it instead of losing content.
- Preserve the insertion of Codex links and sources. Do not claim all
  Microsoft Word functionalities nor an unlimited round trip of any Markdown.

## M9 - Internal Dice roller and circle of dragons

**Updated status:** Operational on Windows: mixed dice/d100, persistent history and animation. M12 subsequently adds extreme effects.

**Git evidence:** `3b0e2ac`, `7aed999`, `5fba9fc`, `6ef5222`. Verifications and limits in [docs/STATUS.md](docs/STATUS.md).

**Delivery checkpoint of 24 October 2026:** 015 schema,
85 frontend test and 77 Rust PASS, real backup/restore and restart verified.
Guide, limits and tests: [docs/DICE.md](docs/DICE.md). Verifications on
macOS/Linux and distribution remain, without declaring them executed.

### M9.1 - Composition and roll result

- Dice roller fully usable offline, with d4, d6, d8, d10, d12, d20
  and d100. The d100 produces values from 1 to 100, without ambiguity on zero.
- Separately select the quantity of each die type in the same
  roll: for example 3d6 or 2d20 + 3d6 + 1d100. Show the composition
  before confirmation, with controls accessible even via keyboard.
- Validate non-negative whole quantities, require at least one die and define
  a documented reasonable limit to avoid blocks with very large rolls.
- Each confirmed roll restarts with all quantities reset for the next:
  do not maintain implicit selections and do not automatically repeat the roll.
  In case of an error before recording, keep the selection to
  allow a new attempt without losing the composition.
- Generate uniform random results in the local backend and record them only
  once; the animation represents those results without modifying them. Show
  the value of each die, subtotals by type, and the overall total.

### M9.2 - Persistent history

- Store the campaign history in SQLite, with stable ID, date and time,
  composition, individual results, subtotals, and total. It must remain
  consultable after closing and restarting, without depending on the AI model.
- Show the latest rolls with expandable detail and a clear empty state.
  Include the history in the campaign backup/restore via a
  non-destructive versioned migration, preserving previous backups.
- Record the roll before the animation; if this is interrupted, the
  result remains recoverable. Report saving errors without
  presenting as saved a roll that is not.

### M9.3 - Medieval animation: circle of dragons

- Design a coherent set of medieval dice with strong visual impact: recognizable
  shapes by type, materials like stone, metal, and draconic engravings,
  controlled details and large, high-contrast numbers. Ornaments, reflections, and
  flames must not cover the values; clearly distinguish 6 and 9 and make
  die type and d100 value explicit, without relying solely on color.
- Provide for the generation of original illustrations for dragons, frames,
  dice textures, and effects with the imagegen skill when raster assets are needed;
  use geometry and numbers rendered by the app for faces and exact results,
  without depending on figures drawn by the generator. Prepare separate assets,
  with transparency where necessary, contained dimensions and weight, included in the
  local package. Generation occurs during development, never at runtime:
  no campaign data submission, download, or external service required at roll.
- Use impeccable for visual direction and rhythm, accessibility for keyboard,
  contrast and reduced motion, and react-testing for interactive states.
  The final result must also be available as stable text separate
  from the scene, readable with a screen reader and independent of graphic effects.
- Let the dice roll inside a circle bounded by dragons, consistent with the
  medieval theme of the app. Upon landing, the dragons release flames that
  wrap and visually consume the dice, revealing their results.
- Present the numbers with a rapid slot machine scroll, then
  stop them on the actual values and complete the total count. Keep the
  final results readable until the user starts another roll.
- Lively but readable rhythm: initial target of about 2–3 seconds for the entire
  sequence, to be verified in the app. For many dice, group animations and
  counts, without extending the duration proportionally to the number of dice.
- Prevent duplicate submissions during the roll; distinguish zero selection,
  animation in progress, and previous result. Allow skipping the animation
  without generating new values and respect the reduced motion preference
  with a brief revelation, without rolling or intense flashing.

### Acceptance M9

- Verify single and multiple rolls of every type, including d100, and mixed
  compositions with different quantities; check intervals, subtotals, and total.
- Test zeroing after every confirmed roll, invalid quantities, empty roll,
  limits, double submissions, and persistence errors without duplications.
- Verify history after restart, isolation between campaigns and backup/restore,
  including compatibility with previous archives lacking history.
- Verify correspondence between saved and animated results, sequence interruption or
  skip, reduced motion, and keyboard use. Actually evaluate
  rhythm, readability, and fluidity with few and many dice on tested platforms.
- Use deterministic tests with a replaceable generator for roll logic;
  document the random source used in production. Do not declare statistical
  fairness demonstrated only by a few manual rolls.
- Visually verify all dice types at the app's actual dimensions,
  with few and many dice: numbers, 6/9, and d100 must remain distinguishable without
  zoom, even during revelation and on decorated materials. Check the
  contrast of final values and the rendering with reduced motion; dragons and flames
  must not hinder reading, controls, or textual detail of the roll.
- Verify that generated assets are present in the package and that the entire
  scene works offline, without network requests or generation during the roll.

## M10 — Multilingual, accessibility, and alternative alphabets (Windows operational; open revision)

**Updated status:** Operational on Windows, linguistic/dialectal and assistive revision still open. Espruar/Dethek are the next extension M13.

**Git Evidence:** `79376ee`, `af92934`, `a2d0e1c`, `3eaf56a`. Verifications and limits in [docs/STATUS.md](docs/STATUS.md).

Objective: change language from settings while keeping notes,
proper names, UUIDs, quotes, backups, and campaign sources unaltered.

- Complete interface localization: Italian, English, German, French,
  Spanish, Portuguese, Japanese, Korean, Chinese, Arabic, and Ticinese dialect.
  Agreed variants: Brazilian Portuguese, Simplified Chinese, Ticinese in
  draft to be reviewed; do not present machine translations as validated.
- Fantasy languages/alphabets: Klingon, Romulan, and Galactic alphabet.
  Confirmed variants: Minecraft SGA and Rihannsu romanized from the dictionary
  indicated by the user. Verify font licenses, mapping, and lexicon; distinguish
  translation from transliteration and report terms without equivalents.
- Braille and Morse as rendering/accessibility modes, not simple languages.
  Maintain semantic text for screen readers/Braille display; define grade,
  language, and Braille standard with assistive testing. For Morse, provide
  reversible text transcription and, if planned, audio disabled initially.
  Do not irreversibly convert saved content nor replace real accessibility
  with Unicode glyphs alone.
- Separate UI strings from data, use catalogs with stable keys, plurals,
  local dates/numbers, and explicit Italian fallback. Selectable language without
  reboot, persistent preference, offline functionality, and local fonts with licenses.
- Support Arabic RTL and mixed content with bidirectional isolation; CJK,
  IME composition, fallback fonts, search, and pagination without truncations.
  D&D sources maintain original language/edition/origin; assisted translations
  where applicable remain distinguishable, without creating new rules or facts.
- Acceptance: all views, errors, confirmations, visual/Markdown editor,
  settings, AI, backups, and dice rolling; complete catalogs and fallback, language
  change and reboot, RTL, keyboard/screen reader, long texts, IME, and minimum windows.
  Verify readability of alternative alphabets with missing fonts and return
  to the ordinary language. Verify data round trip and previous archives.

Implemented on October 24 2026: persistent global preferences, 13 selectable
languages and three scripts, offline catalogs/fonts, editor dictionaries, RTL,
reversible laboratory, and Italian recovery. 1427 messages candidate for natural
catalog; Klingon/Rihannsu with declared partial lexicon and verified glossary.
113 frontend tests, 79 Rust, and native Windows tests described in docs/I18N.md.
Translations are drafts: M10 is not declared fully accepted until
linguistic/dialectal revision, complete fantasy languages where
verifiable, physical assistive/real IME testing, and macOS/Linux verifications remain.
A new milestone is not started without a user request.

## M12 — Animated dragons for extreme single die outcomes (implemented on Windows)

**Updated Status:** Operational on Windows: celebration/threat of the two dragons on the extremes of the single die, inverted d100. Executed before M13 and M11 distribution.

**Git Evidence:** `45c0268`. Verifications and limits in [docs/STATUS.md](docs/STATUS.md).

Renew the dice rolling screen with animations of the two dragons for the best/worst
outcomes. The trigger applies only when the roll contains **a single
overall die**, not an extreme die within a multiple or mixed roll.

| Single Die | Celebrated Outcome | Threatening Outcome |
| --- | --- | --- |
| d4 | 4 | 1 |
| d6 | 6 | 1 |
| d8 | 8 | 1 |
| d10 | 10 | 1 |
| d12 | 12 | 1 |
| d20 | 20 | 1 |
| d100 | **1** | **100** |

- Celebration: both dragons come to life and breathe fire around the
  circle to celebrate the best result.
- Threat: both turn toward the screen, fly toward the player and
  breathe fire, as if they wanted to set them on fire. The result remains readable.
- Intermediate values, multiple, and mixed rolls maintain an ordinary animation.
  The inversion of the d100 is a presentation preference requested by the user,
  not a new D&D rule nor a modification of the recorded numerical values.
- Effects start only from the already saved actual result; do not modify
  randomness, history, quantity, subtotals, total, or M9 retry management.
  The replay uses the same result and does not generate another roll.
- Short and fluid animations, local assets with documented origin/licenses,
  no generation or remote request during the roll. Avoid intense
  flashing; offer skip and reduced movement with a static indication of the outcome.
- Acceptance: verify both extremes of all seven dice, intermediate values,
  inverted d100, multiple/mixed rolls without special trigger, replay,
  retry/save error, skip/reduced movement, view change, and restart. History
  and backup must preserve exactly the original roll.

## M13 — Elvish and Dethek Alphabets (implemented on Windows)

**Updated status:** Operational on Windows: Espruar and Dethek, local fonts, fallback and v2 preferences compatible with v1. Executed after M12 and before M11.

**Git Evidence:** `26d1c83`. Verifications and limits in [docs/STATUS.md](docs/STATUS.md).

Add Elvish and Dethek to the language/writing options in the global
settings, maintaining all existing M10 options. They are alphabets: do not present them
as complete automatic translations of Elvish or Dwarvish languages.

- Before implementation, identify the exact variant of «Elvish» and the
  source of the Dethek mapping; document repertoire, direction, uppercase, numbers
  and punctuation, without inventing missing symbols. The Elvish variant was
  confirmed by the user: Espruar from D&D / Forgotten Realms.
- Verify fonts and licenses; include local assets for offline use. Characters
  not representable and missing fonts must maintain a readable rendering.
- Integrate persistent selection, preview/laboratory, and reversible
  M10 package. Explicitly define the compatibility/version of packages and
  preferences before extending the whitelists; maintain Italian recovery.
- Ordinary semantic text for assistive technologies; no rewriting of
  notes, names, UUIDs, sources, saved data, or backups. No invented grammar or lexicon
  to simulate a translation.
- Acceptance: documented and tested mapping, immediate change and restart,
  exact round trip of the original, unsupported characters, absence of font,
  keyboard/accessibility, and compatibility with previous preferences/archives.

## M11 — Versioned releases and packages on Forgegit

**Future build TODO (26 October 2026; documentation only, do not execute now):**
extend compilation to Windows, Linux and macOS on both x64 and ARM64. At the next
authorized build/release, compile and publish both macOS versions; also compile
and publish both architectures for Windows and Linux where feasible. Track actual
checks and blockers per target using the [future build checklist](docs/INSTALLERS.md#future-build-checklist--pending-26-october-2026).
No build tooling, package or publication is delivered by this planning entry;
M23 remains the next functional milestone.

**Updated Status:** Partial: local app/AI packages 0.2.0 and draft ID 2; large uploads interrupted by the gateway. The app-only release 0.4.0 is public via M15, but the AI M11 distribution is incomplete.

**Git Evidence:** `43467fb`, `3af0ef0`, `5431d28`, `4abb4e3`, `ad7760d` (app delivery M15). Verifications and limits in [docs/STATUS.md](docs/STATUS.md).

User repository verified in current `origin`:
`https://github.com/Acelith/Chronexus.git`. Do not assume server APIs or functionalities:
verify them before implementing the publication procedure.

- Prepare a repeatable flow of consistent versioning between app, Cargo,
  Tauri configuration, tags, and packages, starting from the versions/tags actually
  present. Do not assign a version to a feature not yet implemented.
- For every future delivery of an implemented and verified milestone, publish to the
  user repository the delivery code and a versioned release with the
  produced packages, unless instructed otherwise not to publish. This is the
  permanent authorization requested by the user, not an authorization to
  publish this documentary change.
- Attach app installers/packages and, when required, the local AI package
  with runtime, redistributable weights, and licenses; verify size limits,
  available authentication, and server support. Do not use other services or
  repositories as alternative destinations without authorization.
- Accompany assets with checksums, instructions, release notes in Italian,
  actually performed tests, compatibility/migrations, and limits. Publish only
  platforms and packages actually built/verified; distinguish missing
  signatures and tests. Never include campaigns, backups, profiles, secrets, or private data.
- Do not force-push, rewrite history, or overwrite existing tags/releases/assets.
  On error, stop the publication, keep local packages, and report what was
  actually uploaded, without declaring success.
- Acceptance: verify correspondence of tag/commit/version, download and checksum
  of published attachments, installation/startup on tested platforms, and actual
  access to the release. Do not create fake publications to mark the completed milestone.

## M14 — External Assistants, Hidden Integration

**Updated Status:** Operational on Windows: hidden MCP integration for external assistants; integrated assistant excluded. The desktop closing verification left open in the initial checkpoint was passed during M15.

**Git Evidence:** `fa38d2e`, `ad7760d` (subsequent verification). Verifications and limits in [docs/STATUS.md](docs/STATUS.md).

Link delivered at the request of 25 October 2026,
separate from the campaign's integrated assistant.

- No visible control: activation via startup parameters; default
  disabled, read/write explicitly limited to a single campaign.
- stdio MCP adapter with typed tools for notes, sessions, Codex,
  card, party, inventory, spells, and abilities. No integrated AI command,
  arbitrary SQL, implicit remote deletion, or loading.
- Temporary local authentication, loopback, campaign boundaries, revisions
  and conflicts without loss of drafts. Real persistence and backups exist.
- Acceptance: authorization tests, protocols, archive reopening,
  restoration with active service, validation, and refresh of clean views.
- Implementation and instructions: docs/AUTOMATION.md. 015 schema unchanged.
  Windows checks and effective limits: docs/STATUS.md.

## M15 — Internal update with mandatory backup (Windows operational)

**Updated status:** Operational on Windows, public release 0.4.0 with three verified attachments and anonymous downloads. Real upgrade between two updater releases and macOS/Linux acceptance remain.

**Git evidence:** `c7d95ca`, `d75f5f3`, `db8fc68`, `ad7760d`. Checks and limits in [docs/STATUS.md](docs/STATUS.md).

Implemented the request from 25 October 2026: explicit check, download and
installation from global settings, with a public Forgegit channel or configurable
HTTPS server. No client login, telemetry, or campaign sending.

- Discover the latest stable release with Forgejo API and its `latest.json`, or
  read a static Tauri manifest. Reject drafts/previews and insecure URLs.
- Verify signature and signed version before making installation available;
  timeout, limits, cancellation, and recoverable errors. No implicit downgrade.
- Create and verify a `.nodex` backup of all campaigns, with images and
  attachments, before every installation attempt. Receipt and preferences side-by-side;
  failed backup blocks the installer. Do not automatically delete previous copies.
- Use the official Tauri component. Keep private keys encrypted outside Git,
  signed artifacts and public channel separated from large M11 AI packages.
- Acceptance: signatures/tampering/versions, anonymous discovery, backup/restore
  with images, Store/AI/MCP concurrency, download/backup errors, and desktop tests.
  First manual bootstrap; public upgrade test and other OS remain distinct.

Instructions and evidence: docs/UPDATES.md and docs/STATUS.md. SQLite 015 unchanged.

Checkpoint M15: public release v0.4.0, three verified updater attachments with
anonymous access, compiled source d75f5f3. Manual bootstrap and API/
manifest discovery, signatures/versions, and verified backup. Proof of upgrade between two
public updater versions and macOS/Linux acceptance remain. Details in STATUS.md.

## M15a — Epic update announcement (Windows operational)

**Updated status:** implemented 25 October 2026 after M16. Startup check
(one per session, maximum every 20 hours, can be disabled), accessible popup with
defer/ignore for version, Web Audio fanfare, wait for an idle app and
transition to M15 flow. Raster illustrations to be provided: until then
geometric emblem. Real upgrade between two signed releases still to be tested.
Evidence in [docs/STATUS.md](docs/STATUS.md).
Extends the presentation of the existing updater, without replacing signatures and backups.
ID M16 remains assigned to Wikidot; do not renumber previous references.

### Announcement and real availability check

- When a newer and compatible version is available, show an epic medieval popup
  : **a vassal/herald blowing a trumpet and presenting a
  parchment manifesto** to invite the update, consistent with Chronexus.
- Base the announcement on the real M15 channel: no simulated versions, drafts,
  previews not enabled, reinstallation of the current version, or false alarm
  when the server does not respond. Title, version, and notes from real data and secure renders.
- Add a light automatic check after the interface startup, in addition to
  the manual check, with a preference to disable it. No continuous polling
  or campaign sending. It is a future extension compared to the explicit check only
  of the 0.4.0; does not enable automatic requests from the wiki or AI models.
- Reschedule the popup during writing, saving, restoring, training, or
  other ongoing dialogues/operations; do not delete drafts or steal focus
  while taking notes. Avoid duplicate announcements of the same version.

### Presentation and actions

- Brief animation of the vassal and the trumpet, readable manifesto with version,
  novelties, and action to update; local assets with documented licenses/provenance.
  No generation, asset download, or AI service during the announcement.
- Brief trumpet sound, controllable/deactivatable; respect audio preferences
  and reduced movement. If automatic audio is blocked by the platform, maintain
  visual/textual announcement functioning without errors or repeated playback.
- Allow **Update**, **Remind me later**, and closing of the popup. Rescheduling
  respects a declared policy without continuously re-presenting the notice;
  manual control in settings remains available.
- The update action reuses the M15 flow: download with progress and
  cancellation, verified signature/version, and mandatory backup before installing.
  Do not start the installer directly from the animation or bypass a backup error.
- Accessible dialogue: plain text, keyboard, managed and restored focus,
  Escape/close, contrast, and layout at minimum dimensions. The animation does not
  hinder reading and can be skipped; no intense flashing.

### M15a Acceptance

- Real available update, same version, old/target version incompatible,
  server error, and offline; popup only in the valid case, automatic check
  deactivatable and no automatic requests to D&D sources.
- Update, deferral/closure, restart, duplicate notices, and arrival of the response
  during a draft or other dialogue; no loss of content or unexpected focus.
- Local animation/audio, audio disabled/blocked, reduced movement, keyboard
  and screen reader; version and notes always readable even without effects.
- Regression of path M15: incorrect signature and failed backup block the installer;
  no download/installation without the explicit action of the user.

## M16 — Wikidot HTML Scraping and wiki selection (Windows operational)

**Updated status:** implemented on 25 October 2026 upon explicit request, before
M15a. 016 Schema, Rust adapter, global selector, separate deletable cache,
proposed source change upon consent and explicit import of spells.
Evidence, tests, real desktop testing, and limits in [docs/STATUS.md](docs/STATUS.md).
macOS/Linux and the review of new strings in other languages remain.
The published release 0.4.0 does not yet contain M16.

Verified implementation choices: `spells` indices, homepage (talents,
background, classes/subclasses), `lineage` and `wondrous-items`; robots.txt of the
25/10/2026 prohibits only paginated paths `/p/`; the page declares CC BY-SA 3.0
unless otherwise indicated, shown as declared license, not guaranteed.

### M16.1 — Selectable source in global settings

- Add **App Settings → D&D Sources / Wiki** with a choice at least between
  **Wikidot D&D** and **Open5e**; Wikidot is the requested default source.
- Persistent and immediate global preference, also available without a campaign:
  default Wikidot in new profiles and in those migrated without an explicit choice.
  Preserve a preference already explicitly saved, when present.
- Distinguish the future state from the current Open5e choice. Define version,
  validation and retrieval of preferences; restarting and restoring a campaign
  must not implicitly change the selected wiki or delete its data.
- Change source without merging results, IDs, or cache; show the active provider.
  If Wikidot does not retrieve the information, explicitly ask the user
  if they want to change the source (M16.5), without replacements or silent requests.
- Keep the D&D 5e API / SRD 2014 catalog already linked to the sheet,
  custom spells and imported copies distinct; do not overwrite them when changing the wiki.

### M16.2 — Reading public Wikidot pages

- Use public HTML from `https://dnd5e.wikidot.com/`, with category indices
  for searching spells and other supported sections (classes, talents,
  items, and species). Before implementation, define and verify the actual indices
  : do not invent REST endpoints or a non-existent search service.
- Read-only adapter in the Rust backend: GET HTTPS on allowed hosts/paths,
  size/time/concurrency limits, spaced requests, and cancellation.
  No XML-RPC key, login, bypassing blocks/CAPTCHA, or headless browser
  required to read pages whose content is already in the HTML.
- Search on explicitly consulted indices and limited local cache; open the
  requested entries without massive crawling or automatic downloading at startup.
  Verify robots.txt and site instructions during implementation.
- No sending of notes, sheets, campaigns, or AI questions: only
  explicit requests to public indices/entries and rule search terms.

### M16.3 — Parsing, provenance, and local use

- Extract title, text, tables, and fields actually present: for spells,
  level/school, casting, range, components, duration, description, and classes.
  Declare the categories actually supported; no fake results.
- Preserve canonical URL, provider, original name, source/manual, edition
  when verifiable, acquisition date, and official/UA/homebrew distinction.
  Do not automatically promote a wiki rule as a campaign fact.
- HTML always untrusted: remove scripts, iframes, forms, handlers, and active
  resources; render text/data with local components without executing the site in the app.
- Preview before importing a supported entry into the sheet; editable fields,
  explicit confirmation, and provenance preserved. Do not overwrite saved assets.
- If the structure changes or a field is not recognized, report it and offer the
  original text rendered securely; do not invent values or save incorrect data.
- Separate offline cache for provider/edition/URL, with stale/error states and limits.
  Imported copies remain independent of eviction. Version only any necessary
  migrations and preserve previous Open5e archives/caches.
- Public accessibility and robots.txt are not a redistribution license:
  verify the conditions of individual sources, maintain attributions, and do not
  automatically include the entire catalog in public packages/releases.

### M16.4 — User-deletable offline cache

- In the wiki settings, add **Clear offline cache**, with selection
  of the affected source and the possibility to clear all wiki caches.
  Show available quantities/sizes and what will be deleted before confirmation.
- Delete only pages/indices and derived files held by the selected cache:
  preserve campaigns, notes, imported spells/items, managed images,
  source preferences, and backups. Explain that only cached entries will no
  longer be viewable offline until the user reopens them online.
- Confirmation and cancellation, visible success/error results, and consistent clearing; cancel
  or invalidate pending requests so they do not immediately repopulate the cache just
  cleared. Do not start an automatic redownload after clearing.
- Distinguish cache from saved/imported copies. If a cache feeds the retrieval
  of AI rules, signal sources no longer available for new requests,
  preserving conversations, historical citations, and saved campaign data.

### M16.5 — Proposed source change when Wikidot does not provide information

- In case of an entry not found, search with no results, network/server error, or
  uninterpretable HTML structure in the necessary fields, show the reason and
  ask: **«Wikidot did not provide the information. Do you want to use Open5e?»**.
- Offer switching to the alternative source, a new attempt on Wikidot, or
  cancellation; if a usable copy exists in the cache, allow its reading
  declaring its date without forcing a source change.
- Change source and repeat the search only after acceptance. Make it clear
  that the new choice is saved in the global settings; a refusal or the
  closure maintain Wikidot and do not send requests to the other source.
- Preserve the searched public term, attribute results to the actual provider
  and do not merge cache or rewrite already imported entries. No popup/retry loops
  or implicit selection of another source if the alternative also does not respond.

### M16 Acceptance

- Wikidot/Open5e selection, default Wikidot, existing profiles without preference,
  explicit choice preserved, restart and no mutation of saved spells.
- Search/opening of supported categories and documented limited public trial;
  parser tested with synthetic fixtures for tables, Unicode, missing fields,
  changed markup and malicious HTML content, without executing page instructions.
- Offline/cache, provider/edition separation, request/size limit, timeout,
  cancellation, HTTP 403/429/5xx and redirects outside whitelist without loss of drafts.
- Explicit import and backup/restore of saved copies with identity/provenance;
  no destructive migration or modification to global selection as a result of restore.
- Cache clearing for source/total, confirmation/cancellation, imported data and backup
  intact, source choice preserved, pending requests invalidated and no automatic refetch
  handled. Manage already empty cache, deletion errors and offline use.
- Wikidot failures with request to change source: persistent acceptance and
  alternative search, refusal/closure without requests to Open5e, use of cache,
  missing data/changed markup and unavailable alternative without popup loops.
- Italian interface, keyboard and empty/loading/error states; access settings
  even without a campaign. Declare only the actually verified platforms.

Research already conducted: [docs/RESEARCH_DND.md](docs/RESEARCH_DND.md). XML-RPC API and
HTML scraping are two distinct accesses; an anonymous XML-RPC read returned
401 in the previous investigation. M16 uses only public HTML, without keys.

## M17 — Local translation of the wiki into the app's language

**Status:** implemented on Windows on October 25 2026, upon explicit request.
M18 was subsequently implemented; see its section and STATUS.

### Behavior and boundaries

|- Wikidot and Open5e: the open entry offers **Translate to [app language]**; the first
  generation is explicit. A translation already saved is automatically reread
  when the same entry is reopened in the same language, without inference or network.
- Natural languages M10 are destinations; English shows the original. Ticinese
  and all translations are drafts to be reviewed. Klingon/Romulan declare the
  fallback to the original; alternative alphabets are not languages to be translated.
- Only the Rust backend reads public text from the existing cache. Model
  Qwen3 **4b-instruct** already approved, GGUF weight identities fixed, loopback
  fixed without proxy/redirect, cloud disabled verified and GPU preflight.
  No automatic download or startup of the runtime; no campaign content,
  retrieval, AI history or campaign adapter enters the translation.
- Original always consultable, source/edition/license/origin and original names
  visible. Blocks, lists and tables maintain the structure; inert text, never
  HTML executed. Saved imports/spells continue to use the original.
- Draft flagged; structural and numerical check, without promising linguistic correctness
or rule equivalence. Incomplete response, output limit,
timeout, or modified numbers: visible error, no partial copy saved.

### Persistence and acceptance

- Additive migration **017**, `wiki_translations` table in the same Store.
Provider/item/language key, SHA-256 of content with source and revision
of the translator, registered model identity; maximum 100 copies from 256 KiB.
Updating an invalid source invalidates the reuse of the old translation.
- Deletable cache for provider or total with M16 confirmations. Epoch, generation
and language are re-checked before writing. No
  late repopulation after emptying; no changes to imported data.
- Translations included and validated in backups; restoration of previous schemas and
  migration 016 → 017 without rewriting sources. No automatic downgrade:
  after migration, previous builds do not read the 017 schema.
- Cancellation and abandonment of view/language change discard generation; a single
  operation on the runtime with the shared AI block, including updater/training.
- Limits: 24.000 bytes of text, 500 fragments, batches of 1.800 bytes, maximum 240 s
  total. No silent truncation or massive translation of the catalog.
- Domain/frontend testing, migration and backup/restore; real Windows GPU test,
  offline copy, unchanged origin and accessibility. macOS/Linux and revision
  of native/assistive speakers remain to be verified. Evidence in `docs/STATUS.md`.

## M21 — New visual identity: heraldic logo, icon, and branding (Windows operational)

**Updated status:** implemented on 25 October 2026 along with M22: icon generated
from the herald with transparent corners, vertical logo in the sidebar with name
accessible, branding and icon in the README (M20). Evidence in docs/STATUS.md.
The simplified variant for 16–32 px was not created: at 32 px the shape remains
recognizable. No release contains it yet.

**Original status:** requested on 25 October 2026; not implemented. On explicit instruction
from the user, it is **the first phase to be executed, along with M22**, before M19/M20.
M18 is meanwhile completed on Windows. The chosen images are saved
in `assets/brand/` (originals in `assets/brand/source/`, prepared variants and
provenance in `assets/brand/README.md`) and remain the source for updates
brand futures. ID M21 follows the already used IDs; the order is in the registry.
The next request places **M22** alongside this delivery: logos and preparation
of the AI from the settings form the next phase, before M19/M20. The two
milestones remain distinct and verifiable; this addition is only planning.

### M21.1 — Application Icon

- Use `assets/brand/chronexus-icon.svg` (illustration with transparent corners)
  as the source for `pnpm icons` for the window, taskbar, NSIS installer
  and macOS/Linux formats; replace the current `assets/chronexus.svg` without
  changing the identifier, executable name, or data paths.
- Verify readability at 16, 24, 32, 48, and 256 px; if the shape is lost,
  prepare a simplified variant for small sizes derived from the
  originals, without inventing a different brand.
- Check weight and quality (PNG with 256 colors embedded today): optimize without
  visible artifacts; no file ignored by Git as the sole source.

### M21.2 — Branding in the interface

- Sidebar: vertical `chronexus-logo.webp` logo instead of the compass rose
  and the written name, with accessible name «Chronexus» (`alt`/title), phrase «Le tue
  storie vivono» unchanged, reduced dimensions in narrow windows.
- Evaluate the horizontal branding for screens without a sidebar, splash or
  app information; consistency with the update herald (M15a).
- No interface text rasterized other than the logo; contrast on dark leather,
  theme and languages (RTL/CJK) unchanged; DESIGN.md updated.

### M21.3 — Outside the app

- Make branding and icon available to M20 for the README header
  (light/dark versions if necessary); optional social image or avatar of the
  Forgegit repository only with explicit authorization.
- Documented licenses and provenance; no campaign data in images.

### M21 Acceptance

- Icons generated and checked in File Explorer, taskbar,
  installer, and window; desktop build and test installer built.
- Sidebar at 1586×992, 1200×800, and 760×540, name accessibility (axe and
  screen reader), tests and lint unchanged; platform versions declared
  only if tested. Publication according to the release rule only upon request.

## M22 — Installation of Ollama and models from settings (Windows operational)

**Updated status:** implemented on October 25 2026. App settings → AI
locale: components; Ollama runtime managed 0.40.10 (official archive with SHA-256
fixed), explicit start/stop linked to app lifecycle, download of
qualified models via the active runtime with M18 weight verification. Real testing of
installation/startup/shutdown and verification of an already present model; complete download
of 17,7 GB without repetition. Evidence in docs/STATUS.md.

**Original status:** requested in 25 October 2026; not implemented. To be developed together
with the **M21** logo milestone, before M19/M20. Objective: prepare the local AI
directly from **App Settings → Local AI**, without requiring
the user to enter commands in the terminal. The app remains fully usable without AI.
This planning does not initiate downloads, installations, builds, or publications.

### M22.1 — Status and component selection

- Display separately Ollama status, verified cloud block, GPU, models
present and available space. No request to the runtime upon opening:
detection via explicit action **Check components**.
- Propose **Qwen3.8-27B · Primary** as the expected model for assistant and
translations; **Gemma 4 12B · Secondary** as an optional alternative, not
  download both by default. Reuse policy M18.
- Before downloading, show actual sizes, required space, requirements
  GPU/RAM, destination, source, and license. Declare the mixed loading
  of the 27B and distinguish between missing, incompatible, or unqualified weight models.
- Recognize an existing Ollama installation: do not overwrite it, reconfigure it
  to implicitly block it. Occupied port or non-disabled cloud requires
  a message and an explicit intervention, without falling back to external services.

### M22.2 — Guided and verified installation

- Distinct **Install Ollama** and **Download model** actions; explicit consent,
  progress in bytes/percentage when available, cancellation and new
  manual attempt. Network/space/permission errors leave the app usable.
- Verify compatible version, official distribution, and runtime license
  before implementation. Prefer a per-user managed copy when
  supported; any system permissions must be declared before
  starting the installer. No remote scripts executed or arbitrary commands.
- Download only after clicking, from explicitly permitted official hosts/paths,
  with limits, timeouts, and verified redirect management. Check integrity
  of the runtime and qualified M18 GGUF manifest/digest before declaring «Ready».
  Partial files are not installed components; no incomplete activation.
- The potential use of Ollama to download weights remains a setup procedure
  explicit, different from the fixed loopback inference adapter. Do not send
  campaigns, notes, photographs, PDFs, or conversations in the setup requests.
- Heavy downloads, folders, and component receipts remain outside of Git and from the
  campaign backups. Management/removal concerns only components owned
  by Chronexus and requires confirmation; never delete pre-existing runtime or weights.

### M22.3 — Connection with assistant and wiki

- After installation is complete, verify local runtime without cloud and GPU; clearly indicate
  **Ready**, **To be verified**, or the actual error. No test inference
  with campaign content and no automatic startup upon app launch.
- Offer an explicit action to start the managed runtime and explain when
  remains running; no implicit service or automatic system startup.
- Refer to the explicit choice/activation in the campaign settings and
  to the wiki translation button. Installing components does not enable the AI,
  does not change a campaign's model, and does not start generations or training.
- QLoRA remains Gemma-only: checkpoints and training workers are not included
  in the standard setup and are not downloaded automatically. No reinstallation
  of the old Qwen models removed or silent replacement of the chosen model.

### M22 Acceptance

- Clean profile: runtime installation and only the chosen model, verified integrity,
  explicit startup, first response/translation and subsequent reuse without download.
- Pre-existing runtime intact, model already present, port occupied, cloud active,
  CPU only/insufficient GPU, insufficient space, denied permissions, network absent,
  response/redirect not allowed, incorrect checksum, cancellation and restart after
  interruption. No partial component declared ready or personal data sent.
- Active campaigns/models and unchanged backups; cancellation does not delete pre
existing weights. Empty/loading/error states, keyboard, accessibility and languages.
- Test mirati Rust/frontend and real testing on isolated profile. Windows first;
  macOS/Linux and system installations declared verified only if tested.
  Update AI/installer/STATUS guides; publication only upon new request,
  respecting the current instruction not to publish the 0.7.0.

## M18 — Replacement of Qwen models with local Qwen3.8-27B (implemented on Windows)

**Status:** implemented on 25 October 2026 at the explicit request to execute M18.
Qwen3.8-27B Q4_K_M qualified before the changes; first choice for assistant,
wiki and translation tool. Gemma 4 12B remains secondary and retains the QLoRA.
018 Schema disables old Qwen without deleting history or identity.
Real 35/35 comparison for each model and desktop 40/40 benchmark for each;
restoration of a verified real 017 backup. Details, digest and limits in
`docs/AI_MODELS.md` and `docs/STATUS.md`. Compiled and signed 0.7.0 installer,
local delivery; publication interrupted at the user's request.
M17 is the wiki translation already delivered, it is not being renumbered.

The user requested to remove all Qwen models and replace them with
«Qwen3.8-max». Verification of 25/10/2026: Qwen3.8-Max has 2,4 T parameters (95 B
active) and the hosted service is a cloud API; open weights require multi-GPU
servers, not the RTX 4080 SUPER from 16 GB. The cloud API would violate the "no
external AI" constraint. The user therefore chose the smallest open model from the same
family, **Qwen3.8-27B**, running locally. Do not call it Qwen3.8-Max or D&D.

### M18.1 — Model qualification before any modification

- Verify on official sources (Qwen organization on Hugging Face/ModelScope,
  Ollama library) the exact name, declared license (secondary sources: Apache 2.0),
  Ollama tag, manifest, and SHA-256 of the GGUF weights. Reject similar
  unofficial repositories; no community quantization without documented provenance.
- Measure on the actual GPU quantization, context, and VRAM: Q4_K_M is indicated
  around 17 GB, beyond the 16 GB available. Choose and document the
  quantization; CPU-only loading always blocked, mixed declared.
- Use the model for text only: no image submission or OCR introduced by the
  fact that the checkpoint is multimodal. Exclude the reasoning mode
  exposed in the content (problem already seen with Qwen3:4b standard).
- Real evaluation with the M7 benchmark (campaign, rules for edition, absences,
  malicious instructions) and M8 comparisons; Italian responses, valid citations, no
  invented facts. If quality, memory, or latency are not acceptable, stop and
  ask the user: no implicit replacement with another model.

### M18.2 — Removal of Qwen3:4b-instruct

- Remove Qwen3:4b-instruct as a selectable, default, or rollback
  model in the assistant and campaign settings; Gemma 4 12B remains.
  The discarded D&D candidate remains excluded.
- Update scripts and tools that fix `qwen3:4b-instruct` (AI startup, offline AI
  installer, local string translation, QA) and current guides. Do not
  rewriting Git history, releases, or already published packages: historical checkpoints
  remain truthful.
- Campaigns using Qwen3:4b: deactivate the assistant of that campaign with
  a visible warning and request a new explicit choice with consent; no
  automatic activation of Qwen3.8-27B. Conversations, citations, and identities of the
  model that produced them remain unchanged and in the backups.
- Previous backups with configured Qwen: restorable, with the same treatment.
  Any versioned, additive, and numbered migration after the migrations already
  existing at the time of implementation.

### M18.3 — Training, distribution, and limits

- The QLoRA M8 remains based on the verified Gemma checkpoint. QLoRA of a 27B on 16 GB
  it is not assumed: if the campaign uses Qwen3.8-27B, "Retrain on new data" remains
  disabled with explanation, pending a separate future qualification.
- No weight in Git, backup or app installer; only explicit
  user download (`ollama pull`) before offline use. Update or withdraw the
  offline AI packages based on Qwen3:4b without overwriting existing releases.
- Invariants: fixed loopback adapter, verified disabled cloud, fixed digest,
  GPU preflight, retrieval per campaign/edition, no implicit mutation.

### M18 Acceptance

- Official identity, license, and digest documented; real VRAM/latency measurements.
- M7/M8 benchmark repeated with Qwen3.8-27B and comparison with Gemma 4 12B.
- No selectable occurrence of Qwen3:4b; campaigns and backups with Qwen migrated
  without loss, assistant deactivated until new explicit choice.
- Runtime absent, model missing, CPU only, insufficient memory and cloud active
  produce clear errors without sending notes. Rust/frontend and desktop QA tests.

## M19 — Backup folder in Documents, periodic and update backups (delivered on Windows)

**Order:** upon instruction of the user of 25 October 2026 is the last milestone.

**Updated status:** implemented on October 25 2026 (`src-tauri/src/backup_folder`,
`src/features/backup`), tested on Windows with an isolated profile and simulated Documents
not yet in a release. Default chosen: periodic backups
**disabled** (weekly, 5 copies when enabled) because the `.nodex` is not
encrypted and Documents are often synchronized. Interval every N hours: 2–72; copies
1–60. The original plan remains below as a reference. Residues: macOS/Linux,
Real redirected documents, full disk and physical read-only folder,
actual installation of an update with backup in Documents, translations of the
new strings (today in Italian as well as in other languages).

### M19.1 — Dedicated folder in Documents

- Create, at the first need and without writes at startup, `Chronexus/` in the
  User Documents folder resolved by the system (Windows Known Folder even if
  redirected, macOS `~/Documents`, Linux XDG `DOCUMENTS`), with the subfolders
  **Periodic Backups** and **Update Backups**. Show the full path
  in the app with opening in the file manager.
- Reject insecure paths: symbolic links/junctions, files instead of the
  folder, lack of permissions. Every file has a unique name with UTC date and not
  overwrite an existing file. No path provided by the frontend as text
  free: choice of a different folder only via system selector.
- Warn that Documents can be synchronized (e.g., OneDrive): the `.nodex`
  contains all unencrypted campaigns. It is a user storage choice,
  not a Chronexus submission; offer an alternative local or external folder.

### M19.2 — Configurable periodic backups

- In **App Settings → Backup** (global, even without a campaign): active or inactive,
  frequency (e.g., every day, every week, or every N hours within declared limits),
  number of copies to keep and destination folder. Global preference in
  an atomic file outside the restoration generations, included in the receipt of
  backup pre-update. Default value to be decided at implementation.
- Works only with the app open: no background services or scheduled
system activities. If a backup is overdue, it is performed after startup
when the app is idle, without interrupting writing, saving, restoration,
updating, AI, or training; uses the same Store and the `.nodex` writer
  verified (SQLite snapshot, managed attachments, manifest and SHA-256, reread).
- Visible status: last successful backup, next expected, error with cause and
  action (insufficient space, unreachable folder, permissions). A failure
  does not block the use of the app and is retried at the next interval, without cycles.
- Rotation only after a new verified backup and only on periodic files created
  from Chronexus and registered in a local index with hash: no manual backups, copies
  preventive of the restoration, pre-update backups or unknown files.

### M19.3 — Pre-update backup in the same folder

- The new mandatory M15 backups go into **Update backups** with their
receipt. M15 guarantees remain: verified backup before the installer, Store
  blocked until delivery, failure = installation blocked.
- If the Documents are not writable, use the current data folder
  `update-backups/` with an explicit warning, never skip the backup. No automatic
  deletion of update backups, consistent with M15.
- Backups already present in `update-backups/` are not moved automatically:
  list them and offer an explicit copy verified with SHA-256, without deleting
  the original.

### M19.4 — Restoration and visibility

- **Backup and restoration** lists the `.nodex` of the two folders (and the
  custom folder) with date, type, and size; restoration remains the M4 flow with
  preview, integrity check, confirmation, and preventive copy.
- Changing the folder does not move or delete already created backups.

### M19 Acceptance

- Folder created only when needed, redirected documents, paths with spaces and
  Unicode, missing folder/read-only/symbolic link/disk full.
- Periodic backup performed, skipped during writing or active operations, resumed
  after restart, rotation limited to only registered periodic files, foreign files
  intact. No backup with the app closed.
- Update with backup in Documents and fallback in the data folder; backup error
  blocking the installer. Real restoration of a periodic backup with images.
- Persistent preferences after restart and not altered by restoration; Italian
  interface, keyboard, empty/error states. Platforms declared only if tested.

## M20 — Project presentation: Quality README (delivered and verified)

**Updated status:** Italian README and `README.en.md` rewritten, user guide and
development moved without loss to `docs/GUIDE.md` and `docs/DEVELOPMENT.md`,
screens from synthetic campaign in `docs/media/`. Rendering verified on 25/10/2026
on the real page at github.com (Forgejo 12.0.4) after the push: callout, `<details>`,
centering, tables, images and badges (release v0.7.0) corrected; 12 internal links 200.

**Original status:** requested on 25 October 2026; not implemented. The current `README.md`
mixes user guide, milestone history, and developer notes. Objective:
a repository page at the level of the projects indicated by the user as
reference (ApolloShell, AdventureLog, Uptime Kuma, Gogs, Seerr,
astro-bento-portfolio, Win-Debloat-Tools, Sherlock), faithful to the actual status.

### M20.1 — Page structure

- Centered header: Chronexus logo with light/dark variant, name, short
  presentation phrase («the roleplayer's diary, offline and yours»), quick
  links Download · Features · Guide · Roadmap.
- Only true and verifiable badges: latest release, license, Windows x64 platform,
  «offline-first», languages; no invented counts or non-existent services.
- Main screenshot immediately below, then gallery with captions: diary and editor,
  Codex and backlink, graph, card/inventory, dice with dragons, wiki, herald,
  languages and scripts. At most one or two short GIFs (dice roll, herald).
- Sections: What is it · Why Chronexus (player, not GM; local data; mentions ≠ facts)
  · Features (table with project icons, not emojis) · Download and
  installation (table of methods, requirements, first launch) · Updates and
  backup · Optional local AI · Languages · Privacy · Roadmap · Development ·
  Contribute · Credits and licenses · Frequently asked questions.
- Callout `[!NOTE]`/`[!WARNING]` for limits and warnings (installer not Authenticode,
  macOS/Linux not verified, backups not encrypted, AI not trained on D&D);
  long details in collapsible `<details>` sections; anchors on every title.
- Main language Italian with `README.en.md` linked at the top; contents
  equivalent and updated together.

### M20.2 — Contents and materials

- Move milestone history, tests, and technical instructions to dedicated
  documents (e.g., `docs/DEVELOPMENT.md`, existing guides) without losing information;
  the README refers to those and to ROADMAP/STATUS.
- Screenshots and GIFs generated from **synthetic** campaigns with the test scripts:
  mai Speratia, photos, notes or other personal data. Optimized WebP/AVIF format
  (the folder must not depend on exceptions to `*.png` in `.gitignore`), descriptive
alternative text, declared total weight and content.
- Every statement corresponds to STATUS: platforms and verifications only if performed,
  versions and real numbers. Complete credits and licenses: OFL fonts, SRD 5.1 CC BY 4.0,
  Open5e, Wikidot (license declared by the pages), Ollama/Gemma, libraries.
- Any descriptions, topics, and social images of the Forgegit repository are
  remote settings: modify them only with explicit authorization.

### M20 Acceptance

- Rendering verified on the actual github.com page (Forgejo): HTML allowed,
  callout, light/dark images, tables and `<details>`; adaptations if an element
  is not supported. Also check mobile width.
- All internal and external links valid; no private data in images; image weight
  within the declared limit; formatted and consistent markdown.
- A new user finds downloads, requirements, first start, backup, and privacy in less
  than a minute; technical information removed from README still reachable.

## M23 — Complete code audit: bugs, repetitions, and optimization (planned)

**Order:** requested by the user on 25 October 2026 after release 0.8.0; it is the
next to be executed, before M24/M25, because sharing and mobile rely on the
existing code. **Status:** planned, not started.

### M23.1 — Inventory and starting measures

- Map of Rust/React modules, Tauri commands, and dependencies, with file
  sizes, complexity, and duplicated code (local tools, no external services).
- Measured baseline: startup times, campaign opening, saving, searching, graph
  with large synthetic campaigns, bundle size, and memory. No personal data
  in the measurements or reports.

### M23.2 — Correctness and security

- Competition and lock review (Store, AI, updater, MCP, periodic backups),
  error handling, file paths, command inputs, migrations, and restoration.
- Fix the unstable MCP `transport_auth_origin_scoping…` test in parallel
  and other intermittent tests, without weakening the assertions.
- `cargo audit`/`npm audit` or equivalents offline on dependencies, licenses
  (align `Cargo.toml` MIT with `LICENSE` Apache-2.0 only upon user confirmation)
  the Tauri surface (capabilities, CSP, exposed commands).
- Every confirmed bug receives a failing test before the fix.

### M23.3 — Repetitions and structure

- Unify repeated patterns: atomic preference files (interface, wiki,
  updates, herald, backup), limited JSON reading, path checks,
  `spawn_blocking` helpers, HTTP clients and fake test servers, `perform`/waiting
  states in React panels.
- Reduce `lib.rs` (command registration per domain), separate components
  React components that are too large (`App.tsx`), remove dead code and scripts no longer
  needed, without changing disk formats, schema, or legacy identifiers.

### M23.4 — Optimization

- Intervene only on measured bottlenecks (SQLite queries and indices, repeated React
  renders, lazy loading, bundle size, editor, and graph).
- Before/after comparison with the same synthetic data; no functional regression.

### M23 Acceptance

- `docs/AUDIT.md` Report with found problems, severity, corrections, and issues
  left open with justification. Separate commits per theme, each verified.
- Rust/frontend tests, clippy, lint, typecheck, and build are green; MCP test stable on
  repeated executions. Desktop testing of main flows on an isolated profile.
- No data loss: backups of every previous version are still restorable.

## M24 — Shared campaign between multiple people (planned)

**Order:** after M23, before M25. **Status:** planned, not started. Changes a
project invariant: today no account and no service. Sharing
remains **optional**: without activating it, Chronexus works offline as it does today.

### Evaluation of options

| Option | Pro | Con |
| --- | --- | --- |
| Peer-to-peer (e.g., iroh/libp2p, WebRTC) with CRDT | No server, data only between players | Synchronizes only if devices are on simultaneously; NAT and relay are still required; weak accounts and permissions; Android blocks it in the background; no central history |
| Shared folder (Syncthing/OneDrive) | Simple | SQLite conflicts, no permissions for individual items, risk of corruption: discarded |
| **Self-hosted Chronexus Server** | Single account for desktop and Android, permissions per item, always reachable, central backup, suitable for M25 | Must be hosted and maintained; campaign data on the server |
| Third-party cloud service (Firebase/Supabase hosted) | Fast | Data held by third parties, external dependency: contrary to project principles |

**User confirmed choice (25/10/2026):** Chronexus **self-hosted** server
(Rust, Docker container) on the user's infrastructure, alongside Forgegit, with
the desktop remaining **local-first**: local SQLite archive as it is today and
explicit synchronization of shared elements only. P2P remains a
future option for live sessions, not the base.

**Separate Repository:** the server lives in an **external repository** on Forgegit
(proposed name `acelith/Chronexus-Server`), with its own code, versions, releases, and
Docker images; this repository contains only the desktop/Android
synchronization client. The contract between the two is an HTTP API
versioned and documented (OpenAPI schema and shared types published by the server,
never copied manually), with declared compatibility between app and server versions.
The repository must be created at the start of M24, upon explicit request, with the same
commit, test, and document model (`AGENTS.md`, `ROADMAP.md`, `docs/STATUS.md`).
Domain/hosting, registration (invitation-only
or open), and end-to-end encryption remain to be confirmed before coding.

### M24.1 — Server and account

- HTTPS Service (Rust/axum, SQLite or PostgreSQL) with accounts, sessions, passkeys or
  robust passwords with attempt limits, campaign invitations and roles
  (owner, player, read-only). No telemetry, logs without content.
- The desktop connects only on explicit user action, with the chosen and
  verified server URL; no request at startup if sharing is turned off.

### M24.2 — Selective sharing

- For each campaign, the user chooses what to share: Codex pages, sessions,
  relationships, images, parties, character sheets, or parts of them. Default: **private**.
- Private notes, the complete character sheet, local AI, adapters, and

  preferences never leave the device unless explicitly shared.
- Player knowledge: a statement shared by another player remains
  attributed to him and does not become an established fact; no metadata from GM.

### M24.3 — Synchronization and conflicts

- Change log with stable UUIDs and existing revisions; incremental sending and
  reception, offline operation, and subsequent realignment.
- Conflicts shown to the user with both versions, never silent overwrites;
  collaborative text evaluated with CRDT (Yjs/Automerge/Loro) only for
  shared documents.
- Revocation: an item no longer shared is removed from the server and from other
devices at the next synchronization, with a warning.

### M24 Acceptance

- Two or three synthetic users on the test server: invitations, roles, sharing of
a part of the campaign, concurrent changes, resolved conflict, revocation,
offline work and realignment. Private items never present on the server.
- Security testing (authentication, per-item authorization, limits), server backup
  and restoration, self-hosted installation guide.

## M25 — Chronexus on Android (APK) connected to the server (planned)

**Order:** after M24, which it depends on for accounts and shared data. **Status:**
planned, not started.

- Android app with Tauri 2 mobile (same React/Rust code; Android icons are
  already generated by `pnpm icons`), distributed as a **signed APK** in the releases
  Forgegit; Play Store outside the perimeter unless requested.
- Access to the M24 server with the **same account** as the desktop: campaign list,
  consultation of pages, sessions, graph, party, and shared cards; local cache
  for offline consultation. First version primarily in read-only mode; modifications
  mobile stats after testing (quick notes, dice rolls, hit points).
- Interface adapted for small and touch screens: navigation, single-
  reading, graph with gestures, readable texts, dark mode, accessibility.
- Beyond the first version: local AI, training, Logseq import, backup
  `.nodex` complete on mobile.
- Security: token in Android Keystore, mandatory HTTPS, no private data
  in addition to what was shared, local deletion upon logout.

### M25 Acceptance

- Signed APK installed on a real Android device (minimum version to
  be declared), access with the desktop account, shared contents visible and
  updated, offline cache usage, logout that removes local data.
- Frontend tests on mobile viewport, tests on at least one real phone; iOS out
  perimeter unless new request.

## M26 — English-first international release preparation (implemented Windows)

Requested on 25 October 2026. English becomes the primary source/default/fallback
language for new profiles, public documentation, app/package metadata, release
notes, agent instructions, MCP guidance and AI prompts. Italian remains selectable;
saved locales and pre-language Italian profiles retain their choices. Canonical
campaign text, IDs, legacy paths, attribution and historical Git commits are not
translated or renamed. English README is primary, with README.it.md optional.

The assistant receives an allowlisted interface locale and answers in that
language; absent/unsupported locales fall back to English. The training worker
uses English wrapper text while quoting original source content unchanged. No
training, implicit activation, external AI call or campaign mutation is introduced.

Acceptance: automated frontend/Rust/i18n/MCP and worker checks; native fresh English
startup, saved Italian after reload, English recovery, unchanged synthetic campaign
identity, keyboard-readable settings and public English screenshots. Evidence and
counts in docs/STATUS.md. Schema 018 and legacy app/storage identifiers unchanged.
Source version 0.8.1 is not a published release; installer/upgrade and other OS
checks remain pending. Next planned milestone remains M23, then M24/M25.

26 October follow-up: English source comments, test descriptions, diagnostics,
export/import wrappers and tooling completed. macOS build/check evidence and the
two reproduced baseline Rust test failures are in docs/STATUS.md; this does not
close platform acceptance or publish a release.

## Residual acceptances and next phase

- **M6:** runner/macOS/Linux packages and distribution tests not demonstrated
  from Windows tests alone; follow the updated STATUS evidence.
- **M7/M8:** physical proof without network and additional hardware/OS targets not certified;
  keep inference, refresh retrieval, and weight training separate.
- **M10:** revision of translations/Ticinese, fantasy lexicon, and testing
assistive/real IME; do not declare a complete translation when there is fallback.
- **M11:** distribution of large AI packages still open; the app release
0.4.0 of M15 does not publish nor completes the old draft 0.2.0.
- **M15:** upgrade of real files for both versions equipped with an updater and verification of other OS.
- **M16:** macOS/Linux, translations of new strings and future HTML changes
of Wikidot; M16 is included in the 0.5.0 release.
- **M15a:** illustrations included in the 0.5.0; remain real upgrades
from the popup between two signed releases, listening to the fanfare on multiple systems.
- **M21/M22/M20:** delivered on Windows on October 25 2026, included in the
release 0.8.0; the actual full download of a model
from 17,7 GB via the interface, macOS/Linux.
- **M19–M22:** published in release 0.8.0 on October 25 2026. For M19, macOS/Linux, physical evidence of full disk/read-only/redirected Documents remain

  a real update with backup in Documents. M18 is implemented on Windows; other GPU/OS and physical tests
  pending offline. Implement only upon request; the residues above remain open.
- **Planned (25 October 2026):** M23 audit (next), then M24 shared campaign,
  then M25 Android. None are implemented; each requires an explicit request.

## Outside the current scope

Automatic rule adapters verified for other systems/editions,
multi-station synchronization beyond what was planned in M24, advanced timeline, maps
interactive, PDF export of cards, and OCR require choices and milestones
of their own. None of these functions are implicitly authorized by M16.

## Checkpoint

The operational status, the tests actually performed, the commits, and the current blocks are
in docs/STATUS.md; the decisions are in docs/DECISIONS.md. The old checkpoints remain
in the Git history and in the historical sections of STATUS, without obsolete instructions
that restart already delivered milestones or prohibit already authorized publications.
