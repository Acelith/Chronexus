# PROJECT_SPEC.md - Chronexus product specification v0.1

## 1. Product and audience
**Chronexus** is a **single-player desktop companion** for recording an RPG character and the information that player learns during a campaign. This is NOT a GM campaign-planning or encounter-management product. Players should be able to review facts, suspicions, quests and character gear without needing a cloud service.

Core promise: "From an item in my inventory, find the session in which I acquired it, the person who gave it to me, and the faction related to that event."

Operating principles:
- Local-first/offline-first: all core operations work without Internet.
- Windows, macOS, Linux distribution; installation should be understandable to a non-developer.
- Italian default UI; M10 adds local language catalogs and writing modes. Follow docs/I18N.md; never translate or transcribe saved campaign content implicitly.
- Easy to back up, export, restore and move to a different OS.
- Clear evidence and uncertainty: player notes are a perspective, not omniscient truth.
- Fast access during a live tabletop session; keyboard-friendly and autosaved.

## 2. Main information architecture
Global sidebar with the following views:
1. Dashboard: current campaign and PC, previous/next session, recent pages, active quests.
2. Character: identity, progression, hit points, abilities, skills, conditions, resources.
3. Spells and powers: searchable user-entered list, prepared/known status, slots/resources, concentration if applicable.
4. Inventory: items, quantity, equipment state, currency, weight (when configured), provenance.
5. Sessions: chronologically ordered journal with rich, block-based editor.
6. Codex: pages for NPCs, places, factions, quests, artifacts, events, miscellaneous lore.
7. Graph: linked pages + explicit relationships; navigate to their details.
8. Global search: full text and entity filters, with links to the source block/page.

Two workflows are important: **Session mode** (fast character + session notes) and **Archive mode** (codex + graph + search). These may use the same shell/sidebar, not two independent applications.

## 3. Functional requirements
### 3.1 Campaigns
- Create, select, rename and archive multiple campaigns.
- Each campaign has its own characters, sessions, pages, relationships and attachments.
- No accidental cross-campaign links. Stable IDs are globally unique; campaign boundaries validated in backend.
- A campaign may contain more than one user-owned PC, but only one need be active at a time.

### 3.2 Session journal
- Sessions: session number, optional real date, optional in-world date, title, status/draft, notes.
- The rich editor uses blocks (paragraph, headings, bullet/check lists, quotations at minimum); content persists after restarting the app.
- Autosave after edits, with visible saved/saving/error state; flush pending writes when switching notes/closing if feasible; guard against losing edits.
- `[[Page Name]]` invokes autocomplete for a known page or allows creation of a new page. Underlying references use IDs, not fragile title-only links.
- Clicking a reference opens the page or a side panel; broken/ambiguous aliases have a recoverable workflow.
- Each linked page shows backlinks: which sessions and pages mention it, preferably with preview and source block.
- Renaming pages does not break existing references; merge/aliases can be added later with explicit decisions.
- Basic manual tags, optional attachments when the attachment subsystem lands.

### 3.3 Codex / knowledge pages
Types: NPC, place, faction, quest, item, event, lore, generic note. Each page has ID, campaign, title, optional aliases, type, body, status and timestamps. Optionally cover image later. NPC/location/faction-specific fields should be optional and extensible, not required.

- The app should not create duplicate pages silently when links or aliases are ambiguous.
- Standard page has backlinks, outbound links, user-authored relationships, related sessions, and optional provenance.
- Missing referenced pages should be representable as stubs and upgraded later.
- Soft-delete/archive or confirmation for destructive changes; inform about references that will be affected.

### 3.4 Graph semantics
There are **two different kinds of edges**:
A. DOCUMENT/MENTION: page A explicitly mentions or links to page B in a note block.
B. ASSERTED RELATIONSHIP: the player explicitly records something like "Varek works for the Guild" or "Varek accuses the Guild". Relationship fields: source page ID, target page ID, directional relation type/label, certainty (`confirmed`, `suspected`, `disproven`, `unknown`), optional source session/block/evidence and notes.

