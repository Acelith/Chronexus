# Chronexus wiki

Chronexus is a desktop journal for people who **play** a tabletop role-playing campaign —
not for the game master. It keeps your session notes, pages about the people, places and
factions you meet, your character sheet and the things you carry in one local archive on
your computer, linked together so you can always find out *who told you what, in which
session*.

This wiki has two parts:

- **Using Chronexus** — what every area of the app does and how to use it. No code.
- **For developers** — how the code is organised, how to build, test and release it.

The optional companion server has its own wiki in the
[Chronexus Server repository](https://github.com/Acelith/Chronexus-Server/wiki).

## Using Chronexus

| Page | What you learn |
| --- | --- |
| [Getting started](Getting-Started) | Install, first campaign, first session, the main screen |
| [Session journal](Session-Journal) | Writing notes, autosave, the editor |
| [Codex and mentions](Codex-and-Mentions) | Pages for characters, places, factions; `[[` links and backlinks |
| [Graph and relationships](Graph-and-Relationships) | Seeing connections; why a mention is not a fact |
| [Character sheet](Character-Sheet) | Sheet, resources, inventory, abilities and spells |
| [Party](Party) | The other characters at the table and what you know about them |
| [Dice roller](Dice-Roller) | Rolling and history |
| [Search and summary](Search-and-Summary) | Finding anything; the campaign summary |
| [Rules wiki and SRD catalog](Rules-Wiki-and-SRD) | Looking up spells and rules online, offline copies, translation |
| [Images](Images) | Portraits, maps and references |
| [Local assistant](Local-Assistant) | Optional questions about your notes, on your own GPU |
| [Languages and scripts](Languages-and-Scripts) | Ten languages, right-to-left, Braille, Morse and fantasy scripts |
| [Backups and restore](Backups-and-Restore) | Manual and periodic backups, restoring, exporting |
| [Updates](Updates) | The herald, verified updates and the mandatory backup |
| [Sharing with a server](Sharing-with-a-Server) | Your campaign on several computers, sharing with your party |
| [Privacy and data](Privacy-and-Data) | What stays on your computer and what can leave it |
| [FAQ and troubleshooting](FAQ-and-Troubleshooting) | Common questions and problems |

## For developers

Start at [Developer home](Developer-Home).

## Principles in one minute

- **Your data stays yours.** One local database, no account, no telemetry. Nothing leaves
  your computer unless you press a button that says so.
- **A mention is not a fact.** Naming two characters in one note never makes them allies.
  Relationships are declared by you, with a source and a certainty.
- **The player's point of view.** No game-master secrets and no invented facts — not
  even from the optional assistant.
- **No silent changes.** Saves are visible, conflicts show both versions, and nothing is
  overwritten, consumed or deleted without your confirmation.
