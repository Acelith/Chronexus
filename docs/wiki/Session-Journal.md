# Session journal

A **session** is one evening (or afternoon) of play. Sessions are ordered by their number
and have a title and an optional real-world date. Two sessions of the same campaign cannot
share a number.

## Writing

The editor works with **blocks**: paragraphs, headings, lists, checklists, quotes, bold and
italics. Type `/` to see every block type. A Markdown view is available too.

- `[[` opens the link menu — see [Codex and mentions](Codex-and-Mentions.md).
- Every block has a stable identity, so search results, backlinks and item origins can
  open *exactly* the paragraph they come from.

## Saving

- Notes save automatically about half a second after you stop typing. The status line
  says *Saving…*, *Saved* or shows an error.
- **Save now** forces a save; after an error, Chronexus retries and keeps your text in the
  editor — it never throws away what you typed.
- Changing session, campaign or closing the app waits for the save to finish.
- Only one copy of Chronexus can open the same archive at a time. If the same note was
  changed elsewhere, the older write is refused instead of overwriting the newer one.

> **Tip.** If the computer loses power while you type, the last half-second may be lost.
> Wait for *Saved* before closing the lid on a long note.

## Session recap (next source build)

Campaign overview includes a **Session recap** section with the latest session,
open clues, items explicitly linked to that session and attributed relationships.
Use **Write recap** to create a persistent Codex note and edit it with the normal
saved editor. To pin an existing note here, add the alias `chronexus:recap-pin`.
The optional local AI action requires campaign AI to be enabled and returns an
unreviewed draft with source excerpts; it never writes notes automatically.

## Print and PDF (next source build)

In campaign overview, expand **Print and PDF**, select individual sessions or
Codex pages, and optionally the character sheet. Nothing is selected initially.
Preview the content before opening the system print dialog; choose its PDF
printer to save a file. The light layout prints only selected content, using
plain text for journal blocks. Images and rich block formatting are not included.
Equipment and spells currently print names, descriptions and notes. Native print
acceptance on the supported desktop platforms is still pending.
