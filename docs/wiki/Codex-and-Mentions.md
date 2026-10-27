# Codex and mentions

The **Codex** is your encyclopedia of the campaign as your character knows it: one page
per character, place, faction, quest, item, event, piece of knowledge or free note.

## Pages

Each page has a **type**, a **title**, optional **aliases** (other names the same thing
goes by), a **draft / active** status and its own notes, written with the same editor as
the sessions. Pages can carry [images](Images).

When you rename a page, the old title is kept as an alias, so older notes still find it.

## Mentions: the `[[` menu

1. In any note, type `[[` and the first letters of a name.
2. Pick an existing page, or **Create draft** to make a new page on the spot.
3. The name becomes a link. Behind it Chronexus stores the page's permanent identity, not
   its name: renaming the page never breaks the link.

Typing `[[Name]]` by hand stays plain text until you choose a result — Chronexus never
guesses which page you meant.

- **Ambiguous names.** If two pages share an alias, both are offered; you choose.
- **Missing pages.** A link whose page no longer exists is shown as missing, and you can
  recreate it explicitly as a draft with the same identity.

## Backlinks

Every page lists **where it is mentioned**: grouped by session or page, with a preview of
the paragraph. Opening a backlink jumps to that exact paragraph and highlights it.

## What a mention means — and what it doesn't

A mention only says *this page is named in this note*. It does **not** say the two things
are related. To record "Varek works for the Guild", declare a relationship in the
[graph](Graph-and-Relationships).
