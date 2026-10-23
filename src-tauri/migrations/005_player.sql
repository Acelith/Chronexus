CREATE TABLE characters (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL UNIQUE REFERENCES campaigns(id) ON DELETE RESTRICT,
    data TEXT NOT NULL CHECK(json_valid(data)),
    revision INTEGER NOT NULL DEFAULT 0 CHECK(revision >= 0),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    UNIQUE(campaign_id,id)
);
CREATE TABLE player_assets (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    character_id TEXT NOT NULL,
    details TEXT NOT NULL CHECK(json_valid(details) AND json_extract(details,'$.kind') IN ('item','spell','ability')),
    page_id TEXT,
    source_session_id TEXT,
    source_block_id TEXT,
    npc_id TEXT,
    place_id TEXT,
    quest_id TEXT,
    provenance_notes TEXT NOT NULL DEFAULT '',
    revision INTEGER NOT NULL DEFAULT 0 CHECK(revision >= 0),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    CHECK(source_block_id IS NULL OR source_session_id IS NOT NULL),
    FOREIGN KEY(campaign_id,character_id) REFERENCES characters(campaign_id,id) ON DELETE RESTRICT,
    FOREIGN KEY(campaign_id,page_id) REFERENCES pages(campaign_id,id) ON DELETE RESTRICT,
    FOREIGN KEY(campaign_id,source_session_id) REFERENCES sessions(campaign_id,id) ON DELETE RESTRICT,
    FOREIGN KEY(campaign_id,npc_id) REFERENCES pages(campaign_id,id) ON DELETE RESTRICT,
    FOREIGN KEY(campaign_id,place_id) REFERENCES pages(campaign_id,id) ON DELETE RESTRICT,
    FOREIGN KEY(campaign_id,quest_id) REFERENCES pages(campaign_id,id) ON DELETE RESTRICT
);
CREATE INDEX player_assets_character ON player_assets(campaign_id,character_id);
INSERT INTO schema_migrations(version) VALUES (5);
