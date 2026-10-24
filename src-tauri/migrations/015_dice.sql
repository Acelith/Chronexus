CREATE TABLE dice_rolls (
 id TEXT PRIMARY KEY NOT NULL,
 campaign_id TEXT NOT NULL REFERENCES campaigns(id),
 created_at TEXT NOT NULL,
 payload TEXT NOT NULL CHECK(json_valid(payload))
);
CREATE INDEX dice_history ON dice_rolls(campaign_id, created_at DESC, id DESC);
INSERT INTO schema_migrations(version) VALUES(15);
