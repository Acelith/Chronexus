//! Player-authored uncertainties. Sources and linked pages are references, not assertions.
use crate::journal::{identifier, require_campaign, storage, title, AppResult};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Source {
    pub kind: String,
    pub id: String,
    pub block_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Input {
    pub kind: String,
    pub title: String,
    pub details: String,
    pub certainty: String,
    pub status: String,
    pub sources: Vec<Source>,
    pub page_ids: Vec<String>,
    pub resolution_session_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Clue {
    pub id: String,
    pub campaign_id: String,
    pub kind: String,
    pub title: String,
    pub details: String,
    pub certainty: String,
    pub status: String,
    pub sources: Vec<Source>,
    pub page_ids: Vec<String>,
    pub resolution_session_id: Option<String>,
    pub revision: i64,
    pub updated_at: String,
}

fn validate(c: &Connection, campaign: &str, input: &Input) -> AppResult<()> {
    require_campaign(c, campaign)?;
    title(&input.title)?;
    if !["question", "lead", "suspicion", "rumour"].contains(&input.kind.as_str())
        || !["confirmed", "suspected", "disproven", "unknown"].contains(&input.certainty.as_str())
        || !["open", "resolved", "disproven"].contains(&input.status.as_str())
        || (input.status == "disproven" && input.certainty != "disproven")
        || (input.status == "open" && input.resolution_session_id.is_some())
    {
        return Err("Choose a valid clue type, status and certainty.".into());
    }
    if input.details.chars().count() > 8000 || input.details.contains('\0') {
        return Err("Clue notes may contain up to 8,000 characters.".into());
    }
    if input.sources.len() > 20 || input.page_ids.len() > 20 {
        return Err("A clue can link up to 20 sources and 20 Codex pages.".into());
    }
    if let Some(id) = &input.resolution_session_id {
        identifier(id)?;
        let found: bool = c
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM sessions WHERE campaign_id=?1 AND id=?2)",
                params![campaign, id],
                |r| r.get(0),
            )
            .map_err(storage)?;
        if !found {
            return Err("Resolution session not found in this campaign.".into());
        }
    }
    let mut pages = HashSet::new();
    for id in &input.page_ids {
        identifier(id)?;
        if !pages.insert(id) {
            return Err("Choose each linked page only once.".into());
        }
        let found: bool = c
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM pages WHERE campaign_id=?1 AND id=?2)",
                params![campaign, id],
                |r| r.get(0),
            )
            .map_err(storage)?;
        if !found {
            return Err("Linked page not found in this campaign.".into());
        }
    }
    let mut sources = HashSet::new();
    for source in &input.sources {
        identifier(&source.id)?;
        if !["session", "page"].contains(&source.kind.as_str()) {
            return Err("Source must be a session or Codex page.".into());
        }
        let block = source.block_id.as_deref().unwrap_or("");
        if block.len() > 128 || block.contains('\0') {
            return Err("Invalid source block. Select it again in the note.".into());
        }
        if !sources.insert((&source.kind, &source.id, block)) {
            return Err("Choose each source only once.".into());
        }
        let table = if source.kind == "session" {
            "sessions"
        } else {
            "pages"
        };
        // Both table names are fixed here; all user values remain parameters.
        let found: bool = c
            .query_row(
                &format!("SELECT EXISTS(SELECT 1 FROM {table} WHERE campaign_id=?1 AND id=?2)"),
                params![campaign, source.id],
                |r| r.get(0),
            )
            .map_err(storage)?;
        if !found {
            return Err("Source not found in this campaign.".into());
        }
    }
    Ok(())
}

fn row(r: &rusqlite::Row<'_>) -> rusqlite::Result<Clue> {
    Ok(Clue {
        id: r.get(0)?,
        campaign_id: r.get(1)?,
        kind: r.get(2)?,
        title: r.get(3)?,
        details: r.get(4)?,
        certainty: r.get(5)?,
        status: r.get(6)?,
        resolution_session_id: r.get(7)?,
        revision: r.get(8)?,
        updated_at: r.get(9)?,
        sources: vec![],
        page_ids: vec![],
    })
}

fn hydrate(c: &Connection, clue: &mut Clue) -> AppResult<()> {
    let mut q = c
        .prepare("SELECT CASE WHEN source_session_id IS NOT NULL THEN 'session' ELSE 'page' END,coalesce(source_session_id,source_page_id),nullif(source_block_id,'') FROM clue_sources WHERE campaign_id=?1 AND clue_id=?2 ORDER BY 1,2,3")
        .map_err(storage)?;
    clue.sources = q
        .query_map(params![clue.campaign_id, clue.id], |r| {
            Ok(Source {
                kind: r.get(0)?,
                id: r.get(1)?,
                block_id: r.get(2)?,
            })
        })
        .map_err(storage)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(storage)?;
    let mut q = c
        .prepare(
            "SELECT page_id FROM clue_pages WHERE campaign_id=?1 AND clue_id=?2 ORDER BY page_id",
        )
        .map_err(storage)?;
    clue.page_ids = q
        .query_map(params![clue.campaign_id, clue.id], |r| r.get(0))
        .map_err(storage)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(storage)?;
    Ok(())
}

