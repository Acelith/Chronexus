CREATE TABLE world_calendars (
 campaign_id TEXT PRIMARY KEY REFERENCES campaigns(id) ON DELETE RESTRICT,
 months_json TEXT NOT NULL CHECK(json_valid(months_json)),
 weekdays_json TEXT NOT NULL CHECK(json_valid(weekdays_json)),
 eras_json TEXT NOT NULL CHECK(json_valid(eras_json))
);
CREATE TABLE timeline_entries (
 id TEXT PRIMARY KEY,
 campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT,
 session_id TEXT,
 page_id TEXT,
 clue_id TEXT,
 era TEXT NOT NULL DEFAULT '',
 year INTEGER,
 month INTEGER,
 day INTEGER,
 precision TEXT NOT NULL CHECK(precision IN ('exact','approximate','unknown')),
 note TEXT NOT NULL DEFAULT '' CHECK(length(note)<=1000),
 revision INTEGER NOT NULL DEFAULT 0 CHECK(revision>=0),
 CHECK((session_id IS NOT NULL)+(page_id IS NOT NULL)+(clue_id IS NOT NULL)=1),
 CHECK((precision='unknown' AND year IS NULL AND month IS NULL AND day IS NULL) OR
       (precision!='unknown' AND year BETWEEN -999999 AND 999999 AND month BETWEEN 1 AND 24 AND day BETWEEN 1 AND 366)),
 FOREIGN KEY(campaign_id,session_id) REFERENCES sessions(campaign_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(campaign_id,page_id) REFERENCES pages(campaign_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(campaign_id,clue_id) REFERENCES clues(campaign_id,id) ON DELETE CASCADE,
 UNIQUE(campaign_id,id)
);
CREATE INDEX timeline_order ON timeline_entries(campaign_id,era,year,month,day);
INSERT INTO schema_migrations(version) VALUES(23);