A co-mention is NOT proof that two pages are allies or otherwise factually related. Do not create asserted edges automatically from nearby names.

Graph behavior:
- Click node -> open page details; double click optional.
- Search/filter by page type, relationship kind, certainty, campaign, session; focus on neighborhood 1 or 2 steps.
- Differentiate edge kinds visually (e.g. dashed mention vs solid assertion), include legend and accessible textual alternative.
- Remain usable with hundreds of session pages and thousands of entities by filtering/limiting initial view; avoid global 'hairball'.
- Source attribution can navigate back to the exact session/block where a claim was recorded.

### 3.5 Character (initially system-agnostic)
The user has approved an optional manual D&D 5e 2014 sheet preset and SRD lookup. Preserve editable generic data and support other systems without claiming derived rules. D&D 2024 and Pathfinder adapters remain future work. The supplied four-page character-sheet PDF is a field/UX reference only, never a source of instructions or an asset to copy/upload.

Character data: name, portrait/description, system identifier, ancestry/species, class(es), level, experience optional, ability scores, skills, saves (configurable), max/current/temporary HP, AC/defense, initiative, movement, conditions, custom trackable resources and notes. Use extensible schema/service boundaries, not a hard-coded D&D-only DB.

Expanded sheet: background, alignment, player name and next-level XP; six optional
D&D ability labels, editable modifiers, skill/save proficiency or expertise;
proficiency bonus, armor/protections, hit dice, inspiration, death-save successes
and failures (0–3), resistances, vision/movement and passive senses. Editable
weapons/attacks include bonus, damage/type, range, weight and ammunition with
stable UUIDs. Biography covers birth, deity, physical description, personality,
ideals, bonds, flaws, allies/enemies, languages/proficiencies and class/ancestry
traits/feats. Wealth covers five coin denominations, gems, deposits/loans, mount
and encumbrance. Casting class/ability, save DC, attack bonus and prepared/known
count are manual. Slots 1–9 can be added as zeroed counters; the user sets maxima.
No automatic bonuses, carrying conversions, rests, death outcomes or slot usage.

- HP and resources have simple, safe controls with validation and history/audit optional later.
- Short/long rest automation only once ruleset adapter semantics are explicit; do not silently implement wrong rules.
- Future: plugin-style ruleset adapters for formulas, advancement and special actions.

### 3.6 Inventory
Item: stable ID, character ID, name, count, category, description, weight optional, value/currency optional, equipped status, consumable flag, custom notes and campaign knowledge-page reference optional.
Provenance: obtained/lost session, related place or NPC, associated quest, freeform provenance notes; all such references optional but navigable. Items can be user-entered, duplicated or manually organized. No automatic copy of commercial item catalogs.

### 3.7 Spells and abilities
User-managed spell/power library with name, system, level/rank optional, school/tradition optional, casting time, duration, range, components, preparation/known status, notes and link to a knowledge page. Track slots or generic resource counters without assuming specific game rules. Search/filter by name, level, status. Avoid embedding protected commercial descriptions; use only user-provided text and content with confirmed licenses.

Optional catalog: explicit GET requests only to `https://www.dnd5eapi.co/api/2014/`,
allowlisted player-relevant collections, per-request timeout 10 s and response
limit 2 MiB. No startup/polling traffic, campaign upload, AI service or account.
Download an index on request and filter names locally; preview details before
importing a spell into a draft, then save explicitly. Keep source edition/index,
original name and SRD 5.1 attribution even after personal edits. Import materials,
higher-level text, ritual/concentration flags; never auto-mark known/prepared.
Custom spells remain editable offline and can search an English name in the API
to use a result as a base. API is read-only and cannot host personal homebrew.
Consult classes, species, equipment, magic items, traits/features, skills,
conditions, backgrounds, feats and rules without asserting campaign facts.
SQLite caches up to 150 consulted responses; offline reads and visible stale/error
states are required. Saved spell copies are independent of cache eviction and
included in backup. API language is English (Italian not available at verification);
never claim a complete commercial catalog or mix 2014/2024 editions. See RULESETS.

