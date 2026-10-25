-- Disposable cache of explicitly consulted public Wikidot pages, parsed into
-- inert text blocks. Separate from the Open5e cache so it can be cleared alone.
CREATE TABLE wikidot_cache (
 key TEXT PRIMARY KEY CHECK (key LIKE 'index/%' OR key LIKE 'entry/%'),
 payload TEXT NOT NULL,
 fetched_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
INSERT INTO schema_migrations(version) VALUES(16);
