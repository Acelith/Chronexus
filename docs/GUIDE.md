# Chronexus User Guide

Detailed guide of functions, moved from the README to M20 without content changes. For installation and overview see [README](../README.md); for real status and limits [STATUS.md](STATUS.md).

## Settings

**App settings** in the sidebar now has six categories: Language and script,
Backup, D&D sources / Wiki, Local AI: components, Campaign sharing, and App
updates. Choose a category in the settings navigation to work with its controls.
Switching categories keeps unfinished form values in place; use each section's
save or confirmation action to persist them. An update opened from the herald
goes directly to App updates.

**Campaign settings** is separate and applies to the selected campaign. Its
Model, Sources and resources, Local knowledge, and local retraining sections
share the same navigation pattern. Source changes remain drafts until **Save
preferences**; an unsaved notice stays visible when you inspect another section.
Refreshing knowledge does not retrain a model, and training still requires its
own explicit confirmation.

## Languages and Scripts

In the left menu, **App Settings → Language and Script**: 10 natural
languages and five visual renderings (Braille, Morse,
Minecraft Galactic, Espruar, and Dethek). Immediate change, persistent choice, fonts, and local catalogs
Notes, cards, quotes, and backups maintain the original data.
Translations are drafts to be reviewed; missing strings fall back to English
The **Italian · Restore language and script** button remains readable.
Details, sources, limits, and maintenance: [docs/I18N.md](I18N.md).

## M0–M5 Functions

The sheet was expanded based on the user's PDF reference: manual sections for
combat/senses, identity and skills, history/appearance, weapons/ammo,
money/load, and magic. “Add D&D fields 2014” inserts missing characteristics,
rolls, and abilities without rewriting your values. Skill/proficiency,
modifiers, and death saves are manual. “Add slots 1°–9°” creates slots
at zero: you choose the maximums and availability. No automatic formulas are implemented.

From Character, Inventory, or Capabilities, use **Search in D&D**, choose category and
English name, and press **Search in API**. You can consult spells, classes,
species, equipment, magic items, privileges, traits, abilities, conditions, and
SRD rules 2014. The API does not contain all commercial manuals and does not offer
Italian at the time of verification. The name is filtered on the device.

Open a spell, choose **Use this data in the module**, customize, and press
**Save entry**. The original source remains visible even after renaming.
**Add spell** continues to create entirely your own entries; from the module you can
also **Search this name in D&D** and use a result as a base, maintaining
notes, markers, and links. Custom content remains local:
the API is read-only and does not publish them.

The network is optional and is activated only with an action in the catalog. Up to
150 downloaded responses are stored in SQLite with a date; entries saved in the
grimoire are independent copies. Consulted copies work offline after
reboot; a new entry requires a connection. **Update** searches for an
online version and reports any use of the local copy. Backup and restoration include
extended sheet, sources, and cache. No PDF, note, or personal sheet is sent.
Technical details and attribution: [docs/RULESETS.md](RULESETS.md).

- Creation, selection, and renaming of independent campaigns.
- Sessions ordered by number, with title and optional real date.
- Italian BlockNote editor: paragraphs, titles, lists, checklists, quotes,
  bold/italics. The `/` menu lists available blocks.
- Auto-save after 500 ms, visible status, "Save now" button, and
  retry. Changing note/campaign and normal closing wait for persistence.
  An error prevents navigation and preserves notes in the editor.
- Codex with typed pages, title, alias, draft/active, and block notes.
- `[[` Menu: write a name and choose an existing page or "Create draft" with
  mouse, arrows, and Enter. Even `[[Nome]]` remains text until you choose a result.
  Confirmed references maintain stable UUIDs and survive renames.
- Backlinks from sessions and pages, grouped by source with preview and opening
of the source block. The old title remains an alias after a rename.
- Ambiguous aliases presented as distinct results; missing references
recoverable explicitly as drafts with the same ID.
- Cytoscape graph with page/session nodes, dashed mentions and declared
continuous relations. Arrows, labels, and certainty clarify their meaning.
- Creation/modification of directional relations with confirmed, suspected,
refuted, or unknown certainty; optional session/page/block source, evidence, and notes.
  Relations require «Save relation»; an open form locks navigation
