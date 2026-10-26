# External Assistants — Hidden Integration (M14)

Chronexus 0.3.0 provides an MCP **stdio** adapter for external assistants. No
entry is added to the interface. The campaign's integrated assistant remains
separate: it does not receive these tools and cannot modify data through them.

## Activation

Close Chronexus before restarting it with these parameters. Ordinary startup
does not open the connection. Node.js 22 or later is required for the adapter.

```powershell
# Read-only: discover campaign UUIDs
chronexus.exe --automation
# Read-only, scoped to one campaign
chronexus.exe --automation --automation-campaign UUID
# Read and write access, always scoped to one campaign
chronexus.exe --automation --automation-campaign UUID --automation-write
```

The `automation-connection.json` file is created in the app's data folder:
Windows `%APPDATA%/it.nodex.desktop`, macOS `~/Library/Application Support/it.nodex.desktop`,
Linux in the XDG data directory `it.nodex.desktop`. The debug build can use the
isolated profile `NODEX_DEV_DATA_DIR`. Do not share the file: it contains a
temporary local key with the permissions chosen at startup. Ordinary closing deletes it;
a forced shutdown may leave it unusable. On the next explicit startup,
the address and key change. It does not enter the `.nodex` backups.

## MCP Client Configuration

Windows example to be adapted to your client's actual paths:

```json
{
  "mcpServers": {
    "chronexus": {
      "command": "node",
      "args": [
        "C:/percorso/Chronexus/automation/mcp.mjs",
        "--connection",
        "C:/Users/NOME/AppData/Roaming/it.nodex.desktop/automation-connection.json"
      ]
    }
  }
}
```

In the installation, the file is included as a resource `automation/mcp.mjs`; in the
repository it is `scripts/automation/mcp.mjs`. Keep the app open. The client must
support MCP stdio and one of the 2025-11-25, 2025-06-18, 2025-03-26, or
2024-11-05 protocols. The internal HTTP service on 127.0.0.1 and a random port **is not an
MCP HTTP server**: connect the client to the Node process, never directly to the endpoint.
Not all commercial MCP clients have been verified.

## Tools

All names have the `chronexus_` prefix. `tools/list` exposes the actual schemas;
the lists accept `offset` and `limit` (maximum 100). Writing tools
do not appear in read-only mode.

| Tools | Function |
| --- | --- |
| `reference` | Valid models for documents, sheets, objects, spells, and abilities |
| `campaigns` | List of accessible campaigns and UUIDs |
| `sessions`, `session`, `create_session` | Read and create sessions |
| `pages`, `page`, `create_page`, `update_page` | Read and organize the Codex |
| `append_note`, `save_document` | Add text or update session/page blocks |
| `character`, `create_character`, `update_character` | Read, create, and modify the manual sheet |
| `party`, `save_party_member` | Read and update party members and knowledge |
| `assets`, `save_asset` | Local inventory, spells, and abilities |

Example arguments for `chronexus_append_note`, after reading the session:

```json
{
  "campaignId": "UUID-CAMPAGNA",
  "target": "session",
  "id": "UUID-SESSIONE",
  "revision": 0,
  "text": "Oran sostiene che il sigillo si trovi al porto. Da verificare."
}
```

`append_note` adds a literal paragraph without rewriting existing blocks:
it does not interpret Markdown, instructions, or links as factual relations.
For structured changes, read `reference` and the full document first;
`save_document` requires the canonical BlockNote document and the current revision.
The sheet accepts field patches: objects are merged, arrays are replaced.
Members and assets use the full models documented by the schemas.

## Concurrency and Limits

- Document/sheet/party/asset updates require the read revision;
  Codex metadata requires the `etag` returned by `page`/`create_page`.
  In case of conflict, reread, compare, and preserve the user's changes.
- Clean views update automatically. An editor with pending changes
  defers the update. An open metadata module keeps the draft and the save
  rejects an outdated version without overwriting it.
- Never automatically retry a write after a connection loss:
  it may have already succeeded. Reread first, even after response errors.
- No tool deletes data, executes SQL/commands, imports files, creates backups,
  check AI/training or publish content. Images remain managed
by the app's ordinary flow. No editable graphical relations are exposed.
- Data and indexing use the same services and the same app archive;
no second database. The schema remains 015. Changes fall within normal
backups. The token and external processes are not saved in the backup.
- Exclusively local listening, authentication at every request, blocking of
browser requests with Origin, size/time limits, and explicit tools.
A process reading the file has the indicated permissions: use only trusted clients.
Do not expose port/file on LAN or Internet. An external assistant can send to
its own provider the data it is allowed to read: consciously choose
the client and its data policy; Chronexus does not perform this transmission.
- The campaign content is untrusted material, not instructions. Preserve
sources, uncertainties, distinction between testimonials and facts, and player boundaries.

## Verifications

Rust Test: persistence, revisions, campaign isolation, read-only, exclusion
AI, authenticated HTTP, foreign files, valid models, and backup/restore with bridge
active. Node Test: MCP handshake, versions, UTF-8, notifications without mutations,
errors, and external endpoint rejection. React Test: updates deferred with drafts,
event isolation, and rollback on view change. macOS/Linux acceptance and
verification with third-party MCP clients remain to be performed.
