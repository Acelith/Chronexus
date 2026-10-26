# Chronexus sharing API — contract v1 (M24)

Status: **draft contract written with the M24 desktop client**, 26 October 2026.
The server lives in a separate repository (proposed `acelith/Chronexus-Server`,
milestone M25). Until that repository publishes its OpenAPI schema, this file and
the executable fake in `src-tauri/src/sync/tests.rs` are the reference. When the
server publishes the schema, it becomes the source of truth and this file must point
to it instead of being edited by hand.

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

### `GET /api/v1/campaigns/{campaignId}/changes?since=<cursor>`

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

### `PUT /api/v1/campaigns/{campaignId}/items/{kind}/{itemId}`

Players and owners only; only the **author** may change an existing item (403).
Request: `{ "baseRevision": n, "payload": { … } }`.

- `baseRevision = 0` creates the item (or recreates a tombstone); revision becomes 1.
- Otherwise `baseRevision` must equal the current revision, else **409** with the
  current `{ "revision", "payload" }` (payload `null` for a tombstone).
- Missing item with `baseRevision > 0`: 404.
- Success: `{ "revision": n }` (the new revision).

### `DELETE /api/v1/campaigns/{campaignId}/items/{kind}/{itemId}?baseRevision=n`

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
