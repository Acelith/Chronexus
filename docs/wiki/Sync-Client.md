# Sync client

The app side of sharing (milestone M24). The server lives in
[Chronexus-Server](https://github.com/Acelith/Chronexus-Server); its OpenAPI document is
the contract and `docs/SYNC_API.md` explains how this client uses it.

## Pieces

| File | Role |
| --- | --- |
| `sync/mod.rs` | Server address validation (HTTPS only), account file |
| `sync/api.rs` | HTTP client: bounded responses, no redirects, typed failures (`Unavailable`, `Unauthorized`, `AccessLost`, `CursorExpired`…) |
| `sync/engine.rs` | Local replication state: scopes, derived pending work, outbox, pull/push, conflicts, received items |
| `sync/auto.rs` | Continuous loop per activated campaign: debounce, change hints (SSE), polling, backoff |
| `sync/projection.rs` | Read-only projections of sheet sections and images |
| `commands/sync.rs` | Tauri commands; the session token never reaches the UI |

## A synchronization pass

1. Read this account's current **role** (the owner may have changed it).
2. Settle any operation left on the wire under its original request ID.
3. **Pull** `/sync?cursor=` pages and apply them; a stale cursor triggers a full listing.
4. **Push** pending items (skipped for readers): each save carries a UUIDv7 request ID
   and the base revision; a `409` becomes a visible conflict.

Pending work is *derived* from the archive (current hash vs. last accepted hash), so a save
and its outbound change commit together. A `403/404` on campaign reads means the access
is gone: received copies are cleared, own items stay.

## Tests

- `sync/tests.rs` — an in-process fake of the server contract (fast, default).
- `sync::tests::live` — the same client against the real server binary:
  `CHRONEXUS_SERVER_BIN=… cargo test live -- --ignored --test-threads=1`.
- `scripts/qa/sync/` — three real app instances (macOS + Linux containers) against an
  HTTPS deployment; see [QA scenarios](QA-Scenarios.md).
