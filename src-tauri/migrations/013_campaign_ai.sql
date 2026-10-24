CREATE TABLE campaign_ai_settings (
 campaign_id TEXT PRIMARY KEY REFERENCES campaigns(id),
 payload TEXT NOT NULL
);
-- Preserve the existing explicit M7 choice for existing campaigns only.
INSERT INTO campaign_ai_settings(campaign_id,payload)
 SELECT c.id,json_object('settings',json_object('enabled',json(CASE WHEN s.enabled=1 THEN 'true' ELSE 'false' END),'model',s.model,'digest',s.digest,'specialization',s.specialization),'edition','5e-2014','context',8192,'maxTokens',512,'includeKinds',json('["page","session","character","item","spell","ability"]'),'excludedIds',json('[]'),'ruleKeys',json('[]'),'indexedAt',NULL,'manifest',json('[]'))
 FROM campaigns c CROSS JOIN assistant_settings s WHERE s.id=1;
INSERT INTO schema_migrations(version) VALUES(13);