until it is saved or canceled.
- Filters for node type, mentions/relations, certainty, title/alias, source
session, and neighborhood of 1–2 steps. View limited to 150 nodes and 400 links,
with warning and counts when filters need to be narrowed.
- Click on nodes to open the document, on links to see source/evidence;
  accessible equivalent list for keyboard use.
- Relations can be deleted only after confirmation; pages, notes, and
mentions remain preserved. Deletion/archiving of pages
are not yet present.
- Manual `.nodex` backup of the entire archive and restoration with preview,
integrity check, confirmation, and preventive copy of current data.
- One character per campaign with identity, free regulation, optional
level/experience, current/max/temporary PF, conditions, and notes. Statistics,
skills, rolls, defenses, and movement are manually configurable values.
- Personal resources and slots with chosen maximum, +/- commands, and persistence of every
variation. No regulation formula, rest, or automatic consumption.
- Inventory with quantity (even zero), category, free weight/value,
equipment, consumables, description, and notes. Confirmed modification and deletion;
linked notes and pages are not deleted.
- Item provenance: session/block, PNG, location, and campaign mission,
with notes and optional Codex page. Opening the source and returning to the
selected entry. Names modified in the Codex do not change the link UUIDs.
- Spells/abilities with personal text, system, rank, school/tradition,
activation/duration/range/components, and independent known/prepared markers.
  Filters for name, rank, status/type, and links to Codex/session.

Forced process closure or a power outage may result in the loss of
changes that have not yet reached SQLite. Wait for «Saved to computer».
Only one instance can open the same archive; the lock is released by the
system even upon forced closure. Revisions continue to prevent obsolete
writes, without automatic merging of notes.

## Character, inventory, and abilities

Open a campaign and choose **Character → Create character**. Enter only the
values useful to your system; from **Edit character** add statistics and
resources/slots. Modules use explicit **Save character** / **Save entry**;
they are not autosaved. Navigation and closure wait for the end of a write
and require saving or canceling an open module. An error preserves the module.
Quick commands +/−, equipment, and ability markers save immediately.

From **Inventory → Add item**, note the name and quantity. To record a
key received from Varek in Session 12, select the NPC, the session, and the
source block already present in the campaign. If necessary, create the pages
in the Codex first, with PNG/location/mission type. From the item detail, open the source;
**Return to character entry** reopens the selected item.

A block deleted from the notes does not delete the provenance: it is flagged
as missing and the entire session can be opened. Provenance links
do not produce factual relations in the graph. In **Abilities**, write your text:
commercial catalogs are not included. No marker consumes PF, resources, or slots.
The contract for future adapters is documented in [docs/RULESETS.md](RULESETS.md).

## Backup and recovery

1. Open **Backup and restore** in the sidebar. Chronexus awaits the saving
   of notes; if it fails, it remains in the editor and reports the error.
2. **Create backup** opens the system selector. Choose a new name with
   extension `.nodex`, even on an external disk or mounted network drive. An
   existing file is always rejected, even if the selector proposes its replacement.
3. Wait for **Backup created and verified** and check path and counts.
   Includes **all campaigns**, characters, resources, items/abilities, documents,
   UUIDs, mentions, relations, and attachments
   in the managed folder. Does not include external files simply cited in the notes.
4. To recover on another computer or a new profile: **Select backup**,
   check date and counts, then **Replace archive**. All current campaigns
   are replaced; it is not an import or merge. **Cancel restore** or Escape
   preserve the current archive.
5. Before applying the restore, Chronexus saves a backup in `backups/` in the
   data folder. The full path appears in the receipt. To go back,
   select that `.nodex` in the same flow. If the preventive copy fails,
   the restore is interrupted.

ZIP/Deflate with manifest v1 and SHA-256 for each file; snapshot via SQLite API,
integrity checks and references, blocking of hostile paths and altered files.
**Not encrypted or signed**: keep private copies and use backups from
trusted provenance. Limits: 32 GiB per file and in total, 9998 attachments; a backup
or restore first checks that the disk has enough free space. Backups above 512 MiB
cannot be opened by version 0.9.2 or earlier.
Markdown/JSON ZIP export is available from **Export campaign**; it includes
images, imported original sources, and SHA-256 manifest. Authoritative restore
uses `.nodex`; re-import of the export and automatic backups remain future.

