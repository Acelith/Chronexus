CREATE TABLE party_members (
 campaign_id TEXT NOT NULL,
 page_id TEXT NOT NULL,
 player_name TEXT NOT NULL DEFAULT '',
 role TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL CHECK(status IN ('active','former','unknown')),
 revision INTEGER NOT NULL DEFAULT 0 CHECK(revision>=0),
 PRIMARY KEY(campaign_id,page_id),
 FOREIGN KEY(campaign_id,page_id) REFERENCES pages(campaign_id,id) ON DELETE RESTRICT
);
INSERT INTO schema_migrations(version) VALUES(10);
