-- S5 desktop: continuous replication of explicitly chosen items. An item without a
-- sync_shares row is still private to this device. A row now carries the visibility
-- the server copy must have: 'private' (own devices only) or 'members' (shared).
ALTER TABLE sync_links ADD COLUMN auto INTEGER NOT NULL DEFAULT 0 CHECK(auto IN (0,1));
ALTER TABLE sync_links ADD COLUMN paused INTEGER NOT NULL DEFAULT 0 CHECK(paused IN (0,1));
ALTER TABLE sync_links ADD COLUMN last_error TEXT CHECK(last_error IS NULL OR length(last_error)<=300);
-- Cursors of the legacy /changes feed mean nothing to /sync; re-reading is idempotent
-- because every applied item records its revision.
UPDATE sync_links SET cursor='';
ALTER TABLE sync_shares ADD COLUMN visibility TEXT NOT NULL DEFAULT 'members' CHECK(visibility IN ('private','members'));
ALTER TABLE sync_shares ADD COLUMN pushed_visibility TEXT NOT NULL DEFAULT 'members' CHECK(pushed_visibility IN ('private','members'));
-- Copies of this account's own items that could not be created locally yet (for example
-- a relationship whose page has not arrived) keep the visibility they have on the server.
ALTER TABLE sync_remote_items ADD COLUMN visibility TEXT NOT NULL DEFAULT 'members' CHECK(visibility IN ('private','members'));
-- The operation currently on the wire. Its request ID and exact payload survive a crash
-- or a lost response, so the retry is acknowledged by the server instead of re-applied.
CREATE TABLE sync_outbox (
 campaign_id TEXT NOT NULL REFERENCES sync_links(campaign_id),
 kind TEXT NOT NULL CHECK(kind IN ('page','session','relationship','party')),
 item_id TEXT NOT NULL CHECK(length(item_id)=36),
 op TEXT NOT NULL CHECK(op IN ('save','delete')),
 request_id TEXT NOT NULL CHECK(length(request_id)=36),
 base_revision INTEGER NOT NULL CHECK(base_revision>=0),
 visibility TEXT NOT NULL CHECK(visibility IN ('private','members')),
 payload TEXT CHECK(payload IS NULL OR (json_valid(payload) AND length(payload)<=2100000)),
 payload_hash TEXT NOT NULL DEFAULT '' CHECK(payload_hash='' OR length(payload_hash)=64),
 created_at TEXT NOT NULL,
 CHECK((op='save' AND payload IS NOT NULL) OR (op='delete' AND payload IS NULL)),
 PRIMARY KEY(campaign_id,kind,item_id)
);
INSERT INTO schema_migrations(version) VALUES(20);
