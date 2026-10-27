# Public channel — 0.9.2

Current release: [0.9.2](https://github.com/Acelith/Chronexus/releases/tag/v0.9.2),
signed Windows x64 installer (schema 021). Production signature, anonymous downloads
and the public stable channel verified on 26 October 2026. Actual installation/upgrade
and other release targets remain unverified. No AI weights are included.

0.9.2 adds the Chronexus artwork to the Windows installer, preserving the standard
NSIS flow. Native welcome/directory pages were inspected and cancelled before install.

0.9.1 repairs false backup rejection from mixed Windows/Unix migration SQL layout.
Existing archives migrate automatically on open. An older running updater that fails
its backup cannot patch itself: preserve a verified backup and install 0.9.2 manually
with Chronexus closed. The mandatory verified backup is retained for future updates.
From 0.9.1 automatic update checks run once at every launch unless disabled; a recent
check no longer suppresses the next launch. Reminders and ignored versions remain.

From 0.8.0, backups before installation go into
`Documenti/Chronexus/Backup aggiornamenti` (see below).

# M18 — Local 0.7.0, public channel unchanged

Signed Windows updater package compiled and real signature verified. The user
asked to leave the publication after the rejection of the credentials of the
first push. No 0.7.0 release created, public channel still 0.6.0;
do not propose 0.7.0 as a published update. Details in INSTALLERS.md.

018 Schema: old Qwen choices disabled without loss of history,
citations, or Gemma adapters. Previous backups restorable. No model is
downloaded by the updater; prepare the 27B separately and activate it explicitly.
The signed M15 flow and the mandatory backup before installation remain
unchanged. The 0.6.0 checkpoint below is historical; personal installation not performed.

# Internal updates — M15

Current release: [0.6.0 — M17](https://github.com/Acelith/Chronexus/tree/v0.6.0),
signed Windows x64 installer and verified public channel. 017 Schema: pre-installation
backups also include the derived cache of wiki translations, without
changing the originals. Installed upgrade 0.5.0 → 0.6.0 not yet tested;
do not confuse signature/download verification with a real installation.

From Chronexus 0.4.0, **App Settings → App Updates** allows you to
check, download, and install a new version. The check is explicit:
no request at startup, no login, no submission of campaigns.
Previous versions require a first manual installation of the 0.4.0.

## Mandatory flow and backup

1. **Check updates** shows version and notes, or a useful error
   when the server is unreachable or the channel is not yet published.
2. **Download update** downloads only the app installer, with progress and
   cancellation. The cryptographic signature must match the embedded key
   and the announced version. An incomplete/tampered package is not installable.
3. **Create backup and install** creates and reads a `.nodex` of all campaigns,
   managed images/attachments, sources, and AI adapters included according to the existing backup
   format. Also saves a JSON receipt with SHA-256 and interface/update preferences.
   Failed backup or receipt **blocks** the installer.
4. On Windows, the official Tauri component starts NSIS in passive mode and
   closes the app. Reopen Chronexus upon completion. The bridge for external
   assistants is not implicitly reactivated. On other systems, restart is manual.

From M16, the receipt also includes `wikiPreferences` (wiki source choice), if saved.

From M19, backups are found in `Documenti/Chronexus/Backup aggiornamenti`, created
at the first update; the receipt also includes `backupPreferences`. If the
Documents do not exist, the folder is a symbolic link/junction or a file, or cannot
be created, the backup goes into the data folder, `update-backups` subfolder, with
a warning in the progress: the backup is never skipped and, if it fails even
there, the installer does not start. Backups already present in `update-backups` remain where
they are; **Backup and restore** lists them and offers a verified copy with SHA-256
in Documents without deleting the original. The path appears in the settings. They have unique names and are not
overwritten or automatically deleted. A new installation attempt creates
a new backup. Base/runtime AI weights remain installed separately and are not
redownloaded or duplicated in the backup. SQLite remains **015**.

The backup uses the same active Store and maintains the lock until delivery
to the installer; no second SQLite writer. Ongoing AI/training prevents
installation. Operations from the interface save the editor before starting.
The MCP connection does not expose update commands. Previous backups
remain available even when the installer startup fails.

To recover data, use **Backup and restore** and choose the `.nodex` before
the update. The adjacent JSON receipt separately preserves UI preferences;
the `.nodex` restore continues to maintain the current language. Do not copy an
open SQLite and do not attempt an automatic downgrade after future migrations.

## Public GitHub channel or your own HTTPS server

The default channel is anonymous and points to the stable release's manifest:

```text
https://github.com/Acelith/Chronexus/releases/latest/download/latest.json
```

Custom channels keep same-origin HTTPS redirects and package URLs. The fixed
Chronexus GitHub channel additionally allows GitHub's official release asset CDN
(`release-assets.githubusercontent.com`), including its short-lived signed query.
No credentials or campaign data are sent, and signed-version/package verification,
bounded downloads and mandatory pre-installation backups remain required. GitHub's
public release API for this repository is also accepted; previews stay excluded.
Only exact retired built-in channel fingerprints migrate; custom saved channels stay.
Historical packages predate this source migration and have not been rebuilt.

**25 Status October 2026:** [release 0.4.0 published](https://github.com/Acelith/Chronexus/tree/v0.4.0),
three attachments with anonymous downloads and verified SHA-256; latest API and
app checks working. The initial installer is available for manual bootstrap.

The repository was made public by the user: anonymous access verified with
HTTP 200 and `private:false`. At the time of the first check, no stable release
was found published (latest API 404); the public repository alone does not
create an update channel. Do not publish the old incomplete draft v0.2.0
to make an update appear. Publish the new release only after testing
on the signed installer and on anonymous downloads.

HTTPS with valid certificates are allowed, without credentials/queries/fragments,
and redirects on the same origin, maximum five. Maximum manifest 1 MB,
maximum installer 256 MiB; time-limited download, no automatic retry.
No authentication header is generated. An alternative server must use
the same signing key as Chronexus and also host the artifacts on its own
origin; replacing the URL with any package is not enough.

## Compile and publish signed updates

`tauri-plugin-updater ~2.14.0` is used with `requireSignedVersion:true`: the version
is included in the authenticated signature comment. The public key is in the config
Tauri. The private key is encrypted; the random password is protected by Windows
DPAPI for the account that created it. No secrets enter Git or the packages.

In this workspace, the protected pair is in `.tools/signing/` (ignored by Git):
`chronexus-update-protected.key`, relative `.pub` and `password.dpapi`. **Keep a secure copy and store the
password in a password manager**: DPAPI is
linked to account/machine, so copying only the blob to another PC does not
allow it to be recovered. Do not generate a new key at every build: those who have already
installed the app trust the embedded public one. The wrapper does not create,
rotate or recover keys and do not print the content.

```powershell
# Rust toolchain available on PATH; sign in memory, never put passwords in commands
./scripts/release/Build-SignedUpdate.ps1
```

Windows Output: `src-tauri/target/release/bundle/nsis/` with installer and `.exe.sig`.
The updater signature is not a Windows Authenticode signature. macOS/Linux require
build/own checks and the distribution signatures provided by the system.

Generate `latest.json` for the target actually built only:

```powershell
python scripts/release/updater_manifest.py --version 0.4.0 --target windows-x86_64 --artifact "installers/Chronexus-0.4.0-Windows-x64/Chronexus_0.4.0_x64-setup.exe" --signature "installers/Chronexus-0.4.0-Windows-x64/Chronexus_0.4.0_x64-setup.exe.sig" --base-url "https://github.com/Acelith/Chronexus/releases/download/v0.4.0" --notes docs/releases/v0.4.0.md --output "installers/Chronexus-0.4.0-Windows-x64/latest.json"
```

The generator does not replace existing files and does not publish anything. Verify the
signature of the real package with the dedicated integration test, normally
ignored because it requires local artifacts; then create the annotated tag of the source
compiled and a new draft release with installer, `.sig` and `latest.json`.
Before making it stable, verify download and hash; after publication
also verify anonymous URLs and the latest API. Do not overwrite tags or attachments.

```powershell
$env:CHRONEXUS_QA_UPDATE_MANIFEST = "PERCORSO_ASSOLUTO/latest.json"
$env:CHRONEXUS_QA_UPDATE_PACKAGE = "PERCORSO_ASSOLUTO/Chronexus_0.4.0_x64-setup.exe"
cargo test --manifest-path src-tauri/Cargo.toml --test updater_signature updates_signed_release_package_matches_production_key -- --ignored --exact
```

The CI can build unsigned packages for checks when it does not receive the
release secrets; such packages must not enter the updater channel.
The runner secrets are `TAURI_SIGNING_PRIVATE_KEY` and
`TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, never variables of the installed client.

## Checks and limits

Automatic tests: HTTPS/isolation, GitHub release discovery, size/nullification,
cryptographic and version checks, verified restorable backup with images,
installer block after backup error and preservation after installer error,
screen states and endpoint change. Synthetic Windows Desktop: settings,
version, HTTP error and ordinary closure. Evidence updated in STATUS.md.
A real update from a previous public version requires the first
signed release and a subsequent version; do not confuse these tests with a
public upgrade test already performed. macOS/Linux and application rollback are not
certified by these Windows tests.

Sources: [Updater Tauri](https://v2.tauri.app/plugin/updater/) and
[Forgejo routes 12.0.4](https://codeberg.org/forgejo/forgejo/src/tag/v12.0.4/routers/web/web.go).

Updater installers directly include the app license and the licenses/
provenance of fonts and public assets. They do not depend on an external ZIP to
keep them during subsequent updates.

### Resumable publication of the three updater attachments

After the cryptographic test of the real package, create the annotated tag `vVERSIONE`
on the `sourceCommit` of package-report.json and publish main/tag with ordinary Git.
The publisher checks clean tree, fixed origin, identity and permissions, version,
remote tag/commit, hash and absence of application changes after compilation.
Does not modify existing releases not recognized by its local receipt.

The publisher also runs the production-key signature test itself on the exact local
files and re-checks their hashes afterwards; without Cargo (or `CARGO` pointing to it)
it refuses to publish. Publication is **single-writer**: a `.publish.lock` in the
package folder blocks a second run on this machine, and the release is re-listed
before every upload, before and after finalizing, so a second publisher elsewhere
(two drafts for the tag, unknown or duplicate attachments) stops the run while the
release is still a draft. Run it from one machine only. The receipt records
`state`: `draft`, `publishing`, `public-unverified` or `published`. A failure after
the release became public says so explicitly; nothing is deleted, and `--finalize`
again retries only the public verification.

```powershell
# Write access already configured in Git for this exact repository;
# no scanning of credentials, files or variables of other services.
python scripts/release/publish_app_update.py installers/Chronexus-0.4.0-Windows-x64 --github-credentials
# After verifying all three attachments in the draft:
python scripts/release/publish_app_update.py installers/Chronexus-0.4.0-Windows-x64 --github-credentials --finalize
```

Without `--github-credentials`, the program requires a token in the terminal, without
echo/saving. GitHub CLI credentials are used only on api.github.com and uploads.github.com;
no token in the installed client. The local receipt contains only
ID, version, source and URL of attachments, and allows resumption without duplicating them.
Finalization also verifies anonymous downloads and latest API. Errors keep
local proofs; do not delete or overwrite the old M11 draft.


### M15a — herald announcement (from the next version to the 0.4.0)

About 6 seconds after startup, Chronexus performs a light automatic check:
one per session, only towards the channel configured here. From 0.9.1 a recent
check no longer suppresses the next launch; explicit opt-out remains respected.
It is disabled with **Check once at startup…**; the manual button remains.
If it finds a more recent compatible version, as soon as the app is idle, the
herald appears with the manifesto: **Update** opens this section and starts the verified download;
**Create backup and install** remains necessary. **Remind me later**
(or Escape) postpones that version for three days; **Ignore this version** prevents
further announcements for it. Disable the trumpet in the announcement or here.
Preferences are stored in `update-announcements.json` and included in the
pre-installation backup receipt. Testing: `scripts/qa/m15a-herald.mjs` (see docs/QA.md).
