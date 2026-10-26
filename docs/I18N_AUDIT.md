# Interface localization audit — 26 October 2026

## Result: incomplete localization; release gate fails

The former `i18n:check` checked normalization and existing translations but did not
reject missing UI translations. It could pass while new screens fell back to English.
The strict audit now reports this as a failure, without rewriting catalogs or reading
campaign data. CI and the signed-release wrapper run the gate; the wrapper was tested
to stop before opening signing files or building an installer.

The audited scope is **1,303 distinct static interface messages**, extracted from
literal `tr(...)`, `Text source=...` and `localizeLabels(...)` calls/props in production
frontend files. Tests, campaign text, CSS, SQL and raw scanner candidates are excluded.
Seconds (`s`) and canonical dice notation (`d`) remain invariant symbols.

| Finding | Before corrections | After corrections |
| --- | ---: | ---: |
| Unregistered explicit UI sources | 15 (including the two invariant symbols) | 0 |
| UI parameter mismatches | 0 | 0 |
| Italian UI messages without translation | 64 | 0 |
| German UI messages without translation | 268 | 267 |
| French UI messages without translation | 268 | 267 |
| Spanish UI messages without translation | 268 | 267 |
| Brazilian Portuguese UI messages without translation | 268 | 267 |
| Japanese UI messages without translation | 268 | 267 |
| Korean UI messages without translation | 268 | 267 |
| Simplified Chinese UI messages without translation | 268 | 267 |
| Arabic UI messages without translation | 268 | 267 |

## Corrections made

- Added/reviewed 95 Italian translations for sharing, synchronization/save status,
  private replication, account/campaign deletion, downloads and visible errors.
- Registered short labels the old scanner missed. Corrected remaining Italian source
  fragments in training, graph and character-sheet views to English. Added these
  labels and server role display names in all nine translation catalogs.
- Updated the revised "every startup" herald preference in all nine translations;
  the previous hotfix had updated English and Italian only.
- Fixed combat controls/summary disappearing when the section title is translated:
  the UI now uses the stable `armorClass` field key, not an English title comparison.
  The Italian regression failed before the fix and passes afterward. The raw negative
  inspiration value now uses the existing localized `No` label.
- Render canonical `owner`/`player`/`reader` values through localized display labels.
  Protocol values, campaign contents, names, archive identifiers and saved locale
  choices remain unchanged. Unknown role values remain inert original text.

These are source changes following public release 0.9.2; they have not been packaged
or published as a new app release. No claim of fully localized UI is made.

## Remaining blockers

The 267 missing messages are the same set in the eight non-Italian translations.
Main affected files include CampaignSharing (69), AI component setup (52), backup
settings (40), update settings (33), sharing account settings (33), and save-state
badge (12). Counts by file overlap and must not be summed as a global total.

The Windows NSIS installer is configured for **Italian only**. English, German,
French, Spanish, PortugueseBR, Japanese, Korean, SimpChinese and Arabic are not enabled.
The audit reports this separately; branding is not localization. Enabling languages
still requires a new build and native language/layout verification, not only a JSON edit.

Full candidate-catalog gaps are 13 for Italian and 694 for each other translation.
Those totals also include non-UI scanner candidates (for example CSS, synthetic
fixtures, model prompts/sentinels and legacy backup folder names); they are not an
exact count of visible untranslated messages. Do not translate stored campaign text,
model-source content or compatibility folder names to make these totals smaller.

## Executed checks and limits

- Scanner/audit regressions: 7 passed, including missing translations, short labels,
  parameters, installer languages, real CLI exit status and read-only catalogs.
- Frontend suite: 182 passed; targeted catalog/sharing/update tests: 31 passed.
- English/Italian component verification covers destructive account confirmation;
  all nine translations cover the new startup label and controlled role names.
- TypeScript, ESLint, Vite build and catalog normalization: passed.
- React Doctor changed scope: no diagnostics; score 83 before and after the combat
  regression fix. The older score 88 covered a different file set.
- Changed-file Prettier: passed. Full repository format check: failed on 78 unchanged
  files (none in this change); unrelated files were not reformatted.
- `i18n:check`: **failed (exit 1)** for the documented remaining eight-language and
  native-installer gaps. The release wrapper correctly stops on that failure.
- Not run: fresh native WebView/RTL/long-label inspection for this audit, native
  linguistic review, installer compilation/installation, Rust tests (no Rust change).

Run `pnpm i18n:audit` for the summary or `node scripts/i18n/audit.mjs --json` for every
missing message and its source files. The audit is a mandatory gate, not a certificate
for dynamic/raw JSX strings, semantic translation quality, layout or native rendering;
those require the per-change manual review in I18N.md and AGENTS.md.
