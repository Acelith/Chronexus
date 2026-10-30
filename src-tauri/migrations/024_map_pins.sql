CREATE TABLE map_pins (
 id TEXT PRIMARY KEY,
 campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT,
 image_id TEXT NOT NULL REFERENCES image_attachments(id) ON DELETE CASCADE,
 page_id TEXT,
 session_id TEXT,
 clue_id TEXT,
 label TEXT NOT NULL CHECK(length(trim(label)) BETWEEN 1 AND 200),
 x INTEGER NOT NULL CHECK(x BETWEEN 0 AND 1000000),
 y INTEGER NOT NULL CHECK(y BETWEEN 0 AND 1000000),
 revision INTEGER NOT NULL DEFAULT 0 CHECK(revision>=0),
 CHECK((page_id IS NOT NULL)+(session_id IS NOT NULL)+(clue_id IS NOT NULL)=1),
 FOREIGN KEY(campaign_id,page_id) REFERENCES pages(campaign_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(campaign_id,session_id) REFERENCES sessions(campaign_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(campaign_id,clue_id) REFERENCES clues(campaign_id,id) ON DELETE CASCADE,
 UNIQUE(image_id,id)
);
CREATE INDEX map_pins_image ON map_pins(image_id);
CREATE TABLE map_routes (
 id TEXT PRIMARY KEY,
 campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT,
 image_id TEXT NOT NULL REFERENCES image_attachments(id) ON DELETE CASCADE,
 from_pin_id TEXT NOT NULL,
 to_pin_id TEXT NOT NULL,
 label TEXT NOT NULL DEFAULT '' CHECK(length(label)<=200),
 revision INTEGER NOT NULL DEFAULT 0 CHECK(revision>=0),
 CHECK(from_pin_id!=to_pin_id),
 FOREIGN KEY(image_id,from_pin_id) REFERENCES map_pins(image_id,id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
 FOREIGN KEY(image_id,to_pin_id) REFERENCES map_pins(image_id,id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
 UNIQUE(campaign_id,id)
);
CREATE INDEX map_routes_image ON map_routes(image_id);
INSERT INTO schema_migrations(version) VALUES(24);
