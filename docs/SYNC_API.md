# Chronexus sharing API — contract v1 (M24, M25.5)

Status: **the server repository `Chronexus-Server` now generates the authoritative
OpenAPI** (`api/openapi.json`, with TypeScript schemas) from its implemented code; read
that for exact types. This file explains how the desktop client uses it and keeps the
rules the client depends on. The executable fake in `src-tauri/src/sync/tests.rs`
mirrors the server rules for hermetic tests; `sync::tests::live` runs the same client
against the real server binary (see Acceptance).

## M25.5 replication endpoints (used by this client since schema 020)

The client replicates the items the user chose, privately or shared, over the typed
content API, and no longer uses `/items` or `/changes` (both are still served for older
clients and documented further below). `GET /api/v1/meta` must list the capabilities
`private-content`, `idempotent-mutations` and `incremental-sync`; the client refuses
servers that do not (it also uses `change-notifications` when present).

| Call | Use |
| --- | --- |
| `PUT /api/v1/campaigns/{id}/content/{kind}/{itemId}` | Save with `requestId` (UUIDv7), `baseRevision`, `visibility` (`private`, `members`) and `payload`. 409 carries the current `{revision, payload}` for a revision conflict, or `{error}` for a reused request ID. |
| `DELETE …/content/{kind}/{itemId}?baseRevision=&requestId=` | Remove the server copy (a tombstone). |
| `GET …/sync?cursor=` | The caller's authorized current state since a cursor: own items (private or shared) with payload, tombstones for deleted items and for items other members stopped seeing. 410 means the cursor is stale or from the future: list and resume. |
| `GET …/content?after=` | Full listing (50 per page); every page carries `head`, the cursor to resume `/sync` from (use the first page's). |
| `GET /api/v1/campaigns` | The account's campaigns, to download one on a second computer. |
| `GET …/events` | `text/event-stream` of content-free hints (`ready`, `changed`, `reconnect`, `closed`); the client wakes a pass and never stores anything from it. Polling every 30 s covers a missed hint. |

Client rules that rely on the contract:

M31 adds `clue` as a player-authored content kind. Its typed payload contains
`kind`, `title`, `details`, `certainty`, `status`, `sources` (session/page IDs and
optional block IDs), `pageIds` and `resolutionSessionId`. It has the same
`none`/`private`/`shared` choice as notes. Before a clue can leave the device,
all referenced pages and sessions must be chosen for the same audience. The
server validates those dependencies and withdraws a publicly visible clue when
a referenced source loses public visibility. Remote copies use stable IDs and
normal clue validation; a received claim is never promoted to a relationship.

- Every outbound operation gets a **UUIDv7** request ID that is stored in `sync_outbox`
  together with the exact payload *before* the request is sent. After a crash or a lost
  response the stored operation is replayed first and acknowledged by the server's
  receipt; a 410 on a request ID (older than 30 days) discards it and the item is
  re-evaluated from its current state.
- Unknown item kinds in `/sync` are ignored, so a newer server cannot stall the feed.
- A stale cursor is never repaired by guessing: the client lists the campaign, keeps what
  is listed, stops replicating its own items that are gone and drops received copies that
  are gone, then resumes from the listing's `head`.
- Items of this account that exist only on another device are **created locally** with
  their original ID in dependency order (pages, sessions, party, relationships); ones whose
  page has not arrived are kept and retried. A different local item with the same ID
  becomes a conflict, never an overwrite.
- A tombstone for an item of this account stops its replication here and keeps the local
  item; deletions are never propagated into another device's archive silently.
- **Projections (M25.4).** `sheetSection` and `image` items are shared only (`visibility: members`):
  the payload keys are those of the server's OpenAPI (`characterId, name, section, fields[]`;
  `attachmentId, caption`). Section item IDs are derived from the character ID and the section
  name so every computer agrees on them; images use their local ID. An image's original is
  uploaded first with `POST …/attachments` (checksum header; identical bytes return the stored
  attachment), then its caption is tied to the returned attachment ID. Received projections are
  kept as attributed read-only copies; an image's bytes are fetched on request, verified against
  the checksum the server sent, and never become a local image. A projection of this account from
  another computer is displayed, not created locally.
