# Release process

- **Versions** follow semantic versioning in `package.json`, `src-tauri/Cargo.toml` and
  `tauri.conf.json`.
- **Integrity, free only:** every update is signed with the Tauri updater key (kept
  outside Git, encrypted); every artifact gets a SHA-256 checksum. No paid code signing
  (roadmap M29): installers are not Authenticode-signed or notarized.
- **Publication** goes to the Forgegit origin `github.com/acelith/Chronexus` as releases
  with OS/architecture labels, checksums and notes. Never overwrite existing tags or
  assets; never publish unverified or incomplete deliveries.
- **Updater channel:** only signed packages, with a `latest.json` per release. Existing
  users receive the herald announcement.
- **Before publishing:** all checks green, i18n gate passed, the package installed and
  started on its platform (or explicitly reported as unverified).

Details: `docs/UPDATES.md`, `docs/INSTALLERS.md`, `scripts/release/`.
