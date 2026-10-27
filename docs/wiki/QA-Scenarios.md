# QA scenarios

Unit tests are not enough for a desktop app: these run the real app.

| Scenario | Where | What it proves |
| --- | --- | --- |
| IPC flows (`scripts/qa/ipc/`) | Any OS, debug build | Main commands through real Tauri IPC: campaigns, pages, search, graph, sheet, images, backup/restore, latency |
| Sharing across devices (`scripts/qa/sync/`) | macOS native + Linux containers | Three app instances against an HTTPS server: invitations, scopes, attribution, live edits, conflicts, unsharing, offline, roles, leaving, removal |
| CDP smoke scripts (`scripts/*.mjs`, `scripts/qa/m*.mjs`) | Windows (WebView2) | Real UI flows per milestone; some predate the English UI (M30 will repair them) |

Rules: synthetic data only, new empty profiles (`NODEX_DEV_DATA_DIR`), reports kept out of
Git, and a failing scenario is reported as failing. Step-by-step instructions:
`docs/QA.md`.
