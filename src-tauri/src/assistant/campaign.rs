use super::store::{self, Settings, Source};
use crate::journal::{identifier, require_campaign, storage, AppResult};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

pub const KINDS: [&str; 6] = ["page", "session", "character", "item", "spell", "ability"];
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Stamp {
    pub key: String,
    pub hash: String,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Profile {
    pub settings: Settings,
    pub edition: String,
    pub context: u32,
    pub max_tokens: u32,
    pub include_kinds: Vec<String>,
    pub excluded_ids: Vec<String>,
    pub rule_keys: Vec<String>,
    pub indexed_at: Option<String>,
    pub manifest: Vec<Stamp>,
    /// Where questions run: "local" (this computer, the default) or "server" (the campaign's
    /// sharing server, server milestone M25.10). Archives before it have no value: local.
    #[serde(default = "local_execution")]
    pub execution: String,
    /// The model chosen among those the campaign's server allows; empty until chosen.
    #[serde(default)]
    pub server_model: String,
}
fn local_execution() -> String {
    "local".into()
}
impl Default for Profile {
    fn default() -> Self {
        Self {
            settings: Settings {
                enabled: false,
                model: String::new(),
                digest: String::new(),
                specialization: "multilingual-rag".into(),
            },
            edition: "5e-2014".into(),
            context: 8192,
            max_tokens: 512,
            include_kinds: KINDS.iter().map(|s| (*s).into()).collect(),
            excluded_ids: vec![],
            rule_keys: vec![],
            indexed_at: None,
            manifest: vec![],
            execution: local_execution(),
            server_model: String::new(),
        }
    }
}
pub fn get(c: &Connection, campaign: &str) -> AppResult<Profile> {
    require_campaign(c, campaign)?;
    let raw: Option<String> = c
        .query_row(
            "SELECT payload FROM campaign_ai_settings WHERE campaign_id=?1",
            [campaign],
            |r| r.get(0),
        )
        .optional()
        .map_err(storage)?;
    let p = match raw {
        Some(s) => serde_json::from_str(&s).map_err(|_| "Campaign AI settings unreadable.")?,
        None => Profile::default(),
    };
    validate(&p)?;
    Ok(p)
}
pub fn validate(p: &Profile) -> AppResult<()> {
    store::validate_settings(&p.settings)?;
    if !["5e-2014", "5e-2024", "3.5"].contains(&p.edition.as_str())
        || ![2048, 4096, 8192].contains(&p.context)
        || !(128..=1024).contains(&p.max_tokens)
    {
        return Err(
            "Invalid AI edition or limits: context 2048/4096/8192, answer 128–1024 tokens.".into(),
        );
    }
    if p.include_kinds.len() > 6
        || p.include_kinds.iter().any(|k| !KINDS.contains(&k.as_str()))
        || p.excluded_ids.len() > 2000
        || p.rule_keys.len() > 6
        || p.manifest.len() > 4000
        || p.indexed_at.as_ref().is_some_and(|s| s.len() > 40)
    {
        return Err("AI source preferences over the limits.".into());
    }
    if !["local", "server"].contains(&p.execution.as_str())
        || p.server_model.len() > 128
        || !p
            .server_model
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || "._:-/".contains(c))
    {
        return Err(
            "Choose where the assistant runs: this computer or the campaign's server.".into(),
        );
    }
    for id in &p.excluded_ids {
        identifier(id)?;
    }
    for key in &p.rule_keys {
        let wikidot = key
            .strip_prefix("wikidot/")
            .is_some_and(|p| crate::wikidot::category_of(p).is_some());
        if !(key.starts_with("entry/") || wikidot) || key.len() > 200 || key.contains("..") {
            return Err("Invalid rules source identity.".into());
        }
    }
    for s in &p.manifest {
        if s.key.len() > 400 || s.hash.len() != 64 || !s.hash.bytes().all(|b| b.is_ascii_hexdigit())
        {
            return Err("Invalid source fingerprint.".into());
        }
    }
    Ok(())
}
pub fn write(c: &Connection, campaign: &str, p: &Profile) -> AppResult<Profile> {
    require_campaign(c, campaign)?;
    validate(p)?;
    let raw = serde_json::to_string(p).map_err(|_| "Cannot save the AI preferences.")?;
    c.execute("INSERT INTO campaign_ai_settings(campaign_id,payload) VALUES(?1,?2) ON CONFLICT(campaign_id) DO UPDATE SET payload=excluded.payload",params![campaign,raw]).map_err(storage)?;
    get(c, campaign)
}
pub fn save_preferences(c: &Connection, campaign: &str, proposed: &Profile) -> AppResult<Profile> {
    let old = get(c, campaign)?;
    let mut p = proposed.clone();
    // Model identity and freshness are written only by verified backend actions.
    p.settings = old.settings;
    p.indexed_at = old.indexed_at;
    p.manifest = old.manifest;
    validate(&p)?;
    for id in &p.excluded_ids {
        let exists:bool=c.query_row("SELECT EXISTS(SELECT 1 FROM search_documents WHERE campaign_id=?1 AND source_id=?2)",params![campaign,id],|r|r.get(0)).map_err(storage)?;
        if !exists {
            return Err("The excluded source does not belong to this campaign.".into());
        }
    }
    for key in &p.rule_keys {
        let s = store::canonical(c, campaign, "wiki", key, None)?
            .ok_or("Rules source not available in the local cache.")?;
        if s.edition.as_deref() != Some(&p.edition) {
            return Err("Sources must belong to the selected edition.".into());
        }
    }
    write(c, campaign, &p)
}
pub fn allowed(p: &Profile, s: &Source) -> bool {
    if s.kind == "wiki" {
        p.rule_keys.contains(&s.source_id) && s.edition.as_deref() == Some(&p.edition)
    } else {
        p.include_kinds.contains(&s.kind) && !p.excluded_ids.contains(&s.source_id)
    }
}
pub fn snapshot(c: &Connection, campaign: &str, p: &Profile) -> AppResult<Vec<Source>> {
    require_campaign(c, campaign)?;
    let mut q=c.prepare("SELECT kind,source_id,NULLIF(block_id,'') FROM search_documents WHERE campaign_id=?1 AND kind IN (SELECT value FROM json_each(?2)) AND source_id NOT IN (SELECT value FROM json_each(?3)) AND (block_id<>'' OR kind NOT IN ('page','session')) ORDER BY kind,source_id,block_id LIMIT 4001").map_err(storage)?;
    let rows = q
        .query_map(
            params![
                campaign,
                serde_json::to_string(&p.include_kinds).map_err(|_| "Invalid source types.")?,
                serde_json::to_string(&p.excluded_ids).map_err(|_| "Invalid exclusions.")?
            ],
            |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, Option<String>>(2)?,
                ))
            },
        )
        .map_err(storage)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(storage)?;
    if rows.len() > 4000 {
        return Err(
            "Too many excerpts for a single training run (up to 4000). Reduce the sources.".into(),
        );
    }
    let mut out = vec![];
    for (kind, id, block) in rows {
        if !p.include_kinds.contains(&kind) || p.excluded_ids.contains(&id) {
            continue;
        }
        if let Some(mut s) = store::canonical(c, campaign, &kind, &id, block.as_deref())? {
            s.key = format!("{}:{}:{}", kind, id, block.unwrap_or_default());
            s.hash = store::hash(&format!("{}\n{}\n{}", s.title, s.revision, s.text));
            if !s.text.trim().is_empty() {
                out.push(s);
            }
        }
    }
    for key in &p.rule_keys {
        let mut s = store::canonical(c, campaign, "wiki", key, None)?
            .ok_or("An approved rules source is no longer cached: review the selection.")?;
        if !allowed(p, &s) {
            return Err("A rules source does not match the selected edition.".into());
        }
        s.key = format!("wiki:{key}");
        out.push(s);
    }
    if out.len() > 4000 {
        return Err(
            "The selection exceeds 4000 excerpts, rules included. Reduce the approved sources."
                .into(),
        );
    }
    Ok(out)
}
pub fn stamps(sources: &[Source]) -> Vec<Stamp> {
    sources
        .iter()
        .map(|s| Stamp {
            key: s.key.clone(),
            hash: s.hash.clone(),
        })
        .collect()
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Overview {
    pub profile: Profile,
    pub sources: Vec<Source>,
    pub added: usize,
    pub changed: usize,
    pub removed: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_error: Option<String>,
}
pub fn overview(c: &Connection, campaign: &str) -> AppResult<Overview> {
    let profile = get(c, campaign)?;
    let sources = match snapshot(c, campaign, &profile) {
        Ok(s) => s,
        Err(error) => {
            return Ok(Overview {
                profile,
                sources: vec![],
                added: 0,
                changed: 0,
                removed: 0,
                source_error: Some(error),
            })
        }
    };
    let now = stamps(&sources);
    let added = now
        .iter()
        .filter(|s| !profile.manifest.iter().any(|o| o.key == s.key))
        .count();
    let changed = now
        .iter()
        .filter(|s| {
            profile
                .manifest
                .iter()
                .any(|o| o.key == s.key && o.hash != s.hash)
        })
        .count();
    let removed = profile
        .manifest
        .iter()
        .filter(|o| !now.iter().any(|s| s.key == o.key))
        .count();
    Ok(Overview {
        profile,
        sources,
        added,
        changed,
        removed,
        source_error: None,
    })
}
pub fn refresh(c: &Connection, campaign: &str) -> AppResult<Overview> {
    crate::search::rebuild(c)?;
    let mut view = overview(c, campaign)?;
    if let Some(error) = view.source_error {
        return Err(error);
    }
    view.profile.manifest = stamps(&view.sources);
    view.profile.indexed_at = Some(
        c.query_row("SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now')", [], |r| {
            r.get(0)
        })
        .map_err(storage)?,
    );
    write(c, campaign, &view.profile)?;
    overview(c, campaign)
}
pub fn validate_archive(c: &Connection) -> AppResult<()> {
    for campaign in crate::journal::list_campaigns(c)? {
        get(c, &campaign.id)?;
    }
    Ok(())
}
