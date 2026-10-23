use crate::journal::{identifier, require_campaign, storage, AppResult};
use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;
use sha2::{Digest, Sha256};
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportSource {
    pub id: String,
    pub campaign_id: String,
    pub page_id: Option<String>,
    pub session_id: Option<String>,
    pub name: String,
    pub content: String,
    pub sha256: String,
}
fn column(kind: &str) -> AppResult<&'static str> {
    match kind {
        "page" => Ok("page_id"),
        "session" => Ok("session_id"),
        _ => Err("Tipo fonte importata non valido.".into()),
    }
}
fn validate(name: &str, content: &str) -> AppResult<()> {
    if name.is_empty()
        || name.chars().count() > 512
        || name.contains(['\0', '\\', ':'])
        || name.starts_with('/')
        || name
            .split('/')
            .any(|p| p == ".." || p == "." || p.is_empty())
        || content.len() > 2_000_000
        || content.contains('\0')
    {
        return Err("Nome o contenuto della sorgente importata non valido (massimo 2 MB).".into());
    }
    Ok(())
}
const COLUMNS: &str = "id,campaign_id,page_id,session_id,name,content,sha256";
fn row(r: &rusqlite::Row<'_>) -> rusqlite::Result<ImportSource> {
    Ok(ImportSource {
        id: r.get(0)?,
        campaign_id: r.get(1)?,
        page_id: r.get(2)?,
        session_id: r.get(3)?,
        name: r.get(4)?,
        content: r.get(5)?,
        sha256: r.get(6)?,
    })
}
pub fn get(
    c: &Connection,
    campaign: &str,
    kind: &str,
    id: &str,
) -> AppResult<Option<ImportSource>> {
    require_campaign(c, campaign)?;
    identifier(id)?;
    let field = column(kind)?;
    c.query_row(
        &format!("SELECT {COLUMNS} FROM import_sources WHERE campaign_id=?1 AND {field}=?2"),
        params![campaign, id],
        row,
    )
    .optional()
    .map_err(storage)
}
pub fn add(
    c: &Connection,
    campaign: &str,
    kind: &str,
    id: &str,
    name: &str,
    content: &str,
) -> AppResult<ImportSource> {
    require_campaign(c, campaign)?;
    identifier(id)?;
    validate(name, content)?;
    let field = column(kind)?;
    if get(c, campaign, kind, id)?.is_some() {
        return Err("La sorgente originale è già registrata e non viene sovrascritta.".into());
    }
    let table = if kind == "page" { "pages" } else { "sessions" };
    let found: bool = c
        .query_row(
            &format!("SELECT EXISTS(SELECT 1 FROM {table} WHERE campaign_id=?1 AND id=?2)"),
            params![campaign, id],
            |r| r.get(0),
        )
        .map_err(storage)?;
    if !found {
        return Err("Documento non trovato nella campagna.".into());
    }
    c.execute(&format!("INSERT INTO import_sources(id,campaign_id,{field},name,content,sha256) VALUES(?1,?2,?3,?4,?5,?6)"),params![uuid::Uuid::new_v4().to_string(),campaign,id,name,content,format!("{:x}",Sha256::digest(content.as_bytes()))]).map_err(storage)?;
    get(c, campaign, kind, id)?.ok_or("Sorgente importata non trovata.".into())
}
pub fn all(c: &Connection, campaign: &str) -> AppResult<Vec<ImportSource>> {
    require_campaign(c, campaign)?;
    let mut q = c
        .prepare(&format!(
            "SELECT {COLUMNS} FROM import_sources WHERE campaign_id=?1 ORDER BY name,id"
        ))
        .map_err(storage)?;
    let rows = q
        .query_map([campaign], row)
        .map_err(storage)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(storage)?;
    Ok(rows)
}
pub fn validate_archive(c: &Connection) -> AppResult<()> {
    for campaign in crate::journal::list_campaigns(c)? {
        for source in all(c, &campaign.id)? {
            identifier(&source.id)?;
            validate(&source.name, &source.content)?;
            if format!("{:x}", Sha256::digest(source.content.as_bytes())) != source.sha256 {
                return Err("Checksum della sorgente importata incoerente.".into());
            }
        }
    }
    Ok(())
}
