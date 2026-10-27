# Build and test

## Prerequisites

- Node ≥ 22.12 and pnpm 11 (the `packageManager` field pins it).
- Rust stable (see `rust-version` / the toolchain used in CI) with Cargo.
- Windows: Visual Studio C++ Build Tools, WebView2. macOS: Xcode Command Line Tools.
  Linux: WebKitGTK 4.1 and the Tauri prerequisites.

```sh
pnpm install --frozen-lockfile
pnpm desktop        # debug app with hot reload
```

`pnpm dev` starts only the web UI: without Tauri it has no archive and says so.

## Checks before every commit

```sh
pnpm lint
pnpm format:check
pnpm typecheck
pnpm i18n:check
pnpm test           # Vitest
pnpm test:rust      # cargo test
cargo clippy --all-targets -- -D warnings   # in src-tauri
pnpm build
```

Run the checks relevant to your change; report what you actually ran. Never claim a check
that did not run.

## Packages

`pnpm package:desktop` builds the native package for the current system and signed
updater artifacts (needs the maintainer's key). For a local package without updater
artifacts:

```sh
pnpm tauri build --config '{"bundle":{"createUpdaterArtifacts":false}}'
```

Linux and Windows packages can be built in Docker: see [Container builds](Container-Builds).