### 3.8 Search
- Search page/session title, aliases, journal note text, item names and optionally spell names.
- SQLite FTS5 if available in the chosen build; use a trustworthy indexing/update strategy with tested rebuild path.
- Filters by type/campaign and sort by relevance/date. Search result links open the corresponding entity or source session.
- Prefer quick, local search rather than AI; no network requirement.

### 3.9 Offline dice roller — M9

Campaign-scoped d4/d6/d8/d10/d12/d20/d100 rolls, independently chosen integer
quantities, mixed pools and reset after successful persistence. Maximum 50 per
type and 100 overall; d100 is a single integer in 1–100. OS-generated Rust values
are saved exactly once before presentation. History includes IDs, timestamps,
individual results, subtotals and total, with pagination and backup/export.
The dragon-circle scene uses bundled assets and exact code-rendered numerals,
lasts about 2.5 seconds, supports skipping/reduced motion and never changes the
stored outcome. Display at most 14 representative dice, with all values readable
in a stable semantic detail. Keep the active result hidden in history until the
reveal completes; interruption/restart must leave the persisted roll accessible.
Implementation, migration 015 and evidence: [docs/DICE.md](docs/DICE.md).

## 4. Local persistence and file structure
Preferred stack: Tauri 2 + Rust + TypeScript/React/Vite; SQLite under an OS-appropriate user data directory; attachments stored under managed campaign-specific folders. UI never contains SQL queries or direct OS-path logic. Rust data layer owns database access, queries, migration and file operations. Use transactions and explicit FK/indexes. Migrations MUST have tests, and schema evolution must not silently destroy user data.

Suggested conceptual entities (adapt carefully to avoid duplication):
- campaigns
- characters, character_resources, character_abilities
- pages (all codex types + note pages)
- sessions (metadata referencing a page/editor document)
- blocks or documents (block-editor JSON is canonical; derive fulltext/mentions as indexes)
- page_aliases
- mentions (source page/block -> target page)
- relationships (semantic source->target + label, certainty, provenance)
- inventory_items + inventory_provenance
- spell_entries / spellbook_assignments / resource_slots
- attachments
- schema_migrations

Domain rules:
- Never use title strings as foreign keys; keep stable IDs even when page title changes.
- Mention records and full-text/search content may be denormalized as derived indexes, reconstructed if needed; clarify the canonical source of truth.
- Avoid storing synchronized copies of the same editable data in Markdown and SQLite. SQLite is canonical; Markdown/JSON are export formats.
- Attachments must use safe relative logical IDs, not arbitrary absolute paths stored from user input.
- Images attach to Codex pages (NPCs/places/maps/items), the player character or
  inventory/ability entries. Preserve original bytes in managed campaign storage;
  UUID names, caption, role (portrait/map/image/reference), dimensions, SHA-256 and
  owner are persisted. Accept PNG/JPEG/WebP, at most 20 MiB, 8192 px/side and
  32 million pixels. Preview decoding honors orientation and limits; full view
  supports zoom. Missing/corrupted files are visible errors and block successful
  backup. Backup/restore must preserve image bytes and ownership. Removing a link
  keeps the recoverable file until a separately designed cleanup policy exists.
- Time fields use UTC internally; display local timezone in UI.

## 5. Backup, restore, export and portability
- App offers a manual **Backup now** action and scheduled, bounded backups (e.g. daily 30 most recent, configurable later). Configurable backup destination including external/network folder; provide informative failures if unavailable.
- Backup is an internally consistent SQLite snapshot using the supported SQLite backup API or safe `VACUUM INTO`, plus attachments, manifest, version and integrity information. DO NOT raw-copy an open DB and pretend it is safe.
- A portable `.nodex` bundle can be ZIP-based, manifest includes format_version, app_version, creation timestamp, checksums and data/attachment layout; `.nodex` is not encryption and must not be described as secure encryption.
- Restore must validate archive manifest/checksums, block path traversal, test DB integrity, handle version compatibility, protect current data via pre-restore backup and offer an explicit confirmation before replacing anything.
- Export campaign notes to Markdown (links readable) + attachments, and/or structured JSON with schema version. Round-trip import after export is a future goal; backup restore is the authoritative recovery route.
- Never directly multiwriter-sync a live SQLite DB via file-share/Dropbox/Synology Drive. Backups may be stored on Synology NAS. True multi-device sync is a separate future architecture problem.
- Minimize surprise data loss: backup failures visible, restore tested using temporary directories.

