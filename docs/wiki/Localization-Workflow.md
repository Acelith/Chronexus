# Localization workflow

English is the source and fallback; nine more catalogs ship with the app. **Every
interface change** — labels, tooltips, accessible names, empty/error/confirmation
states, backend messages shown in the UI, installer screens — must be checked in all ten
languages before it is complete.

1. Use `tr("English text", [params])` (or `Text`/`Label`, `localizeLabels`) — never
   translate campaign content, enum values or IDs.
2. Add the English source and the nine translations to `src/i18n/catalogs/*.json`. New
   IDs are `m_` + the first 12 hex digits of the SHA-256 of the English source. Keep
   `{0}`-style parameters identical. German uses the informal *du*.
3. Run `pnpm i18n:check`. It must exit 0: no unregistered UI sources, no missing
   translations, no parameter mismatches, all installer languages present.
4. Look at the changed views in English, Italian and any affected locale; check long
   labels and Arabic right-to-left.

Copying English into another catalog to pass the check is not allowed. Details:
`docs/I18N.md`.
