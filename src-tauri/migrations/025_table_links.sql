-- Only explicit local associations, never table state or GM content.
CREATE TABLE table_links (
 campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
 server TEXT NOT NULL, account_id TEXT NOT NULL, table_id TEXT NOT NULL,
 PRIMARY KEY(campaign_id,server,account_id,table_id)
) STRICT;
INSERT INTO schema_migrations(version) VALUES(25);
