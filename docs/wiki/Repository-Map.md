# Repository map

| Path | What |
| --- | --- |
| `src/features/<area>/` | UI per area: `api.ts`, components, `*.test.tsx` |
| `src/i18n/` | Locale store, `tr()`, catalogs (`catalogs/*.json`), scripts/transcriptions |
| `src/components/`, `styles.css` | Shared components and the dark-fantasy theme |
| `src-tauri/src/lib.rs` | App setup, state, command registration |
| `src-tauri/src/commands/` | Tauri commands per area |
| `src-tauri/src/*.rs` + `*_tests.rs` | Domain modules and their tests |
| `src-tauri/src/sync/` | Sharing client: `api.rs` (HTTP), `engine.rs` (replication), `auto.rs` (continuous loop), `projection.rs`, `tests.rs` |
| `src-tauri/migrations/` | SQL migrations `001`–`021` |
| `scripts/i18n/` | Coverage check, scanner, catalog normalisation |
| `scripts/qa/` | Real-app QA: CDP smoke scripts, `ipc/` flows, `sync/` multi-device scenario, `linux/` Docker image |
| `scripts/build/` | Container builds (`container-build.sh`, `windows/Dockerfile`) |
| `scripts/release/` | Release publisher and checks |
| `assets/` | Brand, fonts (with licences), dice art |
| `docs/` | Canonical technical documentation; `docs/wiki/` is this wiki's source |
