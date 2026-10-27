# Getting started

## Install

| System | Package | Notes |
| --- | --- | --- |
| Windows 10/11 x64 | `Chronexus_0.11.0_x64-setup.exe` from the [0.11.0 release](https://github.com/Acelith/Chronexus/releases/tag/v0.11.0) | Needs WebView2 (present on recent Windows). This release is also offered by the in-app updater. |
| macOS (Apple Silicon / Intel) | `Chronexus_0.10.1_aarch64.dmg` / `_x64.dmg` from the [0.10.1 pre-release](https://github.com/Acelith/Chronexus/releases/tag/v0.10.1) | Open the DMG and drag Chronexus to Applications. |
| Linux ARM64 | `Chronexus_0.10.1_arm64.deb` or `Chronexus_0.10.1_aarch64.AppImage` | `sudo apt install ./Chronexus_0.10.1_arm64.deb`, or make the AppImage executable. |
| Linux x64 | `Chronexus_0.10.1_amd64.deb` | `sudo apt install ./Chronexus_0.10.1_amd64.deb`. |
| Windows ARM64 | — | Not available yet; build from source, see [Build and test](Build-and-Test.md). |

Check a download against `SHA256SUMS.txt` in the same release, for example
`shasum -a 256 Chronexus_0.10.1_aarch64.dmg` on macOS or `sha256sum …` on Linux. The 0.10.1
pre-release has no signatures and is not offered by the in-app updater.
For the Windows 0.11.0 installer, compare its SHA-256 with the hash in the release
notes. The in-app updater checks its dedicated signature before installation.

Chronexus is free and the project pays for no code-signing certificate. The first time
you start it:

- **Windows** may show *"Windows protected your PC"* (SmartScreen). Choose *More info →
  Run anyway*.
- **macOS** may say the app *"cannot be opened because the developer cannot be
  verified"* (Gatekeeper). Right-click the app → *Open* → *Open*.

Updates installed from inside the app are still checked with Chronexus's own
cryptographic signature (see [Updates](Updates.md)).

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
