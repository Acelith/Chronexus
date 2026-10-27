# Getting started

## Install

| System | Package | Notes |
| --- | --- | --- |
| Windows 10/11 | `Chronexus_<version>_x64-setup.exe` from the [releases](https://github.com/Acelith/Chronexus/releases) | Needs WebView2 (present on recent Windows). |
| macOS, Linux, ARM64 | — | Packages for these systems are planned (roadmap M29); until then build from source, see [Build and test](Build-and-Test). |

Chronexus is free and the project pays for no code-signing certificate. The first time
you start it:

- **Windows** may show *"Windows protected your PC"* (SmartScreen). Choose *More info →
  Run anyway*.
- **macOS** may say the app *"cannot be opened because the developer cannot be
  verified"* (Gatekeeper). Right-click the app → *Open* → *Open*.

Updates installed from inside the app are still checked with Chronexus's own
cryptographic signature (see [Updates](Updates)).

## The main screen

- **Left menu** — your campaigns and, for the open campaign, its areas: Summary, Sessions,
  Codex, Graph, Character, Party, Dice roller, Search, Sharing and, if you enabled it, the
  Local assistant. **App settings** and **Backup and restore** are at the bottom.
- **Centre** — the area you opened.
- **Header** — the campaign name and, if the campaign is synchronized with a server, a
  small save indicator that tells you whether your last change is only on this computer
  or also on the server.

## Your first five minutes

1. **Create a campaign.** Give it a name; you can rename it later.
2. **Create a session** (Ctrl/⌘ + Shift + N). Give it a number and a title; the real date
   is optional.
3. **Write.** Notes save themselves half a second after you stop typing.
4. **Link a character or place:** type `[[`, start typing the name and choose an existing
   page or *Create draft*. The link survives renames.
5. Open **Codex** to see the page you created and **Graph** to see the connection.

## What Chronexus will never do on its own

- Send your notes anywhere.
- Turn a mention into a "fact" about your world.
- Consume hit points, spell slots or resources for you.
- Overwrite a change you made somewhere else.
- Delete something without asking.
