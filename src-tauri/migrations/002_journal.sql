CREATE TABLE campaigns (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 200),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT,
    sequence INTEGER NOT NULL CHECK(sequence BETWEEN 1 AND 999999),
    title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 200),
    played_on TEXT,
    document TEXT NOT NULL CHECK(json_valid(document)),
    revision INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE(campaign_id, sequence)
);
CREATE INDEX sessions_campaign_order ON sessions(campaign_id, sequence);
INSERT INTO schema_migrations(version) VALUES (2);
