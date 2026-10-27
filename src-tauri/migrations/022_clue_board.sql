-- Player-authored questions and leads. A clue is never an asserted relationship.
CREATE TABLE clues (
 id TEXT PRIMARY KEY,
 campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT,
 kind TEXT NOT NULL CHECK(kind IN ('question','lead','suspicion','rumour')),
 title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 200),
 details TEXT NOT NULL DEFAULT '' CHECK(length(details)<=8000),
 certainty TEXT NOT NULL CHECK(certainty IN ('confirmed','suspected','disproven','unknown')),
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved','disproven')),
 resolution_session_id TEXT,
 revision INTEGER NOT NULL DEFAULT 0 CHECK(revision>=0),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 UNIQUE(campaign_id,id),
 FOREIGN KEY(campaign_id,resolution_session_id) REFERENCES sessions(campaign_id,id) ON DELETE RESTRICT,
 CHECK(status!='open' OR resolution_session_id IS NULL),
 CHECK(status!='disproven' OR certainty='disproven')
);
CREATE INDEX clues_campaign_status ON clues(campaign_id,status,updated_at DESC);
CREATE INDEX clues_resolution_session ON clues(campaign_id,resolution_session_id);

CREATE TABLE clue_pages (
 clue_id TEXT NOT NULL,
 campaign_id TEXT NOT NULL,
 page_id TEXT NOT NULL,
 PRIMARY KEY(clue_id,page_id),
 FOREIGN KEY(campaign_id,clue_id) REFERENCES clues(campaign_id,id) ON DELETE CASCADE,
 FOREIGN KEY(campaign_id,page_id) REFERENCES pages(campaign_id,id) ON DELETE RESTRICT
);
CREATE INDEX clue_pages_page ON clue_pages(campaign_id,page_id);

CREATE TABLE clue_sources (
 clue_id TEXT NOT NULL,
 campaign_id TEXT NOT NULL,
 source_session_id TEXT,
 source_page_id TEXT,
 source_block_id TEXT NOT NULL DEFAULT '' CHECK(length(source_block_id)<=128),
 CHECK((source_session_id IS NULL)!=(source_page_id IS NULL)),
 FOREIGN KEY(campaign_id,clue_id) REFERENCES clues(campaign_id,id) ON DELETE CASCADE,
 FOREIGN KEY(campaign_id,source_session_id) REFERENCES sessions(campaign_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(campaign_id,source_page_id) REFERENCES pages(campaign_id,id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX clue_source_session ON clue_sources(clue_id,source_session_id,source_block_id) WHERE source_session_id IS NOT NULL;
CREATE UNIQUE INDEX clue_source_page ON clue_sources(clue_id,source_page_id,source_block_id) WHERE source_page_id IS NOT NULL;
CREATE INDEX clue_source_session_filter ON clue_sources(campaign_id,source_session_id);
CREATE INDEX clue_source_page_filter ON clue_sources(campaign_id,source_page_id);


-- SQLite cannot widen the existing kind CHECK. Rebuild the four sync tables to
-- accept clues while copying all previous rows unchanged.
CREATE TABLE sync_shares_v3 (
 campaign_id TEXT NOT NULL REFERENCES sync_links(campaign_id),
 kind TEXT NOT NULL CHECK(kind IN ('page','session','relationship','party','sheetSection','image','clue')),
 item_id TEXT NOT NULL CHECK(length(item_id)=36),
 state TEXT NOT NULL CHECK(state IN ('shared','revoked')),
 pushed_hash TEXT NOT NULL DEFAULT '' CHECK(pushed_hash='' OR length(pushed_hash)=64),
 remote_revision INTEGER NOT NULL DEFAULT 0 CHECK(remote_revision>=0),
 visibility TEXT NOT NULL DEFAULT 'members' CHECK(visibility IN ('private','members')),
 pushed_visibility TEXT NOT NULL DEFAULT 'members' CHECK(pushed_visibility IN ('private','members')),
 PRIMARY KEY(campaign_id,kind,item_id)
);
INSERT INTO sync_shares_v3(campaign_id,kind,item_id,state,pushed_hash,remote_revision,visibility,pushed_visibility)
 SELECT campaign_id,kind,item_id,state,pushed_hash,remote_revision,visibility,pushed_visibility FROM sync_shares;
DROP TABLE sync_shares;
ALTER TABLE sync_shares_v3 RENAME TO sync_shares;

CREATE TABLE sync_remote_items_v3 (
 campaign_id TEXT NOT NULL REFERENCES sync_links(campaign_id),
 kind TEXT NOT NULL CHECK(kind IN ('page','session','relationship','party','sheetSection','image','clue')),
 item_id TEXT NOT NULL CHECK(length(item_id)=36),
 author_id TEXT NOT NULL CHECK(length(author_id) BETWEEN 1 AND 64),
 author_name TEXT NOT NULL CHECK(length(author_name) BETWEEN 1 AND 100),
 revision INTEGER NOT NULL CHECK(revision>=1),
 payload TEXT NOT NULL CHECK(json_valid(payload) AND length(payload)<=2100000),
 updated_at TEXT NOT NULL,
 visibility TEXT NOT NULL DEFAULT 'members' CHECK(visibility IN ('private','members')),
 PRIMARY KEY(campaign_id,kind,item_id)
);
INSERT INTO sync_remote_items_v3(campaign_id,kind,item_id,author_id,author_name,revision,payload,updated_at,visibility)
 SELECT campaign_id,kind,item_id,author_id,author_name,revision,payload,updated_at,visibility FROM sync_remote_items;
DROP TABLE sync_remote_items;
ALTER TABLE sync_remote_items_v3 RENAME TO sync_remote_items;

CREATE TABLE sync_conflicts_v3 (
 campaign_id TEXT NOT NULL REFERENCES sync_links(campaign_id),
 kind TEXT NOT NULL CHECK(kind IN ('page','session','relationship','party','sheetSection','image','clue')),
 item_id TEXT NOT NULL CHECK(length(item_id)=36),
 remote_revision INTEGER NOT NULL CHECK(remote_revision>=1),
 remote_payload TEXT NOT NULL CHECK(json_valid(remote_payload) AND length(remote_payload)<=2100000),
 detected_at TEXT NOT NULL,
 PRIMARY KEY(campaign_id,kind,item_id)
);
INSERT INTO sync_conflicts_v3(campaign_id,kind,item_id,remote_revision,remote_payload,detected_at)
 SELECT campaign_id,kind,item_id,remote_revision,remote_payload,detected_at FROM sync_conflicts;
DROP TABLE sync_conflicts;
ALTER TABLE sync_conflicts_v3 RENAME TO sync_conflicts;

CREATE TABLE sync_outbox_v3 (
 campaign_id TEXT NOT NULL REFERENCES sync_links(campaign_id),
 kind TEXT NOT NULL CHECK(kind IN ('page','session','relationship','party','sheetSection','image','clue')),
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
INSERT INTO sync_outbox_v3(campaign_id,kind,item_id,op,request_id,base_revision,visibility,payload,payload_hash,created_at)
 SELECT campaign_id,kind,item_id,op,request_id,base_revision,visibility,payload,payload_hash,created_at FROM sync_outbox;
DROP TABLE sync_outbox;
ALTER TABLE sync_outbox_v3 RENAME TO sync_outbox;


INSERT INTO schema_migrations(version) VALUES(22);
