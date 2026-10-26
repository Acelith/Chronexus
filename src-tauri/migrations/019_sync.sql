-- M24 opt-in sharing client. Nothing is shared by default: an item without a
-- sync_shares row is private and never leaves the device.
CREATE TABLE sync_links (
 campaign_id TEXT PRIMARY KEY REFERENCES campaigns(id),
 server TEXT NOT NULL CHECK(length(server) BETWEEN 9 AND 512),
 remote_id TEXT NOT NULL CHECK(length(remote_id) BETWEEN 1 AND 64),
 account_id TEXT NOT NULL CHECK(length(account_id) BETWEEN 1 AND 64),
 role TEXT NOT NULL CHECK(role IN ('owner','player','reader')),
 cursor TEXT NOT NULL DEFAULT '' CHECK(length(cursor) <= 128),
 synced_at TEXT
);
CREATE TABLE sync_shares (
 campaign_id TEXT NOT NULL REFERENCES sync_links(campaign_id),
 kind TEXT NOT NULL CHECK(kind IN ('page','session','relationship','party')),
 item_id TEXT NOT NULL CHECK(length(item_id)=36),
 state TEXT NOT NULL CHECK(state IN ('shared','revoked')),
 pushed_hash TEXT NOT NULL DEFAULT '' CHECK(pushed_hash='' OR length(pushed_hash)=64),
 remote_revision INTEGER NOT NULL DEFAULT 0 CHECK(remote_revision>=0),
 PRIMARY KEY(campaign_id,kind,item_id)
);
-- Items shared by other members (or by this account from another device),
-- kept read-only and attributed: they never become local campaign facts.
CREATE TABLE sync_remote_items (
 campaign_id TEXT NOT NULL REFERENCES sync_links(campaign_id),
 kind TEXT NOT NULL CHECK(kind IN ('page','session','relationship','party')),
 item_id TEXT NOT NULL CHECK(length(item_id)=36),
 author_id TEXT NOT NULL CHECK(length(author_id) BETWEEN 1 AND 64),
 author_name TEXT NOT NULL CHECK(length(author_name) BETWEEN 1 AND 100),
 revision INTEGER NOT NULL CHECK(revision>=1),
 payload TEXT NOT NULL CHECK(json_valid(payload) AND length(payload)<=2100000),
 updated_at TEXT NOT NULL,
 PRIMARY KEY(campaign_id,kind,item_id)
);
-- Both versions are kept until the user chooses; nothing is overwritten silently.
CREATE TABLE sync_conflicts (
 campaign_id TEXT NOT NULL REFERENCES sync_links(campaign_id),
 kind TEXT NOT NULL CHECK(kind IN ('page','session','relationship','party')),
 item_id TEXT NOT NULL CHECK(length(item_id)=36),
 remote_revision INTEGER NOT NULL CHECK(remote_revision>=1),
 remote_payload TEXT NOT NULL CHECK(json_valid(remote_payload) AND length(remote_payload)<=2100000),
 detected_at TEXT NOT NULL,
 PRIMARY KEY(campaign_id,kind,item_id)
);
INSERT INTO schema_migrations(version) VALUES(19);
