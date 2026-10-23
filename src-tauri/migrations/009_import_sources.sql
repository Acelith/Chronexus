CREATE TABLE import_sources (
 id TEXT PRIMARY KEY,
 campaign_id TEXT NOT NULL REFERENCES campaigns(id),
 page_id TEXT,
 session_id TEXT,
 name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 512),
 content TEXT NOT NULL,
 sha256 TEXT NOT NULL CHECK(length(sha256)=64),
 CHECK((page_id IS NOT NULL)!=(session_id IS NOT NULL)),
 UNIQUE(campaign_id,page_id),
 UNIQUE(campaign_id,session_id),
 FOREIGN KEY(campaign_id,page_id) REFERENCES pages(campaign_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(campaign_id,session_id) REFERENCES sessions(campaign_id,id) ON DELETE RESTRICT
);
INSERT INTO schema_migrations(version) VALUES(9);