From **Entry images** in Codex pages, in the sheet, and in items you can
add PNG/JPEG/WebP with caption and role, view them, and enlarge them. For
a map, use a Location page and the Map role. These are real local copies included
in the backup, without depending on the original path. Limits: 20 MiB, 8192 pixels
per side, 32 million pixels. Removing the link keeps the file for
recovery; missing or corrupted originals prevent the backup.

Keep space for ZIP, extraction, and new copy of the data. Old generations and
preventive copies are not automatically deleted. Backups with schema 005
require a version that supports the corresponding schema (005 for M5,
006 per extended sheet and catalog, 011 for M6, Logseq sources, Party and wiki); previous backups (1–10 schemas) remain
recoverable and are updated in copy. Archives `.nodex`
with the old name still exist: there is no need to rename them. M0–M3 executables ignore
the profile selector introduced by M4.
If the current database is so damaged that it prevents opening, the restoration
in that folder is blocked: with Chronexus closed, keep **the entire data folder**
separately, then start on an empty data folder and select a valid backup.

A mention only indicates that a page is cited in the notes: it does not create
alliances, accusations, or other factual relations: these are declared manually
in the graph, with certainty and explicit sources. Codex search concerns titles and aliases; global search
in the text is available via **Search** or Ctrl/⌘K, with filters and source block opening.
Ctrl/⌘ShiftN creates a session. **Summary** opens recent entries.

Repeatable desktop tests and verification matrix: [docs/QA.md](QA.md).

## Graph, Party and wiki

The appearance uses parchment, dark leather, brass, and local serif titles; navigation
remains ordinary. The graph starts from a readable map of a maximum of 18 nodes;
**Show all nodes**, **Layout → Organic**, and the filters allow you to
explore other sets. Select a node to highlight connections and
open the entry or explore its neighbors. The view data limit remains
150 nodes/400 edges; the accessible list keeps all returned sources.

From **Party → Add member** create a character or link an existing Codex page,
add player/role/presence and write in **What I know**.
Notes are automatically saved on the same Codex page and are
searchable. Images use existing attachments and are included in the backup.
Removing from the party preserves the page, notes, and images. The party does not create
additional complete playable sheets or implicit factual relationships.

**D&D Wiki (M16).** In **Settings → D&D Sources / Wiki** choose
**Wikidot D&D 5e** (default) or **Open5e**; the choice is global and does not change
with campaign restoration. With Wikidot, choose a category (spells,
talents, species, backgrounds, classes, magic items) and press **Search on Wikidot**:
Chronexus downloads the public index of the category and filters the name on the
device, then opens an entry. The text is displayed as plain text with declared
source, origin (published, Unearthed Arcana, homebrew), URL, and license of the
page; unrecognized fields are flagged, not invented. For a spell,
**Prepare import in sheet** opens the module in Spells: it is saved only
with **Save entry**. If Wikidot does not provide information, Chronexus asks if you want to use
Open5e: only by accepting the choice is it saved and the search repeated there.
**Clear offline cache** deletes the viewed copies of a source or both,
after confirmation; campaigns, imported spells, images, backups, and choices remain.