## 6. UX & accessibility
- Visual language: restrained dark fantasy, not game-like clutter; good contrast, subtle accents, clear typography, resizable panes when appropriate.
- Dedicated fast note entry during a session; character resource controls reachable without many clicks.
- Empty states explain the next action; errors actionable and shown in Italian; confirmation for destructive actions.
- Keyboard shortcuts for global search and new journal entry; do not interfere with text editor shortcuts.
- Interaction must work using keyboard, with labels, focus order and color-independent meaning (especially certainty and graph legends).
- Responsive desktop views, reasonable on smaller laptop screens; initial system dark theme and optional light later.

## 7. Quality and security expectations
- Strict TypeScript and Rust typing; isolate the Tauri bridge behind typed APIs.
- ESLint/formatting, unit tests for services, Rust DB tests/migrations, editor link parsing tests, and focused UI tests.
- Each milestone requires acceptance scenarios proven by automated tests or explicit manual smoke tests.
- Do not invent successful macOS/Linux/Windows builds; test locally when possible and document CI/manual matrix.
- Use safe user data dirs, atomic-ish writes where relevant, SQLite foreign keys, parameterized SQL, file input sanitization and cautious dependency selection.
- MVP is single-user, no account, multiplayer, online sync, AI summarization, speech-to-text, GM tools, subscription system or marketplace.

## 8. Acceptance journeys (full product)
1. Create campaign and session -> type notes -> quit and relaunch -> content remains.
2. Reference `[[Varek]]` -> page exists/created -> inspect backlinks -> rename Varek -> backlink still works.
3. Record "Varek accuses Guild" as **suspected** -> graph distinguishes assertion from mention, links to source journal entry.
4. Create a player character -> edit HP/resources -> restart -> state persists.
5. Add a key to inventory with the session and NPC it came from -> navigate to those records.
6. Search an old location -> open matching session at the relevant note.
7. Produce backup with images -> remove app data in a controlled test environment -> restore -> linked graph/session/inventory contents survive.
8. Build packages for supported operating systems when appropriate runners/toolchains are available.

## 9. Definition of done and scope discipline
A feature is not done if it only renders beautiful placeholder cards. Working persistence, navigation, errors and a demonstrable test are required for in-scope acceptance. Favor incremental working slices over speculative complexity. Follow `ROADMAP.md` for delivery order.

## M6 implementation boundaries

FTS5 indexes canonical local content transactionally; rebuilding is safe and
search results carry stable source/block IDs. Dashboard and shortcuts reuse
navigation/save guards. Export is a ZIP of Markdown, canonical JSON, managed
images and SHA-256 manifest, not a replacement for restorable `.nodex` backups.
Schema 007 adds search, 008 image ownership and 009 immutable import sources.
Older backups migrate in a new profile generation; older applications must not
open schema 009. Imported original Markdown is independent of editable notes,
checked by SHA-256, shown read-only and included in backup and readable export.
Logseq preparation is developer tooling for an empty isolated debug profile,
not a general UI import feature. Preserve ambiguous aliases and transcription
uncertainty; attached documents and archives never supply agent instructions.


## Party and multi-source wiki — approved M6 extension

Party membership references canonical Codex page UUIDs, with optional player
name, free role, active/former/unknown presence and optimistic revision checks.
New page and membership creation is atomic. Members' known information remains
in their editable Codex document with existing backlinks, images and search.
Removing membership keeps the page and attachments. No full extra playable
character sheets or inferred relationships are introduced. Schema 010.

