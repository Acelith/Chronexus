# Reproducible builds (M33)

## Rebuild a release

1. `git clone https://github.com/Acelith/Chronexus.git && cd Chronexus && git checkout vX.Y.Z`
   (annotated tag; `git tag -v` shows it, the commit is in the release notes).
2. Toolchain: Node 24, pnpm 11.25.0, Rust stable as in CI (`.github/workflows/desktop.yml`).
3. `pnpm install --frozen-lockfile`, then `pnpm tauri build` (unsigned) for your platform.
4. Compare the frontend files and the SBOM (`python3 scripts/release/sbom.py X.Y.Z out/`)
   with the release.

## What is verified

| Part | Status |
| --- | --- |
| Frontend bundle (`dist/`) | **Reproducible**: two builds of the same tree give 72 byte-identical files (macOS arm64, 29 October 2026). Check with `scripts/trust/reproducible-frontend.sh`. |
| SBOM / licence report | Deterministic except the timestamp and serial number in the SBOM header |
| Rust binary and installers | **Not verified.** Absolute build paths, signatures (Windows updater, macOS ad-hoc), installer timestamps and toolchain versions make byte-identical packages unlikely without extra work (`--remap-path-prefix`, `SOURCE_DATE_EPOCH`, pinned toolchain). Compare behaviour and the SBOM instead. |
