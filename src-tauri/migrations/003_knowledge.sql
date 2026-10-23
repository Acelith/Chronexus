CREATE TABLE pages (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT,
    title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 200),
    title_key TEXT NOT NULL,
    kind TEXT NOT NULL CHECK(kind IN ('npc','place','faction','quest','item','event','lore','note')),
    status TEXT NOT NULL CHECK(status IN ('stub','active')),
    document TEXT NOT NULL CHECK(json_valid(document)),
    revision INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    UNIQUE(campaign_id,title_key),
    UNIQUE(campaign_id,id)
);
CREATE TABLE page_aliases (
    page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE RESTRICT,
    alias TEXT NOT NULL,
    alias_key TEXT NOT NULL,
    PRIMARY KEY(page_id,alias_key)
);
CREATE INDEX page_alias_lookup ON page_aliases(alias_key);
CREATE UNIQUE INDEX session_campaign_id ON sessions(campaign_id,id);
CREATE TABLE mentions (
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT,
    source_session_id TEXT,
    source_page_id TEXT,
    source_block_id TEXT NOT NULL,
    target_page_id TEXT NOT NULL,
    preview TEXT NOT NULL,
    CHECK((source_session_id IS NULL) != (source_page_id IS NULL)),
    FOREIGN KEY(campaign_id,source_session_id) REFERENCES sessions(campaign_id,id) ON DELETE CASCADE,
    FOREIGN KEY(campaign_id,source_page_id) REFERENCES pages(campaign_id,id) ON DELETE CASCADE
);
-- A missing target is retained by ID for explicit recovery; backend rejects cross-campaign targets.
CREATE UNIQUE INDEX session_mentions ON mentions(source_session_id,source_block_id,target_page_id);
CREATE UNIQUE INDEX page_mentions ON mentions(source_page_id,source_block_id,target_page_id);
CREATE INDEX mention_backlinks ON mentions(campaign_id,target_page_id);
INSERT INTO schema_migrations(version) VALUES (3);
