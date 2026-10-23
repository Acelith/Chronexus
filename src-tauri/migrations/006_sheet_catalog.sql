-- Additive schema boundary for the expanded sheet and optional SRD cache.
CREATE TABLE catalog_cache (
    path TEXT PRIMARY KEY,
    payload TEXT NOT NULL CHECK(json_valid(payload)),
    fetched_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
INSERT INTO schema_migrations(version) VALUES (6);