**Open5e** consults [Open5e v2](https://open5e.com/api-docs/), next to the existing personal
SRD catalog. Search for English terms, open an entry, and check source,
edition, and licenses; the consulted answers remain in SQLite and in the backup.
The search sends only the explicitly typed term; no notes are
uploaded. **Update online** is explicit; a failure keeps the local copy
with a warning. Cache limited to 100 answers: the least recent can be
replaced. Sources and coverage do not equate to all commercial manuals.
API/Skill Search: [docs/RESEARCH_DND.md](RESEARCH_DND.md).

## Sharing a campaign (M24, optional)

Chronexus keeps working offline; sharing needs a self-hosted Chronexus server
(planned in M25) and is used only when you ask for it.

1. **App settings → Campaign sharing:** enter the server's HTTPS address and press
   **Verify and save server**. Sign in, or create your account with an invitation
   code. The password is sent only to that server and is never stored.
2. **Sharing** in the campaign menu: create the shared campaign on the server, or
   join one with a campaign invitation. The owner can invite players and readers.
3. Tick the Codex pages, sessions, relationships (only between shared pages) and
   party members to share. Everything else stays private on this device.
4. Press **Synchronize now** to send your changes and receive the others'. Items
   from other players appear under **Shared with you**, read-only and attributed to
   their author: they are claims, not facts of your campaign.
5. If an item changed both here and on the server, **Conflicts** shows both versions;
   choose which one to keep. Nothing is overwritten silently.
6. Unticking an item removes it from the server and from the other players at their
   next synchronization; your local copy stays. **Unlink this campaign** forgets the
   sharing state on this device only.

The contract between app and server is in [SYNC_API.md](SYNC_API.md).

## Local Assistant M7

The **Local Assistant** section queries the campaign notes and the D&D
entries already saved in the Wiki, separated by edition. Italian answers with
reopenable sources, streaming, undo, and history preserved in backups/exports.
Does not modify notes, relationships, sheet, or inventory.

Tested model: **Qwen3:4b-instruct**, multilingual with local sources, explicitly chosen
after insufficient tests of the specific D&D candidate.
It is not fine-tuned on D&D; citations and answers require player verification.
Ollama and the weights are separate from the installer and backups; no automatic download or
inference at startup. The app also works without the runtime.

In this session's project, start `powershell -File scripts/Start-LocalAI.ps1`,
then Chronexus, a campaign → **Local Assistant** → **Check Ollama** →
`qwen3:4b-instruct` → confirm the multilingual profile → **Activate local model**.
The runtime must confirm cloud is disabled and GPU is available; exclusive CPU
is locked before sending notes. No fallback to cloud.

Setup on new machines, model identity, testing, and limits:
[docs/AI_LOCAL.md](AI_LOCAL.md). The search is lexical and uses limited extracts
precise names/aliases help. A valid citation does not guarantee truth.


## M8 — Gemma and campaign retraining

From the **Campaign Settings → Local AI** menu, choose Gemma 4 12B,
edition, and local sources. **Retrain on new data** performs QLoRA on the GPU
and prepares an adapter; **Activate adapter** applies it only after verification
and an explicit choice. **Update knowledge** updates the search instead,
without modifying weights. Adapters and provenance are included in backups, weights
base and derived GGUF copies remain outside. No automatic modification of facts.

On this computer, the backend is prepared. To start Ollama use
`powershell -File scripts/Start-LocalAI.ps1`, then open the updated Chronexus
or run `pnpm desktop` with the Rust environment configured above. For the setup
on another computer, requirements and limits: [docs/AI_TRAINING.md](AI_TRAINING.md).
M8 app installer: `installers/Chronexus-M8-Windows-x64/` (unsigned, generation
verified; M8 installation not repeated). The complete M7 package remains distinct.

M8 Verifications: 69 Rust test, 59 frontend and 5 Python worker, desktop/NSIS build and
actual training RTX 4080 SUPER with 74 extracted/74 steps. Physical offline
and other platforms remain. M9, the dice roller, is now operational on Windows. The next functional milestone is M10, the multilingual.

## Dice roller — M9

From the left menu of the campaign, open **Dice roller**: d4, d6, d8, d10, d12, d20 and
d100, independent quantities and mixed rolls. Up to 50 per type/100 dice per roll;
selection reset after confirmation, SQLite history for campaign included in backups.
Dragon's circle and quick slot revelation, skippable and with reduced movement.
The scene shows up to 14 dice; all values remain in the detail.

Guide, schema compatibility 015 and tests: [docs/DICE.md](DICE.md).
To start on Windows from the current folder: `./scripts/Dev.ps1`;
updated executable in `src-tauri/target/release/chronexus.exe`.
The previous installer was not regenerated in this milestone.


## Internal Updates (0.4.0)

In **App Settings → App Updates**, check,
download and installation with mandatory verified backup are available. No client login;
public Forgegit endpoint or configurable HTTPS manifest. Previous versions
require a first manual installation. Procedure: [docs/UPDATES.md](UPDATES.md).

**Herald (M15a, after 0.4.0).** At startup, Chronexus checks the update channel
once (at most every 20 hours; can be disabled in the same section). If a new version
exists, when the app is inactive, a herald with a trumpet presents the
manifest: **Update** starts the verified download, **Remind me later**
postpones by 3 days, **Ignore this version** does not announce it again. Installation
always requires **Create backup and install**. Sound can be disabled.

`pnpm package:desktop` now produces signed updater artifacts and requires the
maintainer's private key, which is not in the repository. For a local build not
intended for the update channel, use `pnpm icons` and
`pnpm tauri build --config '{"bundle":{"createUpdaterArtifacts":false}}'`.
Do not publish that build as a signed update.
