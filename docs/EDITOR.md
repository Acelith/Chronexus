# Notes: Visual and Markdown

In the always visible bar, **Visual** and **Markdown** open the same document.
Visual changes are saved automatically; **Save now** forces the save.
In the source, **Apply and return to visual** converts the draft. **Save now**, view/campaign
change, and normal closing also apply and save the Markdown. An error
keeps the draft open and blocks navigation. **Discard Markdown changes**
only discards source changes that have not yet been applied.

With the mouse, you can select 1–3 titles, text, quotes, bulleted,
numbered lists, and tasks; use bold, italic, underline, strikethrough, inline code,
highlighting, alignment, undo/redo, and links. The **Link page** selector
inserts a real entry from the Codex; the `[[` shortcut also remains.

In Markdown, internal links take the form `[Nome](chronexus://page/UUID)`.
The name can change without changing the destination. The converter temporarily
uses a reserved hostname `.invalid` because the library filters custom schemes;
it does not open it and does not make requests. It reports the UUID in the structured document.
Blocks that remained unchanged maintain ID, colors, underlining, and alignment.
Blocks modified in the source follow the formats representable in Markdown:
the source may result in being modified or no longer available, as with other changes
to the document; evidence already recorded in the relations remains preserved.

Tables, code blocks, HTML, Markdown images, separators, and link definitions do not
belong to the notes schema and are rejected before conversion. For images and maps,
the gallery already included in the backups is used.
Full compatibility with Word or with every Markdown dialect is not declared.
The persisted document remains JSON version 1, SQLite schema 014; no migration.

## Repeatable Windows Testing

Use a debug executable with Vite on port 1420. Before starting, set
`NODEX_DEV_DATA_DIR` and `WEBVIEW2_USER_DATA_FOLDER` to absolute empty folders under
`.tools/` and `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223`.
Do not use your own data profile or the release executable for these tests.

Set `$env:CHRONEXUS_UI_QA='isolated'`, then run
`node scripts/qa/gui-editor.mjs check`. The command accepts only an empty archive
or the single synthetic campaign `Collaudo GUI e Markdown`; check editor, source,
link/ID, visual formats, errors, windows, and scrolling. Close the app normally,
restart it with the same folders, then run
`node scripts/qa/gui-editor.mjs restart` to verify the data after restart.
Reports and screenshots remain in `.tools/ui-refresh/`, ignored by Git.

Skills applied: react-testing for regression coverage, systematic-debugging
for observed URL conversion and layout defects, react-doctor for diagnosis.
