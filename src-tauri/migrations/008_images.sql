CREATE UNIQUE INDEX player_asset_campaign_id ON player_assets(campaign_id,id);
CREATE TABLE image_attachments (
 id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL REFERENCES campaigns(id),
 page_id TEXT, character_id TEXT, asset_id TEXT,
 caption TEXT NOT NULL CHECK(length(caption) BETWEEN 1 AND 200),
 role TEXT NOT NULL CHECK(role IN ('portrait','map','image','reference')),
 filename TEXT NOT NULL UNIQUE,
 width INTEGER NOT NULL CHECK(width BETWEEN 1 AND 8192),
 height INTEGER NOT NULL CHECK(height BETWEEN 1 AND 8192),
 size INTEGER NOT NULL CHECK(size BETWEEN 1 AND 20971520),
 sha256 TEXT NOT NULL CHECK(length(sha256)=64),
 created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 CHECK((page_id IS NOT NULL)+(character_id IS NOT NULL)+(asset_id IS NOT NULL)=1),
 FOREIGN KEY(campaign_id,page_id) REFERENCES pages(campaign_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(campaign_id,character_id) REFERENCES characters(campaign_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(campaign_id,asset_id) REFERENCES player_assets(campaign_id,id) ON DELETE RESTRICT
);
CREATE INDEX image_owner ON image_attachments(campaign_id,page_id,character_id,asset_id);
INSERT INTO schema_migrations(version) VALUES(8);
