# M18 Update

Translator `wiki-translation-v2`: Qwen3.8-27B primary, Gemma secondary
explicit. Old v1 copies remain valid data in backups; they are not
reused as results of the new model. Changing the model does not
automatically generate a translation: the button is required. The derived cache keeps
a copy per entry/language; a new translation can only replace this
copy, never the original. All translations remain drafts to be verified.

# Local wiki translation — M17

Open an entry in **D&D Wiki**, then press **Translate to [app language]**.
The language is changed in the general settings. Wikidot and Open5e maintain
original search and identifiers: this function translates the open entry,
not an entire catalog or the search terms.

The first translation requires Ollama started with `OLLAMA_NO_CLOUD=1`, the
local model `qwen3.8:27b-q4_K_M` already installed, and an available GPU. From the
**Model for translation** selector, you can explicitly choose **Gemma 4 12B · Secondary**.
The 27B uses GPU and RAM together on the qualified system. Chronexus does not
start the runtime and does not download weights. If these requirements are missing, it shows an error
and leaves the original readable. Already saved translations are read without a model
or network, as long as the original is still in the cache and has not changed.

## Quality and original

Translations are **automatic drafts**, not official rule translations.
Names and technical terms may be imprecise: always compare with the original,
available with **Show original**. Source, edition, license, UA/homebrew origin
and original title remain visible; no equivalence between editions is inferred.
Checks reject incomplete responses and altered numerical sequences, but do not
certify negations, units, terminology, or rule interpretation.

Natural languages of the app are available. English preserves the original;
Ticinese requires native speaker revision like the M10 catalogs. Klingon and
Romulan declare fallback; Morse, Braille, SGA, Espruar, and Dethek remain
interface scripts and not destinations for rule translations.

Spell importing continues to use original data, opening the
existing editable module. No translation rewrites saved spells,
notes, sheets, quotes, or campaign knowledge.

## Technical boundaries

- Rust only reads entries already consulted from M16/Open5e caches. The command does not
  accept free text, URLs, prompts, or campaign content. The only optional model
  is one of the two qualified base identities in `src/ai-models.json`;
  no adapter, arbitrary model, or automatic fallback.
- Fixed `127.0.0.1:11434` connection, no proxy/redirect; existing cloud checks
  disabled and GGUF format. Approved Qwen weights SHA-256
  `f5f1dd8920d417aac2718b0bda3403da274301efdd6760b4f0f4b864ff2ad57d`.
  Gemma digest and qualification in [AI_MODELS.md](AI_MODELS.md).
  Current wrapper identity registered in the copy; GPU preflight before text.
- No campaign retrieval or adapter, training, tool, or model history.
  Wiki text as untrusted data; result is always inert React text.
- A single AI operation at a time with the shared assistant/training
  and updater block. Cancellation, abandoning the view, and changing language discard responses.
- Limits: 24.000 bytes of text, 500 fragments, batch of 1.800 bytes, 2.048 tokens
  of output per batch, 240 total seconds. Pages that are too long remain original;
no partial translations saved or automatic attempts.

## Cache and backup

Additive migration 017: `wiki_translations` in the same SQLite Store. Key
provider/item/language, hash of the complete original content and revision of the
translator, model/digest and date. Maximum 100 copies of 256 KiB, independent
of campaigns and AI settings. They are not sources for the integrated assistant.

The confirmation of deleting the M16 wiki cache also includes the translations
of the chosen provider. No preference, import, or campaign is deleted.
Before writing, hashes, cache epoch, restoration generation and
language are re-checked: results that have become obsolete are discarded.

The 017 backups include and validate the translated copies. Previous backups remain
restorable and are migrated; a previous build does not open a 017 schema.
Keep previous backups at the update, without automatic downgrades.
M18 remains a subsequent separate qualification of the replacement model.
