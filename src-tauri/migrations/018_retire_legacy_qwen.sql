-- Keep historical model/digest and conversations. Activation of the replacement
-- still requires explicit, verified user selection, including after old restores.
UPDATE assistant_settings SET enabled=0
 WHERE lower(model) LIKE 'qwen%' AND model<>'qwen3.8:27b-q4_K_M';
UPDATE campaign_ai_settings SET payload=json_set(payload,'$.settings.enabled',json('false'))
 WHERE lower(json_extract(payload,'$.settings.model')) LIKE 'qwen%'
 AND json_extract(payload,'$.settings.model')<>'qwen3.8:27b-q4_K_M';
INSERT INTO schema_migrations(version) VALUES(18);
