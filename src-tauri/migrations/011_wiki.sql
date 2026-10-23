CREATE TABLE wiki_cache (
 key TEXT PRIMARY KEY,
 payload TEXT NOT NULL,
 fetched_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
INSERT INTO schema_migrations(version) VALUES(11);