pub fn list(c: &Connection, campaign: &str) -> AppResult<Vec<Clue>> {
    require_campaign(c, campaign)?;
    let mut q = c
        .prepare("SELECT id,campaign_id,kind,title,details,certainty,status,resolution_session_id,revision,updated_at FROM clues WHERE campaign_id=?1 ORDER BY updated_at DESC,id")
        .map_err(storage)?;
    let mut clues = q
        .query_map([campaign], row)
        .map_err(storage)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(storage)?;
    for clue in &mut clues {
        hydrate(c, clue)?;
    }
    Ok(clues)
}

pub fn get(c: &Connection, campaign: &str, id: &str) -> AppResult<Clue> {
    identifier(campaign)?;
    identifier(id)?;
    let mut clue = c
        .query_row("SELECT id,campaign_id,kind,title,details,certainty,status,resolution_session_id,revision,updated_at FROM clues WHERE campaign_id=?1 AND id=?2", params![campaign,id], row)
        .optional()
        .map_err(storage)?
        .ok_or("Clue not found in this campaign.")?;
    hydrate(c, &mut clue)?;
    Ok(clue)
}

pub fn save(
    c: &Connection,
    campaign: &str,
    id: Option<&str>,
    revision: Option<i64>,
    input: Input,
) -> AppResult<Clue> {
    validate(c, campaign, &input)?;
    if let Some(id) = id {
        identifier(id)?;
    }
    let id = id
        .map(str::to_string)
        .unwrap_or_else(|| Uuid::new_v4().to_string());
    let tx = c.unchecked_transaction().map_err(storage)?;
    let existing: Option<i64> = tx
        .query_row(
            "SELECT revision FROM clues WHERE campaign_id=?1 AND id=?2",
            params![campaign, id],
            |r| r.get(0),
        )
        .optional()
        .map_err(storage)?;
    match (existing, revision) {
        (Some(current), Some(expected)) if current == expected => {
            tx.execute("UPDATE clues SET kind=?1,title=?2,details=?3,certainty=?4,status=?5,resolution_session_id=?6,revision=revision+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE campaign_id=?7 AND id=?8", params![input.kind,input.title.trim(),input.details,input.certainty,input.status,input.resolution_session_id,campaign,id]).map_err(storage)?;
            tx.execute(
                "DELETE FROM clue_sources WHERE campaign_id=?1 AND clue_id=?2",
                params![campaign, id],
            )
            .map_err(storage)?;
            tx.execute(
                "DELETE FROM clue_pages WHERE campaign_id=?1 AND clue_id=?2",
                params![campaign, id],
            )
            .map_err(storage)?;
        }
        (None, None) => {
            tx.execute("INSERT INTO clues(id,campaign_id,kind,title,details,certainty,status,resolution_session_id) VALUES(?1,?2,?3,?4,?5,?6,?7,?8)", params![id,campaign,input.kind,input.title.trim(),input.details,input.certainty,input.status,input.resolution_session_id]).map_err(storage)?;
        }
        _ => return Err("The clue changed elsewhere. Keep your draft and reload it.".into()),
    }
    for page in &input.page_ids {
        tx.execute(
            "INSERT INTO clue_pages(clue_id,campaign_id,page_id) VALUES(?1,?2,?3)",
            params![id, campaign, page],
        )
        .map_err(storage)?;
    }
    for source in &input.sources {
        tx.execute("INSERT INTO clue_sources(clue_id,campaign_id,source_session_id,source_page_id,source_block_id) VALUES(?1,?2,?3,?4,?5)", params![id,campaign,if source.kind=="session" {Some(source.id.as_str())} else {None},if source.kind=="page" {Some(source.id.as_str())} else {None},source.block_id.as_deref().unwrap_or("")]).map_err(storage)?;
    }
    crate::search::clue(&tx, campaign, &id)?;
    tx.commit().map_err(storage)?;
    get(c, campaign, &id)
}

pub fn delete(c: &Connection, campaign: &str, id: &str, revision: i64) -> AppResult<()> {
    identifier(campaign)?;
    identifier(id)?;
    let tx = c.unchecked_transaction().map_err(storage)?;
    let changed = tx
        .execute(
            "DELETE FROM clues WHERE campaign_id=?1 AND id=?2 AND revision=?3",
            params![campaign, id, revision],
        )
        .map_err(storage)?;
    if changed == 0 {
        return Err("The clue changed elsewhere. Reload before deleting it.".into());
    }
    crate::search::remove(&tx, campaign, "clue", id)?;
    tx.commit().map_err(storage)
}

pub fn validate_archive(c: &Connection) -> AppResult<()> {
    for campaign in crate::journal::list_campaigns(c)? {
        for clue in list(c, &campaign.id)? {
            identifier(&clue.id)?;
            validate(
                c,
                &campaign.id,
                &Input {
                    kind: clue.kind,
                    title: clue.title,
                    details: clue.details,
                    certainty: clue.certainty,
                    status: clue.status,
                    sources: clue.sources,
                    page_ids: clue.page_ids,
                    resolution_session_id: clue.resolution_session_id,
                },
            )?;
        }
    }
    Ok(())
}
