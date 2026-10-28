# Release 0.12.0 — signed Windows x64 installer (M31)

NSIS Windows x64 installer compiled from commit `611343e` (annotated tag `v0.12.0`),
updater signed and verified with the production key
(`updates_signed_release_package_matches_production_key`). Size 34,368,477 bytes,
SHA-256 `9111985a3fab798e3315ad8c4e2bde6f973d3470c0254b0eabca27e59662dbb3`.
Published on 28 October 2026 with `publish_app_update.py`: installer, `.sig` and
`latest.json` verified as drafts and after publication with anonymous SHA-256
checks; latest = v0.12.0. App only, no AI weights. Built with a temporary
`pnpm.cmd` shim forwarding to `corepack pnpm`. The earlier unsigned local 0.12.0
build is superseded and was never published. **Not built or verified:** macOS,
Linux, ARM64, Authenticode, installation and upgrade of this installer.
See [release notes](releases/v0.12.0.md).

# Release 0.11.0 — signed Windows x64 installer

[Chronexus 0.11.0](https://github.com/Acelith/Chronexus/releases/tag/v0.11.0)
was published on 27 October 2026 from source `1deb700` and annotated tag
`v0.11.0`. The Windows x64 NSIS installer is 34,334,089 bytes, SHA-256
`a9d288c9f911b36672965f98c0a1495df81560329302fc9cb5726a64b573f7ae`.
The production updater signature on the exact package and tamper rejection passed.
Installer, signature and `latest.json` were verified in the draft, then downloaded
anonymously and checked after publication. The public stable API identifies 0.11.0.
Exactly three unique assets are present; no existing release asset was replaced.

This release includes the campaign's explicit local or server assistant choice and
German, French and Spanish catalog improvements since pre-release 0.10.1. Schema
remains 021. It has no AI weights or Windows Authenticode signature; SmartScreen
may warn. The exact installer was not installed or upgraded in QA. Windows ARM64,
macOS and Linux packages were not built for 0.11.0; the 0.10.1 packages remain
available for those systems. See [release notes](releases/v0.11.0.md) and the
current evidence in [STATUS.md](STATUS.md).

# Release 0.9.2 — Chronexus-branded Windows installer

[Chronexus 0.9.2](https://github.com/Acelith/Chronexus/releases/tag/v0.9.2), published
26 October 2026. Windows x64 NSIS, source `ad68875`, annotated tag `v0.9.2`.
Size 34,118,247 bytes; SHA-256
`11553df57cf6f4c75299fc2bc983d83b287a1a943619c363ea121ceb82098256`.
Production signature and tamper rejection passed. Installer, signature and manifest
were verified in the draft and redownloaded anonymously with matching SHA-256;
public latest API and canonical manifest identify 0.9.2. Exactly three unique assets.

The native wizard uses the approved herald/wordmark on a leather/brass/burgundy
sidebar and compact header; installer/uninstaller icons use the existing Chronexus
icon. Actual welcome and directory pages visually verified, then cancelled before
installation. Finish/uninstaller execution and actual installation/upgrade were not
performed. Standard Tauri NSIS template and passive updater behavior preserved.
Original artwork stays unchanged; provenance/regeneration: `assets/brand/README.md`.

Includes the 0.9.1 backup and startup-check fixes below; schema 021 and automatic
migrations unchanged. Users blocked by an older updater's backup error can manually
install 0.9.2 after preserving a verified backup and closing Chronexus. Windows x64
app only; no AI weights or Authenticode signature. Other release targets unverified.

# Release 0.9.1 — backup and startup update hotfix

[Download 0.9.1](https://github.com/Acelith/Chronexus/releases/tag/v0.9.1), published
26 October 2026. Windows x64 NSIS built from `f705438` (annotated tag `v0.9.1`),
33,909,745 bytes, SHA-256
`ea9cba017cff6eb27243547ec176fd7248e3ef27d061f16d79fd311cbf8d2998`.
Production updater signature/tamper rejection passed on the real package. All three
unique attachments were downloaded and SHA-256 verified anonymously; the canonical
manifest and public stable API identify 0.9.1. No existing release assets were changed.

Fixes false backup rejection caused by mixed CRLF/LF migration SQL. Schema remains
021; existing schema 018 archives automatically migrate on open. Verification of an
actual affected archive passed through backup, extracted-copy migration and a second
verified backup, without modifying its installed original. The herald checks once per
launch, respects opt-out/reminders, and is verified in an isolated native WebView.

**Manual bootstrap when the installed updater has this backup error:** preserve a
verified backup, close Chronexus and run the 0.9.1 installer. The older running updater
cannot repair its own backup code. Do not delete or edit the database and do not skip
the mandatory backup in future update flows. A local verified recovery backup was
created outside Git during the diagnosis. No automatic installer was run.

Windows x64 app only; no AI weights or Windows Authenticode signature. Other
platforms/architectures and actual installation/upgrade remain unverified.

# Building in containers — 27 October 2026

User instruction: Linux and Windows packages are built in dedicated Docker containers,
created when missing; macOS cannot run in a container (Docker shares a Linux kernel and the
Apple toolchain needs macOS), so it is built natively on a Mac.

| Image | Dockerfile | Produces |
| --- | --- | --- |
| `chronexus-linux-qa` | `scripts/qa/linux/Dockerfile` | `.deb` and AppImage for the host architecture; also runs debug/installed builds under Xvfb |
| `chronexus-windows-build` | `scripts/build/windows/Dockerfile` | NSIS installers for x86_64 and aarch64 Windows (cargo-xwin) |

Run `scripts/build/container-build.sh linux|windows` inside the image with the checkout
mounted read-only at `/src`, an output folder at `/out` and cargo caches in volumes. On an
Apple Silicon host the native Linux build is ARM64; x64 Linux needs `--platform
linux/amd64` (QEMU emulation, slow). cargo-xwin downloads the Microsoft CRT and Windows
SDK and accepts their licence; the user accepted it on 27 October 2026. Windows installers
built this way have no Authenticode signature and cannot be started on the Mac: their
installation remains unverified until run on Windows. Updater artifacts are never built in
a container because the signing key stays outside them.

## Results of 27 October 2026 (source 0.9.2 plus unreleased fixes; nothing published)

| Target | Built | Installed / started | Notes |
| --- | --- | --- | --- |
| macOS ARM64 | `.app` + DMG, natively | Installed from the DMG into `~/Applications`, started, created its archive | Ad-hoc signature now valid (`codesign --verify --deep --strict`) |
| macOS x64 | `.app` + DMG, cross-built natively | Not started (no Rosetta on this Mac) | Ad-hoc signature valid |
| Linux ARM64 | `.deb` + AppImage, in `chronexus-linux-qa` | `.deb` on Debian 12 and Ubuntu 24.04, AppImage on Debian 12, under Xvfb; release build signed in to the HTTPS test server and downloaded a synchronized campaign | AppImage needs the host's libgbm/ALSA (normal on desktops) |
| Linux x64 | `.deb` under QEMU emulation (`LINUX_BUNDLES=deb`) | Installed and started on Ubuntu 24.04 amd64 (emulated), screenshot checked | AppImage not built: linuxdeploy does not run under QEMU; build it on a native x64 host |
| Windows x64 | NSIS installer, in `chronexus-windows-build` | Not run (no Windows here) | Unsigned (no paid certificate) |
| Windows ARM64 | **Blocked** | — | `ring`'s ARM64 assembly gets clang-cl `/imsvc` flags; cargo-xwin's clang mode then breaks `aws-lc-sys` with clang 14. Needs a newer LLVM or a Windows ARM64 runner |

Fixes found by these builds: the macOS bundle had only the linker's signature, so
`codesign --verify` failed and a downloaded copy would be reported as damaged —
`bundle.macOS.signingIdentity` is now `"-"` (free ad-hoc signing); bookworm's NSIS 3.08 lacks
`Win\RestartManager.nsh`, so the Windows image takes NSIS 3.11 from trixie; on Linux the
campaign picker was unreadable (WebKitGTK painted the native light field under light text).

# Future build checklist — pending, 26 October 2026

Apply this checklist at the next authorized build/release. The user's current
request is documentation only: do not compile, install or publish now.

| Platform | x64 (64-bit Intel/AMD) | ARM64 (64-bit ARM) | Delivery priority |
| --- | --- | --- | --- |
| macOS | Pending | Pending | Build and publish both architectures |
| Windows | Pending | Pending | Build and publish both where feasible |
| Linux | Pending | Pending | Build and publish both where feasible |

- Extend the build/release tooling to cover this six-target matrix. This checklist
  does not mean that cross-platform packaging or CI is already implemented.
- For macOS, produce distinct x64 and ARM64 packages from the same release source;
  check platform dependencies, ad-hoc signing (no paid Developer ID or notarization,
  see ROADMAP M29) and native runtime
  compatibility for each architecture. Do not assume the Windows-only managed AI
  runtime or its packages work on other targets.
- For Windows and Linux, attempt both architectures when suitable toolchains,
  runners and dependencies are available. Record precise blockers for omitted
  targets; do not substitute an x64 package labelled ARM64 or claim unrun checks.
- Run relevant checks per target and record build, startup, installation/upgrade
  evidence and signing limitations separately. Preserve the M15 updater signature
  and backup guarantees; include only supported, signed artifacts in its channel.
- Publish verified packages to the existing GitHub origin with explicit OS and
  architecture labels, checksums and release notes. Verify downloaded assets;
  preserve existing releases/tags/assets and report partial delivery honestly.

This is a future distribution requirement under M11/M6, not a new completed
milestone. The next functional milestone remains M23, followed by M24 and M25.

# Release 0.9.0 — shared campaigns, English-first

NSIS Windows x64 installer compiled from commit `d88425e` (annotated tag `v0.9.0`),
updater signed and verified with the production key
(`updates_signed_release_package_matches_production_key`). Size 33,842,720 bytes,
SHA-256 `6c7dac0a369efc0b439430cdc0474ec47aaf589f8b5c7f6d4207307a566b394e`. Published on 26 October 2026 with `publish_app_update.py`: installer,
`.sig` and `latest.json` verified as drafts and after publication, with anonymous
SHA-256 checks. Concurrent publishers created duplicate attachments; after verifying
all six copies, the three duplicates were removed with user approval. The stable API
now exposes exactly three unique attachments and the canonical manifest checksum passes.
App only, no AI weights.
Built with a temporary `pnpm.cmd` shim that forwards to `npm run` (pnpm is not installed here).
**Not built or verified:** macOS, Linux, ARM64 (no toolchains here), installation and upgrade of the
installer. The companion server is released separately:
[Chronexus Server 0.1.0](https://github.com/Acelith/Chronexus-Server/releases/tag/v0.1.0)
(Windows x64 binary only; no container image, Docker was unavailable).

# Release 0.8.0 — M19, M20, M21, M22

NSIS Windows x64 Installer compiled from commit `c540c2d` (annotated tag `v0.8.0`),
updater signed and verified with the production key
(`updates_signed_release_package_matches_production_key`). Size 33.072.040
bytes, SHA-256 `0079f8b8509836e006ad42d37338212593c25b9719119b1e49f2961bbb4d6b3a`.
Published on October 25 2026 with `publish_app_update.py`: installer, `.sig` and
`latest.json` redownloaded with verified hashes, also in anonymous form; latest
= v0.8.0. App only, **no AI weights**. Build executed with a `pnpm.cmd`
temporary that forwards to `npm run` (pnpm not installed on this machine).
Actual installation/upgrade not performed.

# Local Delivery M18 — 0.7.0

NSIS Windows x64 Installer compiled from commit `2052df7`, updater signed and
verified with the production key. Local path:
`installers/Chronexus-0.7.0-Windows-x64/Chronexus_0.7.0_x64-setup.exe`.
Size 32.630.931 bytes, SHA-256
`69b9ef340f43f177b266c99ce1f9e1eac9320fdf3229ff1500106389350e270e`.
Publication suspended at user request after rejection of credentials
of the first push; no release 0.7.0 created. No installation performed.
The public release remains 0.6.0. Do not resume publication implicitly.

The installer contains the app and the 018 schema, **no AI weights**. The main
model is Qwen3.8-27B; Gemma 4 12B is optional and secondary. Manual
preparation, requirements, SHA-256 and offline use in [AI_MODELS.md](AI_MODELS.md).
The M7 `Build-OfflineInstallers.ps1` and `scripts/distribution/` scripts are
withdrawn and reject new builds of the old Qwen. The sections below and the packages
already published are historical. `scripts/release/package.py` keeps the Gemma bundle
only upon explicit request with `--secondary-gemma`; it is not the main package
and does not distribute the 27B. Do not overwrite existing releases.

# Windows Installer with local AI

## Update M17 — October 25 2026

[Chronexus 0.6.0](https://github.com/Acelith/Chronexus/tree/v0.6.0)
includes the local translation of the wiki. Windows x64 app Installer signed updater,
additive 017 schema. Local package in `installers/Chronexus-0.6.0-Windows-x64/`.
Actual signature and anonymous downloads verified, no personal installation
performed. Runtime and Qwen3 4b-instruct remain separate; already translated copies are
read without runtime. This is historical checkpoint M17. Details in WIKI_TRANSLATION.md
and STATUS.md; previous packages/releases were not overwritten.

## GitHub publication policy — planned with M11

Verified destination of `origin`: `https://github.com/Acelith/Chronexus.git`,
user repository. For future milestones implemented and verified,
the user authorizes as standard procedure the publication of the code and the
versioned releases with app packages and, when specified, local AI. There is no
need to request this ordinary authorization again, unless instructed otherwise.

Before publishing: verify server capacity/API/authentication, limits
for runtime/AI weights, licenses, consistent version/tag, actual build/test, checksum and
release notes. Exclude private and secret data; do not replace existing release/tag/asset
and do not use force-push. Verify download/checksum after upload and
report errors or partial publications accurately. Do not invent packages
for untested platforms nor use an unauthorized alternative destination.

**Next user authorization:** implement all three milestones;
complete M12 and M13 first, then compile and publish with M11 at the end.
The previous prohibition concerned only planning and is superseded by this
instruction. Do not publish intermediate artifacts or declare unverified uploads successful.

## Update M8 — October 24 2026

The new **app** installer is in `installers/Chronexus-M8-Windows-x64/`.
Verified NSIS generation; M8 installation not repeated.
M8 installer size: 4.664.266 byte; SHA-256
`e59a7cae39c01d0875f74e19c4c651030fe5733ee778e98126c056a8c5061bcf`.
Copy to root and release worker compared with final artifacts.
 Include the updated worker
not the checkpoints or the Python/CUDA environment. The backend on this
computer has been prepared and verified separately. For another computer
follow [AI_TRAINING.md](AI_TRAINING.md), without assuming that the Qwen
M7 package contains Gemma or the training.

The complete package described below remains the **M7** distribution and
was not overwritten. Keep a backup before migrating: old
builds do not read a newer SQLite schema.

## Previous M7 distribution

Output in root: `installers/Chronexus-0.1.0-Windows-x64/`.
The generated folder is excluded from Git: it contains approximately 4,5 GiB of runtime and weights,
no database, backup, campaign, or experimental model.

1. `Chronexus_0.1.0_x64-setup.exe`: install the app, same verified M7 build.
2. `Chronexus_AI_locale_x64-setup.exe`: verify/copy Ollama 0.40.10 and only
   Qwen3:4b-instruct Q4_K_M for the single user. Do not separate it from the `AI` folder.
3. Start Menu → Chronexus → Launch local AI; then open Chronexus and in the local
   Assistant campaign → Check Ollama → model → consent → Activate.

The AI package is complete for use without download. It does not install GPU drivers,
WebView2 or system services; it does not enable cloud or auto-start. Additional space
approximately equal to the package is required. No changes to app campaigns.
Unsigned installers; macOS/Linux were not produced on this Windows environment.

Manifest with SHA-256 of each file in `AI/bundle.json`, checksum of the two EXEs in
`SHA256SUMS.txt`, immediate instructions in `LEGGIMI.txt`. Upstream licenses included:
Ollama MIT, Qwen Apache-2.0 and runtime component notices.

The AI is copied into a per-user/version folder. It does not overwrite foreign
or modified files; repeating the same package is idempotent. If a disk/permission error
interrupts the copy, a partial folder without a manifest is not
automatically adopted: choose a new folder. To remove the AI,
close its runtime and remove only that folder and its shortcut
from the Start menu, keeping any desired personal models.

Ollama can enrich the local manifest: the verified digest of the wrapper is
`6214d088d3846e16c9fe00adcbabdbfddc61ce4a70daacc46cb2310c38603054`, with original manifest
`0edcdef34593eac1aa2be9c7d06c432dcf81945adca5eca2f27662c18f168ba0`.
The weights remain the same, SHA-256
`85e4a5b7b8ef0e48af0e8658f5aaab9c2324c76c1641493f4d1e25fce54b18b9`.
The launcher verifies both known identities, GGUF weights, absence of forwarding and
disabled cloud. If Chronexus had fixed the old digest, check and
reactivate the model: the app does not automatically change the configured identity.

## Regeneration

Local prerequisites: Chronexus NSIS build, portable Ollama/verified weights in
`.tools/m7-runtime`, official `OLLAMA_LICENSE` license of that release and
NSIS of the Tauri toolchain. No automatic downloads in the script.

```powershell
./scripts/Build-OfflineInstallers.ps1
```

Reject existing outputs; `-OutputDirectory` allows a new folder inside
the repository. Copy all runtime files and only the blobs referenced by the
selected manifest, verifying their hashes. Include licenses and launchers.
Does not read campaign folders. To compile the app first: `pnpm package:desktop`
in the configured Rust environment described in the README.

## Verifications

- AI NSIS compilation and app installer copy: successful.
- Six `powershell -File scripts/distribution/Test-AIInstaller.ps1` scenarios:
  path with spaces, repetition, modified file, foreign data, incorrect checksum
  and traversal. Verifications precede any copy; no overwrite.
- Silent installation AI `/S /TEST /D=<profilo isolato>` actually tested;
  `/TEST` only omits the Start menu link.
- Copied runtime: cloud status disabled, model and weights verified; inference
  on real GPU tested. The initial sandbox denied runtime access, therefore the
  test was repeated in the normal Windows user context.
- .NET Hash in the copy script, independent from the `Get-FileHash` autoload of
  PowerShell launched from NSIS. Installer requires Windows x64 and uses 64 bit PowerShell.
- No new testing of React/Rust functions: they were not modified.
  Interactive Wizard/links and different platforms are not verified here.

## M11 — 0.2.0 Windows x64 procedure

The current procedure is `scripts/release/package.py`, not the M7/Qwen
historical script. package.json, Cargo.toml/lock and tauri.conf.json versions consistent;
storage identifier unchanged. Build with relative toolchain via Dev.ps1
or configure the project's CARGO_HOME/RUSTUP_HOME and use:

```powershell
pnpm exec tauri build --bundles nsis
C:/Python315/python.exe scripts/release/package.py installers/Chronexus-0.2.0-Windows-x64-final
C:/Python315/python.exe -m unittest discover -s scripts/release -p 'test_*.py'
```

The script requires a new directory, verifies official Gemma 4 GGUF blobs and
produces five valid app/AI ZIPs under 2048 MiB: core app/runtime/components and four
main weight volumes (the fourth also includes the projector). Each file has
SHA-256 and size; `AI/bundle.json` guides the offline PowerShell installer.
Do not extract volumes manually. app/font and runtime/model licenses included;
no scanning of campaign folders or training profiles.

The former hosting-specific ZIP publisher is retired. `publish_unsigned.py`
creates GitHub pre-releases only, without `latest.json`; `publish_app_update.py`
keeps the production-key signature gate, single-writer lock, draft ownership checks
and explicit finalization for signed stable updates. Both verify downloaded bytes.
GitHub credentials stay in memory and never follow redirects to the asset CDN.

Actual evidence and version limits are in `docs/releases/v0.2.0.md`.
SHA256SUMS.txt and package-report.json remain with local packages; the six
checksums are also reported in the release body. Tokens/passwords must never
enter plan files, receipts, logs, process arguments, or Git.


### Outcome of the first remote release

Tag v0.2.0 and code published; draft id 2 and app-only package uploaded with
verified download/checksum. Large uploads interrupted by service (HTTP 502,
297 MB/235 s on the second attempt); it is not a credentials issue. Do not
publish the incomplete draft. The five local AI packages are intact.
Wait for gateway verification/correction before another long upload.
`MAX_FILES=5` indicates attachments for single upload, does not mandate five assets for
release; the sixth package makes the app downloadable without the AI weights.

The tag identifies the actually compiled source. Subsequent corrections
to tools/documents only can advance main without rewriting that tag:
the local plan records `commit` compiled and `publicationCommit`. The validator
rejects any application modification after the tag; in that case, a
new build and new version are required. No existing tag or attachment is overwritten.


### LAN resumption explicitly authorized

The user indicated a private LAN address of the previous host for this resumption. It is the only
allowed alternative endpoint and must be explicitly selected via
`publish(authorization, base_url=LOCAL_BASE, finalize=False)`. Compare repository
(id/name/permissions) and draft with the canonical site before any writing.
The Git origin remains public HTTPS; no replacement of the compiled source tag.

The client does not follow redirects and does not send authorization to other hosts. The canonical
URLs `/attachments/<id>` are rewritten only towards the precise endpoint
of the selected locale, for the SHA-256 download of the same attachments. Completed
verifications are recorded with ID/size/hash/transport in the local receipt;
an asset already present but not recognized by the receipt is not overwritten.

Use `finalize=False` first to complete upload and download while maintaining the draft;
update the notes with the actual evidence and then finalize. Check the exact set
of attachments before making the release public. The resume tests
are 18; no modification to the binary or app data requires a new build.

### App Updates 0.4.0

The updater channel uses only the installer signed with `.sig` and `latest.json`, without
redistributing the M11 AI weights in every version. Protected compilation and procedures
are in docs/UPDATES.md; previous packages and the v0.2.0 draft remain distinct.


0.4.0 published on 25 October 2026: release id 3, app-only installer signed
updater, .sig and latest.json. All three downloaded without login with verified hashes;
latest API confirmed by the synthetic desktop app. Compiled source d75f5f3.
The draft id 2/v0.2.0 was not modified and did not become a complete release.
