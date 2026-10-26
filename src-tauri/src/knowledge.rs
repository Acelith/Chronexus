use crate::journal::{
    empty_document, identifier, require_campaign, storage, title, validate_document, AppResult,
};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashSet;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Page {
    pub id: String,
    pub campaign_id: String,
    pub title: String,
    pub kind: String,
    pub status: String,
    pub aliases: Vec<String>,
    pub document: Value,
    pub revision: i64,
    pub updated_at: String,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Backlink {
    pub source_kind: String,
    pub source_id: String,
    pub source_title: String,
    pub sequence: Option<i64>,
    pub block_id: String,
    pub preview: String,
}
#[derive(Debug, PartialEq)]
pub struct Mention {
    pub block_id: String,
    pub target_id: String,
    pub label: String,
    pub preview: String,
}

fn key(value: &str) -> String {
    value
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}
fn validate_kind(kind: &str, status: &str) -> AppResult<()> {
    if ![
        "npc", "place", "faction", "quest", "item", "event", "lore", "note",
    ]
    .contains(&kind)
        || !["stub", "active"].contains(&status)
    {
        return Err("Invalid page type or status.".into());
    }
    Ok(())
}
fn aliases(connection: &Connection, id: &str) -> AppResult<Vec<String>> {
    let mut statement = connection
        .prepare("SELECT alias FROM page_aliases WHERE page_id=?1 ORDER BY alias_key")
        .map_err(storage)?;
    let rows = statement
        .query_map([id], |row| row.get(0))
        .map_err(storage)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(storage);
    rows
}
fn page_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Page> {
    let raw: String = row.get(5)?;
    let document = serde_json::from_str(&raw).map_err(|error| {
        rusqlite::Error::FromSqlConversionFailure(5, rusqlite::types::Type::Text, Box::new(error))
    })?;
    Ok(Page {
        id: row.get(0)?,
        campaign_id: row.get(1)?,
        title: row.get(2)?,
        kind: row.get(3)?,
        status: row.get(4)?,
        document,
        revision: row.get(6)?,
        updated_at: row.get(7)?,
        aliases: vec![],
    })
}
pub fn list_pages(connection: &Connection, campaign_id: &str) -> AppResult<Vec<Page>> {
    require_campaign(connection, campaign_id)?;
    let mut statement = connection.prepare("SELECT id,campaign_id,title,kind,status,document,revision,updated_at FROM pages WHERE campaign_id=?1 ORDER BY title_key,id").map_err(storage)?;
    let mut pages = statement
        .query_map([campaign_id], page_row)
        .map_err(storage)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(storage)?;
    // One query for every alias of the campaign instead of one per page.
    let mut by_page: std::collections::HashMap<String, Vec<String>> = Default::default();
    let mut statement = connection
        .prepare("SELECT a.page_id,a.alias FROM page_aliases a JOIN pages p ON p.id=a.page_id WHERE p.campaign_id=?1 ORDER BY a.page_id,a.alias_key")
        .map_err(storage)?;
    let rows = statement
        .query_map([campaign_id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(storage)?;
    for row in rows {
        let (page, alias) = row.map_err(storage)?;
        by_page.entry(page).or_default().push(alias);
    }
    for page in &mut pages {
        page.aliases = by_page.remove(&page.id).unwrap_or_default();
    }
    Ok(pages)
}
pub fn get_page(connection: &Connection, campaign_id: &str, id: &str) -> AppResult<Page> {
    identifier(campaign_id)?;
    identifier(id)?;
    let mut page = connection.query_row("SELECT id,campaign_id,title,kind,status,document,revision,updated_at FROM pages WHERE campaign_id=?1 AND id=?2",params![campaign_id,id],page_row).optional().map_err(storage)?.ok_or("Page not found in this campaign.")?;
    page.aliases = aliases(connection, id)?;
    Ok(page)
}
fn ensure_available(
    connection: &Connection,
    campaign_id: &str,
    name: &str,
    own_id: &str,
) -> AppResult<()> {
    let found: bool = connection.query_row("SELECT EXISTS(SELECT 1 FROM pages p WHERE p.campaign_id=?1 AND p.id!=?3 AND (p.title_key=?2 OR EXISTS(SELECT 1 FROM page_aliases a WHERE a.page_id=p.id AND a.alias_key=?2)))",params![campaign_id,key(name),own_id],|row|row.get(0)).map_err(storage)?;
    if found {
        return Err("This name is already a title or alias in the Codex. Select the existing page or use a different title.".into());
    }
    Ok(())
}
fn write_aliases(
    connection: &Connection,
    id: &str,
    values: &[String],
    name: &str,
) -> AppResult<()> {
    if values.len() > 20 {
        return Err("You can enter up to 20 aliases per page.".into());
    }
    let mut normalized = HashSet::new();
    for alias in values {
        title(alias)?;
        normalized.insert(key(alias));
    }
    connection
        .execute("DELETE FROM page_aliases WHERE page_id=?1", [id])
        .map_err(storage)?;
    for alias in values {
        let normalized = key(alias);
        if normalized != key(name) {
            connection
                .execute(
                    "INSERT OR IGNORE INTO page_aliases(page_id,alias,alias_key) VALUES (?1,?2,?3)",
                    params![id, alias.trim(), normalized],
                )
                .map_err(storage)?;
        }
    }
    Ok(())
}
pub fn create_page(
    connection: &Connection,
    campaign_id: &str,
    name: &str,
    kind: &str,
    status: &str,
    alias_values: &[String],
) -> AppResult<Page> {
    let tx = connection.unchecked_transaction().map_err(storage)?;
    let page = create_page_in_transaction(&tx, campaign_id, name, kind, status, alias_values)?;
    tx.commit().map_err(storage)?;
    Ok(page)
}
pub(crate) fn create_page_in_transaction(
    connection: &Connection,
    campaign_id: &str,
    name: &str,
    kind: &str,
    status: &str,
    alias_values: &[String],
) -> AppResult<Page> {
    require_campaign(connection, campaign_id)?;
    let name = title(name)?;
    validate_kind(kind, status)?;
    let id = Uuid::new_v4().to_string();
    ensure_available(connection, campaign_id, name, "")?;
    connection.execute("INSERT INTO pages(id,campaign_id,title,title_key,kind,status,document) VALUES (?1,?2,?3,?4,?5,?6,?7)",params![id,campaign_id,name,key(name),kind,status,empty_document().to_string()]).map_err(storage)?;
    write_aliases(connection, &id, alias_values, name)?;
    crate::search::page(connection, campaign_id, &id)?;
    get_page(connection, campaign_id, &id)
}

#[derive(Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Metadata {
    pub title: String,
    pub kind: String,
    pub status: String,
    pub aliases: Vec<String>,
}
pub fn update_page_checked(
    c: &Connection,
    campaign: &str,
    id: &str,
    input: Metadata,
    expected: Metadata,
) -> AppResult<Page> {
    let old = get_page(c, campaign, id)?;
    let current = Metadata {
        title: old.title,
        kind: old.kind,
        status: old.status,
        aliases: old.aliases,
    };
    if current != expected {
        return Err(
            "The page metadata changed elsewhere. Keep your draft and reopen the form.".into(),
        );
    }
    update_page(
        c,
        campaign,
        id,
        &input.title,
        &input.kind,
        &input.status,
        &input.aliases,
    )
}

pub fn update_page(
    connection: &Connection,
    campaign_id: &str,
    id: &str,
    name: &str,
    kind: &str,
    status: &str,
    alias_values: &[String],
) -> AppResult<Page> {
    let old = get_page(connection, campaign_id, id)?;
    let name = title(name)?;
    validate_kind(kind, status)?;
    let transaction = connection.unchecked_transaction().map_err(storage)?;
    ensure_available(&transaction, campaign_id, name, id)?;
    // Preserve the previous title as an alias so future searches can still find it.
    let mut values = alias_values.to_vec();
    if key(&old.title) != key(name) && !values.iter().any(|alias| key(alias) == key(&old.title)) {
        if values.len() >= 20 {
            return Err("This page already has 20 aliases. Remove one so the previous title can be kept as an alias, then rename it.".into());
        }
        values.push(old.title);
    }
    write_aliases(&transaction, id, &values, name)?;
    transaction.execute("UPDATE pages SET title=?1,title_key=?2,kind=?3,status=?4,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?5 AND campaign_id=?6",params![name,key(name),kind,status,id,campaign_id]).map_err(storage)?;
    crate::search::page(&transaction, campaign_id, id)?;
    transaction.commit().map_err(storage)?;
    get_page(connection, campaign_id, id)
}

pub fn extract_mentions(document: &Value) -> AppResult<Vec<Mention>> {
    validate_document(document)?;
    fn visit(blocks: &[Value], output: &mut Vec<Mention>) {
        for block in blocks {
            let mut preview = String::new();
            let mut targets = Vec::new();
            for inline in block["content"].as_array().unwrap() {
                match inline["type"].as_str() {
                    Some("text") => preview.push_str(inline["text"].as_str().unwrap()),
                    Some("link") => {
                        for text in inline["content"].as_array().unwrap() {
                            preview.push_str(text["text"].as_str().unwrap());
                        }
                    }
                    Some("pageMention") => {
                        let id = inline["props"]["pageId"].as_str().unwrap();
                        let label = inline["props"]["label"].as_str().unwrap();
                        preview.push_str(label);
                        targets.push((id, label));
                    }
                    _ => {}
                }
            }
            let preview: String = preview.chars().take(240).collect();
            let mut seen = HashSet::new();
            for (target_id, label) in targets {
                if seen.insert(target_id) {
                    output.push(Mention {
                        block_id: block["id"].as_str().unwrap().into(),
                        target_id: target_id.into(),
                        label: label.into(),
                        preview: preview.clone(),
                    });
                }
            }
            visit(block["children"].as_array().unwrap(), output);
        }
    }
    let mut output = vec![];
    visit(document["blocks"].as_array().unwrap(), &mut output);
    Ok(output)
}

// Caller owns the transaction: document and derived index always commit together.
pub fn index_document(
    connection: &Connection,
    campaign_id: &str,
    session_id: Option<&str>,
    page_id: Option<&str>,
    document: &Value,
) -> AppResult<()> {
    if session_id.is_some() == page_id.is_some() {
        return Err("Invalid link source.".into());
    }
    let mentions = extract_mentions(document)?;
    for mention in &mentions {
        let owner: Option<String> = connection
            .query_row(
                "SELECT campaign_id FROM pages WHERE id=?1",
                [&mention.target_id],
                |row| row.get(0),
            )
            .optional()
            .map_err(storage)?;
        if owner.is_some_and(|id| id != campaign_id) {
            return Err("The link points to a page of another campaign. Remove it or choose a page of this campaign.".into());
        }
    }
    connection.execute("DELETE FROM mentions WHERE campaign_id=?1 AND (source_session_id=?2 OR source_page_id=?3)",params![campaign_id,session_id,page_id]).map_err(storage)?;
    for mention in mentions {
        connection.execute("INSERT INTO mentions(campaign_id,source_session_id,source_page_id,source_block_id,target_page_id,preview) VALUES (?1,?2,?3,?4,?5,?6)",params![campaign_id,session_id,page_id,mention.block_id,mention.target_id,mention.preview]).map_err(storage)?;
    }
    Ok(())
}
pub fn save_page_document(
    connection: &Connection,
    campaign_id: &str,
    id: &str,
    revision: i64,
    document: Value,
) -> AppResult<Page> {
    identifier(campaign_id)?;
    identifier(id)?;
    validate_document(&document)?;
    let transaction = connection.unchecked_transaction().map_err(storage)?;
    let affected = transaction.execute("UPDATE pages SET document=?1,revision=revision+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?2 AND campaign_id=?3 AND revision=?4",params![document.to_string(),id,campaign_id,revision]).map_err(storage)?;
    if affected != 1 {
        return Err("Saving stopped: page changed elsewhere or not part of the campaign. Copy the notes before reopening it.".into());
    }
    index_document(&transaction, campaign_id, None, Some(id), &document)?;
    crate::search::page(&transaction, campaign_id, id)?;
    transaction.commit().map_err(storage)?;
    get_page(connection, campaign_id, id)
}
pub fn backlinks(
    connection: &Connection,
    campaign_id: &str,
    target_id: &str,
) -> AppResult<Vec<Backlink>> {
    require_campaign(connection, campaign_id)?;
    identifier(target_id)?;
    let mut statement = connection.prepare("SELECT CASE WHEN m.source_session_id IS NOT NULL THEN 'session' ELSE 'page' END,COALESCE(s.id,p.id),COALESCE(s.title,p.title),s.sequence,m.source_block_id,m.preview FROM mentions m LEFT JOIN sessions s ON s.id=m.source_session_id AND s.campaign_id=m.campaign_id LEFT JOIN pages p ON p.id=m.source_page_id AND p.campaign_id=m.campaign_id WHERE m.campaign_id=?1 AND m.target_page_id=?2 ORDER BY s.sequence,p.title_key,m.source_block_id").map_err(storage)?;
    let rows = statement
        .query_map(params![campaign_id, target_id], |row| {
            Ok(Backlink {
                source_kind: row.get(0)?,
                source_id: row.get(1)?,
                source_title: row.get(2)?,
                sequence: row.get(3)?,
                block_id: row.get(4)?,
                preview: row.get(5)?,
            })
        })
        .map_err(storage)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(storage);
    rows
}
pub fn recover_page(
    connection: &Connection,
    campaign_id: &str,
    id: &str,
    name: &str,
) -> AppResult<Page> {
    require_campaign(connection, campaign_id)?;
    identifier(id)?;
    let name = title(name)?;
    let transaction = connection.unchecked_transaction().map_err(storage)?;
    let referenced: bool = transaction
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM mentions WHERE campaign_id=?1 AND target_page_id=?2)",
            params![campaign_id, id],
            |row| row.get(0),
        )
        .map_err(storage)?;
    if !referenced {
        return Err("No missing references to recover in this campaign.".into());
    }
    let existing: bool = transaction
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM pages WHERE id=?1)",
            [id],
            |row| row.get(0),
        )
        .map_err(storage)?;
    if existing {
        return Err("This page already exists. Reload the Codex.".into());
    }
    ensure_available(&transaction, campaign_id, name, "")?;
    transaction.execute("INSERT INTO pages(id,campaign_id,title,title_key,kind,status,document) VALUES (?1,?2,?3,?4,'note','stub',?5)",params![id,campaign_id,name,key(name),empty_document().to_string()]).map_err(storage)?;
    crate::search::page(&transaction, campaign_id, id)?;
    transaction.commit().map_err(storage)?;
    get_page(connection, campaign_id, id)
}
