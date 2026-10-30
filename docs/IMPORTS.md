# Local campaign imports (M36)

Open the campaign overview. Imports preview local files and require a completed,
verified `.nodex` backup before writes. Cancelling the backup leaves the campaign
untouched. Imports create new IDs; they never merge pages based on a name or alias.
A multi-command import can fail partway through: keep the displayed backup and
restore it to undo the entire import. Do not repeat an interrupted import over its
partial results. The backup restores the whole archive, including other campaigns.

## Obsidian and Logseq

Choose a vault folder. The preview accepts 1–2000 Markdown pages, with a 1 MB
per-page limit and 200 MB/5000 files overall. Duplicate page titles block import;
ambiguous or missing links stay plain text. Supported `[[links]]` become UUID
mentions, so renaming a page preserves them. Front matter and Logseq properties
provide explicit titles and aliases. Local supported images use the existing
managed-image validator; remote URLs are never fetched. Scripts, hidden plugin
folders and settings are not executed. This is a bounded Markdown import, not a
complete renderer for either application's plugin syntax.

## Kanka JSON ZIP

Choose a JSON campaign export from Kanka 2.1 or later. The parser accepts
`info.json` with `kanka_version`, or the documented `info.md` version line,
including `kanka_version::`. The ZIP is read without extracting or executing it:
50 MB compressed, 100 MB declared expanded size, 5000 files, 2000 supported
entities and 1 MB per entity. Unsafe paths and duplicate entity IDs reject the
preview. Invalid/oversized entity files produce localized preview warnings.

Supported folders: characters, locations, organisations, families, quests, items,
events, notes, journals, races and creatures. The shared `entity.id` is the import
identity; it is distinct from the child object's ID. Only entry text is rendered,
with scripts/styles removed; the complete original entity JSON is retained
immutably with SHA-256. Images, gallery, custom modules, settings, posts and other
structured fields are not imported as separate objects. Entity text is bounded to
200,000 characters/5000 lines; the original remains available for omitted fields.

Repeated/conflicting names receive a Kanka-ID suffix and, if needed, a counter.
Relationships between imported IDs become **unknown**, attributed relationships,
never confirmed facts. Mirrored pairs are deduplicated; missing/self targets are
reported, not guessed. At most 200 relationships per entity are offered.

Format references checked against the public upstream source on 30 October 2026:
[Kanka ExportService](https://github.com/owlchester/kanka/blob/develop/app/Services/Campaign/ExportService.php),
[Entity export](https://github.com/owlchester/kanka/blob/develop/app/Models/Entity.php),
[Kanka import documentation](https://docs.kanka.io/en/latest/features/campaigns/import.html).
Only synthetic fixtures are committed; no Kanka application code or campaign data
is bundled.

## Character JSON

The supported format is Brian Wendt's documented
[Character.schema.json v0.1.1](https://brianwendt.github.io/dnd5e_json_schema/Character.schema.json.html),
extending [Creature.schema.json](https://brianwendt.github.io/dnd5e_json_schema/Creature.schema.json.html)
for D&D 5e 2014. This is not a general D&D Beyond/Foundry/Roll20 importer or a full
JSON Schema validator. The local file is limited to 1 MB and decoded as strict
UTF-8. It must identify the character, player, race, ability scores and hit points.

Explicit fields map to identity, class (single-class level only), XP, ability
scores, HP, AC and supported background/appearance/personality notes. Invalid
numeric values are rejected; modifiers and multiclass levels are not calculated.
Missing optional fields use the empty-sheet defaults. Equipment, spells and other
unmapped fields remain only in the immutable original JSON, stored on a new
source page. The importer refuses to replace an existing character. The original
schema is referenced, not vendored; its source attribution remains upstream.

## Verification

Synthetic parser and component tests cover version formats, inert HTML, missing
relations, duplicate identities/titles, backup cancellation, partial failure,
existing-character refusal and exact original preservation. The `.nodex`
round-trip test restores and reopens imported sources alongside calendar/map
records and checks SHA-256 and rename-safe IDs. See [STATUS.md](STATUS.md) for the
actual platform checks and limitations.