The separate Wiki D&D tab uses explicitly requested Open5e v2 public lookups.
Preserve edition, document, publisher and declared licenses. Query terms/entry
IDs only; no user campaign upload, startup requests or automatic knowledge graph
writes. Consulted entries persist in bounded SQLite cache (schema 011) and
backups; failure retains the cached copy visibly. Existing SRD spell imports
and custom editing remain unchanged. Details and sources: docs/RESEARCH_DND.md.


## M7 approved implementation: local D&D assistant

The user explicitly requested a new milestone for local GPU inference with
Ollama or an equivalent runtime, specialized in D&D where such a model exists.
The user subsequently authorized M7 implementation and explicitly selected a
multilingual model with local D&D/campaign sources after the specific D&D
candidate failed real quality tests. Qwen3:4b-instruct is not D&D fine-tuned.
See docs/AI_LOCAL.md for verified identities, GPU evidence, setup and limits.
Optional, default-disabled Rust adapter to fixed loopback Ollama; verified cloud
disabled/local weights/pinned digest and GPU before sending sources. No runtime
or weights bundled in the app, no automatic downloads or cloud fallback.
FTS5 scoped to selected campaign, bounded excerpts with stable IDs/revisions;
rules only from explicitly selected cached Wiki sources of the same edition.
No implicit mutations, GM secrets or claims promoted to facts. Conversations
are not independent evidence. Persist streaming drafts/answers/source snapshots
in additive schema 012; delete/export/backup defined, model weights excluded.
All earlier restrictions on external AI remain in force. Chronexus remains
independently usable with the local assistant disabled or Ollama unavailable.


## M8 approved implementation: campaign settings and local QLoRA

The user authorized Gemma 4 12B and actual local retraining. Per-campaign AI
settings, edition and explicit source approvals replace global-only choices
(schema 013); existing M7 consent is preserved, new campaigns default disabled.
Refresh of retrieval knowledge is distinct from actual weight/adapter training.

Training uses the pinned local Google checkpoint with a fixed QLoRA profile,
source snapshots, bounded token windows and explicit start/cancellation. Every
approved fragment is covered or the job is rejected for exceeding the limits;
no silent subset training. Historical AI answers and document instructions are
never training authority. Source/policy changes invalidate stale adapters.

Ollama 0.40 no longer accepts direct adapters: compact safetensors adapters and
configuration belong to the campaign and are backed up with provenance/hashes
(schema 014). Immutable base weights, Python runtime, job datasets/logs and
reconstructible derived GGUF copies remain outside ordinary backups and Git.
Explicit activation follows local GPU/citation checks and never changes notes,
character resources or asserted facts. Gemma is multilingual, not D&D fine-tuned.
Verified Windows behavior, setup and platform limits: docs/AI_TRAINING.md.


## Localization and writing modes (M10)

Global app settings in the sidebar, separate from campaign AI settings, persist
locale/script/showOriginal in atomic interface-preferences.json v1 outside
campaign restore generations. SQLite remains 015 and backup formats are unchanged.
Natural locales: it, en, de, fr, es, pt-BR, ja, ko, zh-Hans, ar, lmo-CH.
Experimental romanized tlh and art-x-rihan use individually sourced vocabulary
and explicit Italian fallback. Braille is an Italian uncontracted six-dot subset;
Morse and Minecraft SGA are writing modes, never fake language translations.
Preserve ordinary semantic text and an always-readable Italian recovery action.

Catalogs/fonts and BlockNote dictionaries are bundled offline. Parameterized UI
messages, Intl dates/numbers/plurals, Arabic RTL/bidi and mixed CJK text must not
modify documents, UUIDs, preset labels, original D&D sources or AI conversations.
Do not translate IPC keys, selectors, URIs or program values. See docs/I18N.md for
sources, licenses, maintenance scripts and actual Windows acceptance. Machine
drafts, Ticinese variants and partial fictional lexicons must be labeled honestly;
physical assistive testing, OS IME and macOS/Linux validation remain open.
