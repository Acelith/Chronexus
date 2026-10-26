# Notes for building the Chronexus server (M25)

Written on 26 October 2026, after the M24 desktop client, for whoever creates the
separate server repository. The client side is done and tested against an in-process
fake (`src-tauri/src/sync/tests.rs`); the server must satisfy the same contract,
[docs/SYNC_API.md](SYNC_API.md). Nothing here authorizes creating the repository,
buying a domain or deploying: those steps need the user's explicit go-ahead.

## Confirmed product decisions

- Self-hosted on the user's infrastructure, next to Forgegit, as a Docker image.
- HTTPS only; the server reads the shared items (no end-to-end encryption in v1).
- Invitation-only accounts; campaign roles `owner`, `player`, `reader`.
- Conflicts are resolved by people on the desktop: the server only enforces
  revisions and answers 409. No merging, no CRDT in v1.
- The desktop stays local-first: the server stores **only items a user shared**.
  Private notes, character sheets, AI data, preferences and backups never arrive.
- Player knowledge: an item belongs to its author; other members read it, attributed.
  The server must never present an item as a campaign fact or merge authors.

## Repository bootstrap (`acelith/Chronexus-Server`)

- Same working model as this repository: `AGENTS.md`, `ROADMAP.md`,
  `docs/STATUS.md`, Conventional Commits with the long body format, no secrets or
  real data in Git, CI with fmt/clippy/tests.
- Suggested stack (from ROADMAP M24.1): Rust, `axum` + `tokio`, SQLite (WAL) for a
  single small group, PostgreSQL only if needed later; `argon2` for passwords;
  `serde` with `deny_unknown_fields` on every request type.
- Publish the OpenAPI schema generated from the code (for example with `utoipa`) at
  `/api/v1/openapi.json` and in releases; then replace the hand-written contract in
  this repository with a link. Declare which desktop versions each server supports.

## Data model (minimum)

```
accounts(id, username UNIQUE, display_name, password_hash, created_at, disabled)
tokens(token_hash PK, account_id, device, created_at, last_used_at, revoked_at)
invites(code_hash PK, campaign_id NULL, role, created_by, expires_at, used_by, used_at)
campaigns(id, name, owner_id, created_at)
members(campaign_id, account_id, role, joined_at, PK(campaign_id, account_id))
items(campaign_id, kind, item_id, author_id, revision, payload NULL, deleted,
      seq, updated_at, PK(campaign_id, kind, item_id))
sequence counter per server (or per campaign) for the change cursor
```

- Store **hashes** of tokens and invitation codes, never the raw values.
- `seq` grows on every write; `changes?since=` returns rows with `seq > since`
  ordered by `seq`, latest state only, `more` when the page limit (1000) is hit.
- Deletes set `payload = NULL, deleted = 1`, bump `revision` and `seq` (tombstone).
- Index `(campaign_id, seq)` for the feed.

## Security checklist

- TLS terminated by the reverse proxy already used for Forgegit; HSTS; no HTTP
  listener exposed. Redirects are not followed by the client, so serve the API at
  the exact origin users enter.
- Passwords: argon2id, minimum 12 characters, attempt limits per account and per IP
  (429), constant-time comparisons for tokens and codes.
- Tokens: 256-bit random, sent only as Bearer, revocable (logout, admin), expiry with
  sliding renewal; list and revoke devices per account.
- Authorization on **every** item route: membership, role (`reader` never writes),
  author-only writes, campaign id from the path checked against membership.
- Validate payloads exactly as the client does (see the table in SYNC_API.md),
  limits on body size (2.1 MB), item count per campaign, and requests per minute.
- No content in logs: log method, route template, status, timing and account id only.
  No telemetry or third-party calls.
- Server invitation for the first owner printed once at first start (CLI or log),
  never a default password.

## Operations

- Docker image with a non-root user, read-only root filesystem, a single volume for
  the database; health check on `/api/v1/meta`.
- Backups: SQLite online backup (or `VACUUM INTO`) to a dated file, checksummed,
  plus a restore procedure that is actually tested. Document retention.
- Upgrades: versioned migrations, never destructive without a recovery path,
  matching this repository's rules.
- Installation guide for the user's infrastructure; no default domain is assumed.

## Acceptance to reproduce (from ROADMAP M24)

Port the scenarios of `src-tauri/src/sync/tests.rs` as server integration tests and
run the real desktop client against a test deployment:

1. Three synthetic accounts (owner, player, reader) through invitations.
2. Selective sharing: private items never reach the server (check the database).
3. Updates visible to other members with increasing revisions.
4. Concurrent edits from two devices of one account: 409, conflict shown on the
   desktop, both choices (keep local, keep server) converge.
5. Revocation removes the item from the other members at their next sync.
6. Offline desktop work realigns later; unreachable server is an explicit error.
7. Reader writes and non-author writes are refused (403); expired invitations 410;
   wrong passwords 401 then 429.
8. Server backup and restore keep accounts, memberships, items and tombstones.

## Known client limits to keep in mind

- v1 shares pages, sessions, relationships and party members; images and character
  sheets are not shared yet (plan binary uploads with size limits and checksums).
- Items created on another device of the same account appear read-only under
  "Shared with you" on the other devices until a future import step.
- The client sends a whole payload per change, not deltas.
