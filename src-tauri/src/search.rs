use crate::{
    journal::{require_campaign, storage, AppResult},
    knowledge, player,
};
use rusqlite::{params, Connection};
use serde::Serialize;
use serde_json::Value;

fn available(c: &Connection) -> AppResult<bool> {
    c.query_row(
        "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE name='search_documents')",
        [],
        |r| r.get(0),
    )
    .map_err(storage)
}
pub fn remove(c: &Connection, campaign: &str, kind: &str, id: &str) -> AppResult<()> {
    if available(c)? {
        c.execute(
            "DELETE FROM search_documents WHERE campaign_id=?1 AND kind=?2 AND source_id=?3",
            params![campaign, kind, id],
        )
        .map_err(storage)?;
    }
    Ok(())
}
#[allow(clippy::too_many_arguments)] // A single derived row, with explicit ownership fields.
fn insert(
    c: &Connection,
    campaign: &str,
    kind: &str,
    id: &str,
    block: &str,
    title: &str,
    body: &str,
    updated: &str,
) -> AppResult<()> {
    c.execute("INSERT INTO search_documents(campaign_id,kind,source_id,block_id,title,body,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7)",params![campaign,kind,id,block,title,body,updated]).map_err(storage)?;
    Ok(())
}
pub fn inline_text(content: &Value) -> String {
    let mut out = String::new();
    if let Some(items) = content.as_array() {
        for item in items {
            match item["type"].as_str() {
                Some("text") => out.push_str(item["text"].as_str().unwrap_or("")),
                Some("pageMention") => out.push_str(item["props"]["label"].as_str().unwrap_or("")),
                Some("link") => out.push_str(&inline_text(&item["content"])),
                _ => {}
            }
        }
    }
    out
}
#[allow(clippy::too_many_arguments)] // Keeps canonical metadata and block indexing in one transaction.
fn document(
    c: &Connection,
    campaign: &str,
    kind: &str,
    id: &str,
    title: &str,
    extra: &str,
    updated: &str,
    doc: &Value,
) -> AppResult<()> {
    remove(c, campaign, kind, id)?;
    insert(c, campaign, kind, id, "", title, extra, updated)?;
    struct Context<'a> {
        c: &'a Connection,
        campaign: &'a str,
        kind: &'a str,
        id: &'a str,
        title: &'a str,
        updated: &'a str,
    }
    fn visit(ctx: &Context<'_>, blocks: &Value) -> AppResult<()> {
        if let Some(blocks) = blocks.as_array() {
            for b in blocks {
                let text = inline_text(&b["content"]);
                if !text.trim().is_empty() {
                    insert(
                        ctx.c,
                        ctx.campaign,
                        ctx.kind,
                        ctx.id,
                        b["id"].as_str().unwrap_or(""),
                        ctx.title,
                        &text,
                        ctx.updated,
                    )?;
                }
                visit(ctx, &b["children"])?;
            }
        }
        Ok(())
    }
    visit(
        &Context {
            c,
            campaign,
            kind,
            id,
            title,
            updated,
        },
        &doc["blocks"],
    )
}
pub fn session(c: &Connection, campaign: &str, id: &str) -> AppResult<()> {
    if !available(c)? {
        return Ok(());
    }
    let s = crate::journal::get_session(c, campaign, id)?;
    document(
        c,
        campaign,
        "session",
        id,
        &s.title,
        &format!("Session {}", s.sequence),
        &s.updated_at,
        &s.document,
    )
}
pub fn page(c: &Connection, campaign: &str, id: &str) -> AppResult<()> {
    if !available(c)? {
        return Ok(());
    }
    let p = knowledge::get_page(c, campaign, id)?;
    document(
        c,
        campaign,
        "page",
        id,
        &p.title,
        &p.aliases.join(" "),
        &p.updated_at,
        &p.document,
    )
}
fn user_text(value: &Value) -> String {
    match value {
        Value::String(s) => s.clone(),
        Value::Array(items) => items.iter().map(user_text).collect::<Vec<_>>().join(" "),
        Value::Object(fields) => fields
            .iter()
            .filter(|(k, _)| !["id", "systemId", "catalogSource"].contains(&k.as_str()))
            .map(|(_, v)| user_text(v))
            .collect::<Vec<_>>()
            .join(" "),
        _ => String::new(),
    }
}
pub fn character(c: &Connection, campaign: &str) -> AppResult<()> {
    if !available(c)? {
        return Ok(());
    }
    if let Some(pc) = player::get_character(c, campaign)? {
        remove(c, campaign, "character", &pc.id)?;
        let updated: String = c
            .query_row(
                "SELECT updated_at FROM characters WHERE id=?1",
                [&pc.id],
                |r| r.get(0),
            )
            .map_err(storage)?;
        insert(
            c,
            campaign,
            "character",
            &pc.id,
            "",
            &pc.data.name,
            &user_text(&serde_json::to_value(&pc.data).map_err(|_| "Sheet unreadable.")?),
            &updated,
        )?;
    }
    Ok(())
}
pub fn asset(c: &Connection, campaign: &str, id: &str) -> AppResult<()> {
    if !available(c)? {
        return Ok(());
    }
    let (raw,notes,updated):(String,String,String)=c.query_row("SELECT details,provenance_notes,updated_at FROM player_assets WHERE campaign_id=?1 AND id=?2",params![campaign,id],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?))).map_err(storage)?;
    let data: Value = serde_json::from_str(&raw).map_err(|_| "Entry unreadable.")?;
    let kind = data["kind"].as_str().ok_or("Invalid entry type.")?;
    remove(c, campaign, kind, id)?;
    insert(
        c,
        campaign,
        kind,
        id,
        "",
        data["name"].as_str().unwrap_or(""),
        &format!("{} {notes}", user_text(&data)),
        &updated,
    )
}
pub fn rebuild_all(c: &Connection) -> AppResult<i64> {
    if !available(c)? {
        return Ok(0);
    }
    // Repair the FTS side from its content table before replacing derived rows.
    c.execute("INSERT INTO search_fts(search_fts) VALUES('rebuild')", [])
        .map_err(storage)?;
    c.execute("DELETE FROM search_documents", [])
        .map_err(storage)?;
    for campaign in crate::journal::list_campaigns(c)? {
        for s in crate::journal::list_sessions(c, &campaign.id)? {
            session(c, &campaign.id, &s.id)?;
        }
        for p in knowledge::list_pages(c, &campaign.id)? {
            page(c, &campaign.id, &p.id)?;
        }
        character(c, &campaign.id)?;
        if let Some(pc) = player::get_character(c, &campaign.id)? {
            for a in player::list_assets(c, &campaign.id, &pc.id)? {
                asset(c, &campaign.id, &a.id)?;
            }
        }
    }
    c.query_row("SELECT COUNT(*) FROM search_documents", [], |r| r.get(0))
        .map_err(storage)
}
pub fn rebuild(c: &Connection) -> AppResult<i64> {
    let tx = c.unchecked_transaction().map_err(storage)?;
    let count = rebuild_all(&tx)?;
    tx.commit().map_err(storage)?;
    Ok(count)
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub kind: String,
    pub source_id: String,
    pub block_id: Option<String>,
    pub title: String,
    pub preview: String,
    pub updated_at: String,
}
pub fn find(
    c: &Connection,
    campaign: &str,
    query: &str,
    kind: Option<&str>,
    sort: &str,
) -> AppResult<Vec<SearchResult>> {
    require_campaign(c, campaign)?;
    if query.chars().count() > 200
        || !["relevance", "recent"].contains(&sort)
        || kind.is_some_and(|k| {
            !["session", "page", "character", "item", "spell", "ability"].contains(&k)
        })
    {
        return Err("Invalid filters or search text.".into());
    }
    let terms: Vec<_> = query
        .split_whitespace()
        .take(12)
        .map(|s| format!("\"{}\"*", s.replace('"', "\"\"")))
        .collect();
    if terms.is_empty() {
        return Ok(vec![]);
    }
    let expression = terms.join(" AND ");
    let mut q=c.prepare("SELECT d.kind,d.source_id,NULLIF(d.block_id,''),d.title,snippet(search_fts,1,'','',' … ',24),d.updated_at FROM search_fts JOIN search_documents d ON d.id=search_fts.rowid WHERE search_fts MATCH ?1 AND d.campaign_id=?2 AND (?3 IS NULL OR d.kind=?3) ORDER BY CASE WHEN ?4='relevance' THEN bm25(search_fts,5.0,1.0) ELSE 0 END, d.updated_at DESC,d.id LIMIT 100").map_err(storage)?;
    let rows = q
        .query_map(params![expression, campaign, kind, sort], |r| {
            Ok(SearchResult {
                kind: r.get(0)?,
                source_id: r.get(1)?,
                block_id: r.get(2)?,
                title: r.get(3)?,
                preview: r.get(4)?,
                updated_at: r.get(5)?,
            })
        })
        .map_err(storage)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(storage)?;
    Ok(rows)
}
