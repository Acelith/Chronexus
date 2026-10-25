-- Derived translations never replace provider originals or campaign sources.
CREATE TABLE wiki_translations (
 provider TEXT NOT NULL CHECK(provider IN ('wikidot','open5e')),
 source_key TEXT NOT NULL,
 locale TEXT NOT NULL,
 source_hash TEXT NOT NULL,
 payload TEXT NOT NULL CHECK(length(payload) <= 262144),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 PRIMARY KEY(provider,source_key,locale)
);
INSERT INTO schema_migrations(version) VALUES(17);
