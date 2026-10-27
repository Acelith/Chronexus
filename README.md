<div align="center">

<img src="assets/brand/chronexus-wordmark.webp" alt="Chronexus" width="520">

**The tabletop player’s journal: offline, private, everything connected.**

Write session notes, keep your character sheet and find out who gave you that key,
in which session and for which faction, with no account and no cloud.

[![Release](https://img.shields.io/gitea/v/release/acelith/Chronexus?gitea_url=https%3A%2F%2Fgithub.com&label=release&color=6c302b)](https://github.com/Acelith/Chronexus/releases)
[![License](https://img.shields.io/badge/license-Apache--2.0-354b3e)](LICENSE)
[![Platform](https://img.shields.io/badge/Windows-x64-241e17)](#download-and-installation)
[![Offline](https://img.shields.io/badge/data-local%20only-b89b60)](#privacy-and-data)
[![Languages](https://img.shields.io/badge/languages-10%20%2B%20scripts-354b3e)](docs/I18N.md)

[Download](#download-and-installation) · [Features](#features) · [Play together](#play-together-chronexus-server-optional) · [Wiki](https://github.com/Acelith/Chronexus/wiki) · [Guide](docs/GUIDE.md) · [Roadmap](ROADMAP.md) · [Italiano](README.it.md)

<img src="docs/media/hero.webp" alt="Session journal with notes, character mentions and the herald logo in the sidebar" width="900">

</div>

> [!NOTE]
> Latest release: **[0.9.2](https://github.com/Acelith/Chronexus/releases/tag/v0.9.2)** (Windows x64): a Chronexus-branded installer, including the fixes for legacy backup verification and update checks at every launch.
> If an older updater reports an unexpected database structure, use the 0.9.2 installer manually after preserving a verified backup. Existing archives migrate automatically.
> Other platforms are not built for this hotfix.

> [!IMPORTANT]
> **Chronexus is entirely vibecoded.** Its code, tests and documentation were written by
> AI coding agents (OpenAI Codex and Claude Code) following my instructions, not by hand.
> I made it purely for a personal need, as a player who wanted this tool, and out of
> curiosity about how far AI agents can be pushed in real software development. There is
> no company and no commercial goal behind it. If you prefer to avoid AI-generated
> software, consider this a fair heads-up. The in-app assistant is a separate, optional
> feature: it is off by default and the app works fully without it.

## What is Chronexus

Chronexus is a desktop app for people who **play** a role-playing campaign, not for
the game master. It keeps session notes, pages about characters, places and
factions, the character sheet, inventory and spells in one local archive, linked
with stable references. The interface defaults to English and offers 10 languages. Italian remains available, and existing language choices are preserved.

## Why Chronexus

- **The player’s point of view.** What your character knows, suspects or was told:
  no GM secrets, no invented facts.
- **A mention is not a fact.** Naming two characters in one note does not make them
  allies: you declare relationships yourself, with source and certainty
  (confirmed, suspected, disproven, unknown).
- **Your data stays yours.** Local database, full `.nodex` backups, no account, no
  telemetry.
- **Built for the table.** Autosave, keyboard shortcuts, dice roller and sheet one
  click away during play.

## Features

| | Feature | In short |
| --- | --- | --- |
| <img src="docs/media/icons/book.svg" alt="" width="24"> | **Session journal** | Visual and Markdown editor, autosave, `[[Name]]` mentions whose links survive renames |
| <img src="docs/media/icons/books.svg" alt="" width="24"> | **Codex** | Pages for NPCs, places, factions, quests and items, with aliases, images and backlinks |
| <img src="docs/media/icons/graph.svg" alt="" width="24"> | **Knowledge graph** | Mentions and declared relationships kept apart, filters by type, certainty and session, back to the source |
| <img src="docs/media/icons/helmet.svg" alt="" width="24"> | **Sheet, inventory and abilities** | Generic or D&D 5e 2014 manual sheet, item provenance, spells and slots without hidden formulas |
| <img src="docs/media/icons/dice.svg" alt="" width="24"> | **Dice roller** | Mixed d4–d100 rolls, per-campaign history, animated dragon circle with reduced motion |
| <img src="docs/media/icons/scroll.svg" alt="" width="24"> | **Search** | Full text across notes, pages, sheet and items, opening the matching block (Ctrl/⌘ + K) |
| <img src="docs/media/icons/wiki.svg" alt="" width="24"> | **D&D wiki** | Wikidot or Open5e on request, offline copies, local translation into the app language |
| <img src="docs/media/icons/star.svg" alt="" width="24"> | **Local assistant (optional)** | Questions about your notes with citations, on the GPU and without cloud, using Qwen3.8-27B or Gemma 4 12B |
| <img src="docs/media/icons/document.svg" alt="" width="24"> | **Languages and scripts** | 10 languages, right-to-left Arabic, Braille, Morse, Espruar, Dethek and more |
| <img src="docs/media/icons/backup.svg" alt="" width="24"> | **Signed updates** | Check, verified download and mandatory backup before install, announced by the herald |
| <img src="docs/media/icons/party.svg" alt="" width="24"> | **Shared campaigns (optional)** | With your own [Chronexus Server](#play-together-chronexus-server-optional): sync your devices and share chosen pages with your party |

<details>
<summary><strong>More screenshots</strong></summary>

<p align="center">
<img src="docs/media/graph.webp" alt="Graph with declared relationships and mentions between characters, places and factions" width="440">
<img src="docs/media/character.webp" alt="Character sheet with abilities, resources and inventory" width="440">
<img src="docs/media/dice.webp" alt="Dice roller with the dragon circle and roll history" width="440">
<img src="docs/media/herald.webp" alt="Herald announcement for a new version" width="440">
</p>

<sub>Screenshots from an invented sample campaign; the announcement shows a sample version.</sub>

</details>

## Download and installation

| Method | For | How |
| --- | --- | --- |
| **Windows x64 installer** | Everyone | Download `Chronexus_<version>_x64-setup.exe` from the [latest release](https://github.com/Acelith/Chronexus/releases) and run it |
| **In-app update** | Users of 0.4.0 or later | App settings → App updates |
| **From source** | Developers | See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) |

**Requirements:** Windows 10/11 x64 with WebView2 (already present on recent
versions). The optional assistant needs an NVIDIA GPU; **App settings → Local AI:
components** installs Ollama and the model without using a terminal.

**First run:** create a campaign, open a session and write. Type `[[` to link a
character or place, then explore **Codex** and **Graph**.

> [!WARNING]
> The installer has no Windows Authenticode signature, so SmartScreen may ask for
> confirmation. In-app updates are still verified with a dedicated cryptographic
> signature. No macOS, Linux or ARM64 packages are included in release 0.9.2;
> installation and upgrade of this Windows installer have not been tested.

## Updates and backups

- **Backup and restore** writes a `.nodex` file with every campaign and image,
  verified with SHA-256; restoring shows a preview and keeps a safety copy of the
  current data.
- **Periodic backups** (App settings → Backup, off until you enable them): daily,
  weekly or every N hours, only while the app is open and idle, into
  `Documents/Chronexus/Backup periodici` or a folder you pick. Chronexus keeps the
  number of copies you choose and deletes only periodic copies it created and
  registered.
- Before every update Chronexus creates and verifies a full backup in
  `Documents/Chronexus/Backup aggiornamenti` (or the data folder, with a notice, when
  Documents is unusable): if it fails, the installation stops.
- The herald announces new versions after a light startup check you can turn off.
  Installation starts only after you confirm.

> [!IMPORTANT]
> `.nodex` backups are not encrypted. Keep them somewhere safe, especially if the
> folder is synced to a cloud service.

## Local assistant

Optional and off until you enable it for a campaign. It answers using only that
campaign’s notes and the wiki entries you approve, with citations you can reopen.
It runs on the GPU through Ollama with cloud disabled and never changes notes,
relationships or the sheet.

> [!NOTE]
> Qwen3.8-27B and Gemma 4 12B are multilingual models, **not** trained on D&D: a
> valid citation does not guarantee a correct answer. Details in
> [docs/AI_MODELS.md](docs/AI_MODELS.md).

## Play together: Chronexus Server (optional)

Chronexus is complete on its own. When your group wants more, the companion
**[Chronexus Server](https://github.com/Acelith/Chronexus-Server)** is a small service that **you host**
(a home server, a NAS or a cheap VPS, with Docker Compose):

- **Your campaign on every device.** Turn on synchronization for a campaign and
  each autosave also reaches your server. Offline edits wait and resume later.
- **Share only what you choose.** Every page, session, relationship, party member,
  sheet section or image stays private until you share it. Your party sees it
  read-only, with your name, its source and its certainty: a shared claim never
  becomes a campaign fact.
- **Real conflicts, no silent overwrites.** If two people edit the same item, both
  versions stay visible and you decide.
- **Invitation-only accounts on your own infrastructure.** Roles (owner, player,
  reader), revocable devices, verified server backups and recovery.

Connect from **App settings → Campaign sharing**, then pick what to share from each
campaign's **Sharing** view. Without a server nothing changes: no account, no
network, everything stays local.

> [!NOTE]
> The server is in active development: its features are implemented and tested in
> source, but **no server release has been published yet**; you can build it with
> Docker Compose by following the
> [installation guide](https://github.com/Acelith/Chronexus-Server/blob/main/docs/INSTALLATION.md).
> Data is protected by HTTPS but is **not end-to-end encrypted**: the server
> operator can read what you upload. Android access is planned.

## Privacy and data

- No account, no telemetry, no campaign uploads, unless you connect your own
  Chronexus Server and choose what to send to it.
- Network requests start from your click (wiki, SRD catalog, updates, AI
  components) or from the startup update check, which only contacts the release
  channel and can be turned off.
- Wiki requests contain only the term or page you look up.

## Roadmap

Delivered and open milestones, plus limits still to verify, are in
[ROADMAP.md](ROADMAP.md); detailed status and the checks actually run in
[docs/STATUS.md](docs/STATUS.md).

## Development and contributing

The **[wiki](https://github.com/Acelith/Chronexus/wiki)** explains every area of the app for players and has a developer
section (architecture, data, sync, i18n, builds, QA, releases); its sources are in
[docs/wiki](docs/wiki).

Chronexus is built with Tauri 2, Rust, React and TypeScript on local SQLite.
Prerequisites, commands and checks are in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md);
project rules in [AGENTS.md](AGENTS.md). Reports and ideas are welcome in the
[issues](https://github.com/Acelith/Chronexus/issues).

## Credits and licenses

- Chronexus code: **Apache-2.0**, see [LICENSE](LICENSE).
- Fonts EB Garamond, Cinzel, Noto, Monocraft, Espruar and Dethek: SIL Open Font
  License, texts in [assets/fonts](assets/fonts).
- SRD 5.1 catalog by Wizards of the Coast via the D&D 5e API, under CC BY 4.0;
  Open5e wiki with per-document licenses; dnd5e.wikidot.com pages under the license
  each page declares. No catalog is bundled with the app.
- Logo, herald and dragon artwork: original project assets, see
  [assets/brand](assets/brand/README.md) and [assets/dice](assets/dice/README.md).

<div align="center">

<img src="assets/brand/chronexus-icon.webp" alt="" width="72">

*People, places, ideas. Everything is connected.*

</div>
