# ROADMAP.md - Nodex incremental execution plan

## Working method
- Execute one milestone or bounded related slice at a time. Avoid an everything-at-once generation attempt.
- For each milestone: inspect repo and relevant docs -> implement -> validate -> fix -> commit with detailed body -> update `docs/STATUS.md` -> summarize.
- If a milestone is large, split it into independently testable and separately committed subphases.
- Keep no-op UI mocks out of completed feature claims.
- Record real decisions in `docs/DECISIONS.md` when they materially constrain later work.
- First Codex invocation: implement **M0 and M1 only**, if the environment permits. Stop after reporting those results; do not begin M2 automatically. If resource or environment limits block M1, finish M0 responsibly and document next steps.

## M0 - Foundation and real local database
Goal: a bootable Tauri 2 / React / TypeScript desktop app backed by a real Rust + SQLite persistence layer.

Deliverables:
- Initialize or safely adapt repo, package manager (prefer pnpm), Vite + React + TypeScript strict, Tauri 2 Rust project.
- Cohesive app shell in Italian: sidebar, navigation, dark theme, empty states, no fake product data presented as real.
- SQLite initialization in OS app-data directory and first reversible/traceable versioned migration.
- Typed bridge to Rust commands; clear error handling, no raw SQL in React.
- Basic read/write smoke operation proving data survives app relaunch (test or repeatable manual smoke procedure).
- Scripts for dev, lint, typecheck, test, Rust test and build; gitignore, README setup for Windows/macOS/Linux, `docs/STATUS.md`.
- Initial focused tests and a meaningful Git commit with exhaustive message body.

Acceptance:
- Dev app boots (if build environment supports Tauri).
- Typecheck and available local tests pass; startup with empty DB is handled.
- DB schema is migrated once and remains valid on second startup.
- No remote API required at runtime.

## M1 - Campaign/session first useful vertical slice
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
Goal: preserve a campaign before adding more character complexity.

Deliverables:
- SQLite-consistent snapshot + attachments archive, manifest, checksums, ZIP-based `.nodex`.
- User-triggered backup; safe backup destination chooser; visible errors and overwrite rules.
- Restore validation, path traversal protection, DB integrity checks and pre-restore safety copy.
- Basic Markdown/JSON export if it can be done without blocking recovery work.
- Automated backup->restore round-trip test with pages, sessions and references.

Acceptance:
- Export `.nodex`; simulate a fresh test profile; restore; compare sessions, links, relationships and attachment counts.

## M5 - Player character, inventory and spells
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

## M6 - Search, polish and cross-platform release
Goal: reliable daily-use experience across all target OSes.

Deliverables:
- FTS5 search and tested index rebuild across notes, page titles and supported character assets.
- Keyboard shortcuts, refined dashboard, visual usability/accessibility, performance tuning.
- Markdown/JSON export completion and attachment handling.
- CI pipeline to run tests; actual Windows/macOS/Linux build matrix if runners available.
- Package installers (.exe/.msi, .dmg/.app, .deb/.AppImage as supported by tools), verify names and packaging constraints.
- README with real local install/backup/restore instructions, limitations and manual QA checklist.

Acceptance:
- Search source note, restart, run backup/restore, navigate graph, validate on supported OS build environments without presenting untested builds as verified.

## Future (not MVP)
Ruleset adapters (D&D 5e 2014/2024, Pathfinder), optional portable sync with conflict handling, advanced timeline, maps, PDF character exports, OCR, AI-assisted suggestions requiring user consent, multi-PC campaigns, extensions.

## Status/checkpoint minimal template
Codex maintains `docs/STATUS.md` with:
- Current milestone: done/in progress/blocked.
- Last completed user-visible scenario.
- Relevant checks: exact command, PASS/FAIL/NOT RUN + reason.
- Last meaningful Git commits (hash and subject).
- Up to 5 known issues/blockers.
- Next single actionable milestone + a concrete verification target.
Do not turn status into a transcript or paste build logs into it.
