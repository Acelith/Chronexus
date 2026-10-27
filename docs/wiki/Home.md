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
[Chronexus Server repository](https://github.com/Acelith/Chronexus-Server/blob/main/docs/wiki/Home.md).

## Using Chronexus

| Page | What you learn |
| --- | --- |
| [Getting started](Getting-Started.md) | Install, first campaign, first session, the main screen |
| [Session journal](Session-Journal.md) | Writing notes, autosave, the editor |
| [Codex and mentions](Codex-and-Mentions.md) | Pages for characters, places, factions; `[[` links and backlinks |
| [Graph and relationships](Graph-and-Relationships.md) | Seeing connections; why a mention is not a fact |
| [Clue board](Clue-Board.md) | Questions, leads, sources and resolution without inventing facts |
| [Character sheet](Character-Sheet.md) | Sheet, resources, inventory, abilities and spells |
| [Party](Party.md) | The other characters at the table and what you know about them |
| [Dice roller](Dice-Roller.md) | Rolling and history |
| [Search and summary](Search-and-Summary.md) | Finding anything; the campaign summary |
| [Rules wiki and SRD catalog](Rules-Wiki-and-SRD.md) | Looking up spells and rules online, offline copies, translation |
| [Images](Images.md) | Portraits, maps and references |
| [Local assistant](Local-Assistant.md) | Optional questions about your notes, on your own GPU |
| [Languages and scripts](Languages-and-Scripts.md) | Ten languages, right-to-left, Braille, Morse and fantasy scripts |
| [Backups and restore](Backups-and-Restore.md) | Manual and periodic backups, restoring, exporting |
| [Updates](Updates.md) | The herald, verified updates and the mandatory backup |
| [Sharing with a server](Sharing-with-a-Server.md) | Your campaign on several computers, sharing with your party |
| [Privacy and data](Privacy-and-Data.md) | What stays on your computer and what can leave it |
| [FAQ and troubleshooting](FAQ-and-Troubleshooting.md) | Common questions and problems |

## For developers

Start at [Developer home](Developer-Home.md).

## Principles in one minute

- **Your data stays yours.** One local database, no account, no telemetry. Nothing leaves
  your computer unless you press a button that says so.
- **A mention is not a fact.** Naming two characters in one note never makes them allies.
  Relationships are declared by you, with a source and a certainty.
- **The player's point of view.** No game-master secrets and no invented facts — not
  even from the optional assistant.
- **No silent changes.** Saves are visible, conflicts show both versions, and nothing is
  overwritten, consumed or deleted without your confirmation.
