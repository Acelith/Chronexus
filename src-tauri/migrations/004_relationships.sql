CREATE TABLE relationships (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT,
    from_page_id TEXT NOT NULL,
    to_page_id TEXT NOT NULL,
    label TEXT NOT NULL CHECK(length(trim(label)) BETWEEN 1 AND 100),
    certainty TEXT NOT NULL CHECK(certainty IN ('confirmed','suspected','disproven','unknown')),
    source_session_id TEXT,
    source_page_id TEXT,
    source_block_id TEXT,
    evidence TEXT NOT NULL DEFAULT '' CHECK(length(evidence)<=4000),
    notes TEXT NOT NULL DEFAULT '' CHECK(length(notes)<=4000),
    revision INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    CHECK(source_session_id IS NULL OR source_page_id IS NULL),
    CHECK(source_block_id IS NULL OR source_session_id IS NOT NULL OR source_page_id IS NOT NULL),
    FOREIGN KEY(campaign_id,from_page_id) REFERENCES pages(campaign_id,id) ON DELETE RESTRICT,
    FOREIGN KEY(campaign_id,to_page_id) REFERENCES pages(campaign_id,id) ON DELETE RESTRICT,
    FOREIGN KEY(campaign_id,source_session_id) REFERENCES sessions(campaign_id,id) ON DELETE RESTRICT,
    FOREIGN KEY(campaign_id,source_page_id) REFERENCES pages(campaign_id,id) ON DELETE RESTRICT
);
CREATE INDEX relationship_campaign_endpoints ON relationships(campaign_id,from_page_id,to_page_id);
CREATE INDEX relationship_session ON relationships(campaign_id,source_session_id);
INSERT INTO schema_migrations(version) VALUES (4);
