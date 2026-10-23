CREATE TABLE assistant_settings (
 id INTEGER PRIMARY KEY CHECK(id=1),
 enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
 model TEXT NOT NULL DEFAULT '',
 digest TEXT NOT NULL DEFAULT '',
 specialization TEXT NOT NULL DEFAULT 'multilingual-rag',
 CHECK(enabled=0 OR (length(model)>0 AND length(digest)=64))
);
INSERT INTO assistant_settings(id) VALUES(1);
CREATE TABLE assistant_turns (
 id TEXT PRIMARY KEY,
 campaign_id TEXT NOT NULL REFERENCES campaigns(id),
 question TEXT NOT NULL,
 mode TEXT NOT NULL CHECK(mode IN ('campaign','rules')),
 edition TEXT,
 model TEXT NOT NULL,
 digest TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('running','complete','cancelled','error','no_sources','interrupted')),
 answer TEXT NOT NULL DEFAULT '',
 sources TEXT NOT NULL,
 metrics TEXT NOT NULL DEFAULT '{}',
 error TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT(strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX assistant_campaign_history ON assistant_turns(campaign_id,created_at);
INSERT INTO schema_migrations(version) VALUES(12);
