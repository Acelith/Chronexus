CREATE TABLE campaign_ai_training (
 id TEXT PRIMARY KEY,
 campaign_id TEXT NOT NULL REFERENCES campaigns(id),
 payload TEXT NOT NULL
);
CREATE INDEX campaign_ai_training_history ON campaign_ai_training(campaign_id);
INSERT INTO schema_migrations(version) VALUES(14);
