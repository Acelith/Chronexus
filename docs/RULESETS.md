# Adjustment Adapters

M5 and its extension save manual values. `systemId` is a free label, it does not select a game
sheet, resources, inventory, and capabilities remain usable offline
with any label. No commercial text is included.

The local contract is `RulesetAdapter` in `src/features/player/rulesets.ts`:

- `id`, `label`, and `mode` describe the adapter.
- `derive(character)` is a pure function: it can propose statistics derived from
  a sheet read as immutable. The result is separated from manual values.
- The only available adapter, `generic`, returns no derivation.
  An unknown identifier uses the same manual behavior.

To add a future adapter, explicit system requirements are needed,
source licensing, formula testing, and local registration in the resolver.
Do not introduce silent replacements of saved values or rest/consumption
automations. The only approved network exception is the SRD catalog below,
explicitly initiated by the user. Persistence validation in Rust
remains mandatory even with a frontend adapter.

Known/prepared markers are independent. They do not consume resources when
they change and do not verify class, level, or preparation requirements. Resources and
slots are configurable sheet counters; PF and counters use integers
from zero to the chosen maximum, within the technical limit of one million.

The first version handles one character per campaign. Its UUIDs and those
of statistics/resources remain stable during changes. Any multi-character
extensions must migrate the constraint, preserving properties and references.

## Sheet inspired by user reference

The four pages of the PDF guide the combat fields, identity/skills,
equipment/values, and magic. No logo, graphics, or personal texts are copied.
“Add D&D fields 2014” only adds the missing labels of six characteristics,
six saving throws, and eighteen skills; it preserves existing UUIDs and values. Modifiers,
proficiency/mastery, armor, initiative, hit dice, inspiration, death saves,
resistances, senses, weapons/ammo, biography, coins, and magic are manual.
“Add slots 1°–9°” inserts missing counters at zero; set the maximums yourself.
Free object placement; no weight sums, currency, or bonus application.

## D&D SRD Catalog 2014

- Source: [D&D 5e API](https://docs.dnd5eapi.co/introduction), fixed endpoint
  `https://www.dnd5eapi.co/api/2014/`. Public GET-only API, no account.
- [Languages](https://docs.dnd5eapi.co/reference/multilingual): actual verification of
  23 October 2026 on `/api/2014/locales`: fr-FR, pt-BR, ru; no Italian.
  Italian interface and API content in English; search for English names.
- Opening the catalog does not perform a network request. Search loads the index, and name and level
  filter locally; a click loads the detail. Update forces the online GET.
  The typed custom name is not sent: only category and SRD index.
- Timeout 10 seconds, 2 MiB/response, no credentials/redirect, CSP with a single
  remote host. Returned texts are React text, without executed remote HTML.
- Rust validates and persists responses in SQLite, with a maximum of 150 entries. Local copies
  show date and provenance; failed update falls back to the available copy
  with a warning. An entry never consulted requires a connection.
- “Use this data in the module” proposes a spell: name, level, school,
  time, duration, range, components, materials, higher-level text,
rituals and concentration. Then Save voice. Known/prepared remain manuals.
- From a custom spell you can search for the same name or change it in the
catalog. Using a result explicitly replaces fields; preserves notes,
markers, and module links. You can rename and modify the result.
No automatic search/rewriting and no homebrew loading in the API.
- Saved spells are independent copies from the cache. The original reference
`catalogSource` remains after changes; campaign provenance and
SRD source are distinct and do not create factual arcs in the graph.
- Additive and default 006 migration for JSON M5. Backup includes new fields,
spells, and cache, preserving the `.nodex` format; to read them, schema
006 or later is required. Previous backups are still restorable.

## Sources and attribution

The catalog contains the SRD subset, not all commercial manuals.
The API code is MIT; the data is SRD material. SRD 5.1 is used under CC BY 4.0,
as permitted by the [Wizards](https://www.dndbeyond.com/srd) source and the
[SRD 5.1](https://media.dndbeyond.com/compendium-images/srd/5.1/SRD_CC_v5.1.pdf) preamble.
The app shows the prescribed attribution and the original reference in preview,
in the module and in the detail of imported copies. No catalog is included
in the source code; download is upon request. Changes are indicated as
editable personal copies. Do not confuse the software license with the data license.

Skills applied: PDF for visual reading/reference extraction; frontend-design
for coherent sections and hierarchy; vercel-react-best-practices for deferred loading
of the compendium and derived filters without requests on every key.

## Provenance of images and imported sheets

Oran's photographs are private references kept entirely in the
backups, not a ruleset. The transcription is partial and manual; doubtful values and
missing ones must be verified on the photos. No commercial formula or description
is reconstructed. Personal spells remain editable
with explicit SRD search available; the Logseq conversion does not send data
to the API and does not create facts in the graph.


## Multi-source Wiki and future AI

D&D Wiki uses Open5e v2 for explicit consultation with source/edition/licenses.
It does not convert a rules description into a campaign fact and does not
overwrite existing homebrew or SRD 2014 imports. Responses can
come from different publishers/editions: they remain separate entries, predominantly
in English. The cache is local, limited, and compressed in the 011 schema backup.
M7 is only planned: specific D&D model to be evaluated, retrieval on
selected sources, separate editions, and no formula applied automatically.
See docs/AI_LOCAL.md; no runtime or model has been executed.


### M10 — interface and source language

UI labels are localized; names/rules/imports, edition, and provenance
remain original. Do not translate API queries, identifiers, or persisted values of the
presets to change language. Choices, drafts, and limits: I18N.md.