- **Access loss (M25.6).** A `403` or `404` on `/sync` or the full listing (removed from the
  campaign, or the campaign was deleted: `404 "This campaign was deleted."`) is `AccessLost`:
  received copies of other players' items are cleared, this account's own items, replication
  choices, drafts and pending operations stay, the cursor restarts, automatic synchronization
  is switched off and the Sharing view says why. Switching it on again tries once more.
- **Explicit destructive actions** map to `POST …/own-content/deletion` (delete my server copy:
  local items stay, replication choices are forgotten), `POST …/deletion` with the exact campaign
  name (owner; unlinks locally, local items stay) and `POST /auth/account/deletion` with the
  password (the session and this account's links are forgotten locally, campaigns stay).

Decisions confirmed by the user on 26 October 2026:

- Transport: HTTPS only. The server stores shared items **readable** (no end-to-end
  encryption in v1), so it can enforce per-item permissions and keep backups.
- Registration: **invitation only**. No open sign-up.
- Concurrent edits: **revisions + user choice**. No automatic merge, no CRDT in v1.
- Server address: entered and verified by the user; no default domain.

## Conventions

- Base: the server origin entered by the user, e.g. `https://sync.example.org`.
  The client refuses paths, credentials, query strings and fragments in it, and
  plain HTTP (except loopback in the client's own tests).
- All bodies are JSON (`Content-Type: application/json`), field names camelCase.
- Authentication: `Authorization: Bearer <token>` on every call except `meta`,
  `auth/login` and `auth/redeem`.
- Redirects are never followed by the client: answer directly.
- Response size: the client reads at most 8 MiB per response.
- Identifiers chosen by the server (`accountId`, campaign `id`) must match
  `[A-Za-z0-9_-]{1,64}`. Item ids are the client's lowercase hyphenated UUIDs.
- Times: RFC 3339 UTC strings.

## Status codes the client understands

| Code | Meaning for the client |
| --- | --- |
| 200 / 201 | Success (201 for created campaigns and invitations) |
| 204 | Success without body (logout) |
| 400 / 422 | Invalid request |
| 401 | Missing, expired or revoked token: the user must sign in again |
| 403 | Authenticated but not allowed (role, membership, not the author) |
| 404 | Not found (also: item never created) |
| 409 | Revision conflict, body `{ "revision": n, "payload": … | null }` |
| 410 | Invitation expired or already used |
| 413 | Item too large |
| 429 | Rate limited |
| 5xx | Server unavailable |

Error bodies may contain `{ "error": "text" }`; the client does not show server text
to users (it maps codes to its own translated messages).

## Endpoints

### `GET /api/v1/meta`

```json
{ "api": "chronexus-sync", "version": 1, "serverVersion": "0.1.0" }
```

The client rejects any other `api` value and any `version` other than 1.

### `POST /api/v1/auth/redeem` — create an account with an invitation

Request: `{ "inviteCode", "username", "displayName", "password", "device" }`.
The client enforces passwords of at least 12 characters; the server must enforce its
own policy too. An invitation may be a **server invitation** (creates the account
only) or a **campaign invitation** (creates the account and joins the campaign with
the invitation's role). Each code works once (410 afterwards).

Response:

```json
{ "token": "…", "accountId": "acc-1", "username": "gina", "displayName": "Gina" }
```

`token`: 32–512 printable ASCII characters, opaque, revocable, bound to `device`.

### `POST /api/v1/auth/login`

Request: `{ "username", "password", "device" }`. Same response as `redeem`.
Wrong credentials: 401. Repeated failures: 429.

### `POST /api/v1/auth/logout`

Revokes the presented token. 204 (or 401 if already invalid; the client accepts both).

### `POST /api/v1/campaigns`

Request: `{ "name" }`. Creates a shared campaign owned by the caller.
Response 201: `{ "id": "camp-1", "name": "…", "role": "owner" }`.

### `POST /api/v1/campaigns/join`

Request: `{ "inviteCode" }`. Adds the caller to the campaign of a campaign invitation.
Response: `{ "id", "name", "role" }` with role `player` or `reader`. 410 when used/expired.

### `POST /api/v1/campaigns/{campaignId}/invites`

Owner only (403 otherwise). Request: `{ "role": "player" | "reader" }`.
Response 201: `{ "code": "…", "role": "player", "expiresAt": "2026-11-02T00:00:00Z" }`.

### `GET /api/v1/campaigns/{campaignId}/changes?since=<cursor>` (legacy, no longer used by the client)

Members only. Returns every item of the campaign whose state changed after `cursor`
(an opaque string ≤ 128 characters; empty string = from the beginning), in change
order, at most 1000 per page:

```json
{
  "items": [
    {
      "kind": "page",
      "id": "8f0e…",
      "authorId": "acc-1",
      "authorName": "Gina",
      "revision": 3,
      "deleted": false,
      "payload": { "…": "see payloads" },
      "updatedAt": "2026-10-26T12:00:00Z"
    }
  ],
  "cursor": "42",
  "more": false
}
```

- Each item appears once per page with its **latest** state (not every revision).
- Revoked items appear with `"deleted": true` and no payload (tombstones), so other
  devices remove their copies. Keep tombstones at least as long as any member may
  be offline (recommendation: 180 days), or force a full resync.
- The feed includes the caller's own items (the client skips its own echoes).
- `more: true` asks the client to call again with the new cursor.

### `PUT /api/v1/campaigns/{campaignId}/items/{kind}/{itemId}` (legacy, no longer used by the client)

Players and owners only; only the **author** may change an existing item (403).
Request: `{ "baseRevision": n, "payload": { … } }`.

- `baseRevision = 0` creates the item (or recreates a tombstone); revision becomes 1.
- Otherwise `baseRevision` must equal the current revision, else **409** with the
  current `{ "revision", "payload" }` (payload `null` for a tombstone).
- Missing item with `baseRevision > 0`: 404.
- Success: `{ "revision": n }` (the new revision).

### `DELETE /api/v1/campaigns/{campaignId}/items/{kind}/{itemId}?baseRevision=n` (legacy, no longer used by the client)

Author only. Same revision rule (409 with current state). Creates a tombstone and
returns `{ "revision": n }`. Already deleted or never created: 404.

## Payloads (v1)

Unknown fields make the client reject the whole change page, so the server must
send exactly these fields. The server must validate them as well (types, lengths,
document size ≤ 2 MB) and never trust the client.

| kind | fields |
| --- | --- |
| `page` | `title` (1–200), `kind` (npc, place, faction, quest, item, event, lore, note), `status` (stub, active), `aliases` (≤ 21 strings, 1–200), `document` |
| `session` | `sequence` (1–999999), `title` (1–200), `playedOn` (YYYY-MM-DD or null), `document` |
| `relationship` | `fromPageId`, `toPageId` (UUIDs of shared pages), `label` (1–100), `certainty` (confirmed, suspected, disproven, unknown), `evidence` (≤ 4000), `notes` (≤ 4000) |
| `party` | `pageId` (UUID), `name` (1–200), `playerName` (≤ 200), `role` (≤ 200), `status` (active, former, unknown) |

`document` is the Chronexus note format v1 (`{ "version": 1, "blocks": [...] }`,
block types paragraph, heading, bulletListItem, numberedListItem, checkListItem,
quote; inline text, link, pageMention). A `pageMention` keeps the target page UUID
and its visible label even when that page is not shared: the label is already part
of the shared text, the UUID carries no content. Relationship source references are
never sent (they may point to private notes).

## Compatibility

- Breaking changes need `/api/v2` and `version: 2`; the client checks `meta` first.
- Additive response fields are not allowed in v1 payloads (the client is strict);
  additive fields in non-payload objects are ignored by the client.
