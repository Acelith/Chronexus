CREATE TABLE search_documents (
 id INTEGER PRIMARY KEY, campaign_id TEXT NOT NULL REFERENCES campaigns(id),
 kind TEXT NOT NULL, source_id TEXT NOT NULL, block_id TEXT NOT NULL DEFAULT '',
 title TEXT NOT NULL, body TEXT NOT NULL, updated_at TEXT NOT NULL,
 UNIQUE(campaign_id,kind,source_id,block_id)
);
CREATE VIRTUAL TABLE search_fts USING fts5(title,body,content='search_documents',content_rowid='id',tokenize='unicode61 remove_diacritics 2');
CREATE TRIGGER search_insert AFTER INSERT ON search_documents BEGIN
 INSERT INTO search_fts(rowid,title,body) VALUES(new.id,new.title,new.body);
END;
CREATE TRIGGER search_delete AFTER DELETE ON search_documents BEGIN
 INSERT INTO search_fts(search_fts,rowid,title,body) VALUES('delete',old.id,old.title,old.body);
END;
CREATE TRIGGER search_update AFTER UPDATE ON search_documents BEGIN
 INSERT INTO search_fts(search_fts,rowid,title,body) VALUES('delete',old.id,old.title,old.body);
 INSERT INTO search_fts(rowid,title,body) VALUES(new.id,new.title,new.body);
END;
CREATE INDEX search_campaign ON search_documents(campaign_id,kind,source_id);
INSERT INTO schema_migrations(version) VALUES(7);
