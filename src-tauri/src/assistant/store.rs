use crate::{
    journal::{identifier, require_campaign, storage, AppResult},
    party,
};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::HashSet;
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Settings {
    pub enabled: bool,
    pub model: String,
    pub digest: String,
    pub specialization: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Source {
    pub key: String,
    pub kind: String,
    pub source_id: String,
    pub block_id: Option<String>,
    pub title: String,
    pub revision: i64,
    pub text: String,
    pub hash: String,
    pub edition: Option<String>,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Turn {
    pub id: String,
    pub campaign_id: String,
    pub question: String,
    pub mode: String,
    pub edition: Option<String>,
    pub model: String,
    pub digest: String,
    pub status: String,
    pub answer: String,
    pub sources: Vec<Source>,
    pub metrics: Value,
    pub error: String,
    pub created_at: String,
}
pub fn hash(s: &str) -> String {
    format!("{:x}", Sha256::digest(s.as_bytes()))
}
pub fn settings(c: &Connection) -> AppResult<Settings> {
    c.query_row(
        "SELECT enabled,model,digest,specialization FROM assistant_settings WHERE id=1",
        [],
        |r| {
            Ok(Settings {
                enabled: r.get(0)?,
                model: r.get(1)?,
                digest: r.get(2)?,
                specialization: r.get(3)?,
            })
        },
    )
    .map_err(storage)
}
pub fn set_settings(c: &Connection, s: &Settings) -> AppResult<Settings> {
    validate_settings(s)?;
    c.execute(
        "UPDATE assistant_settings SET enabled=?1,model=?2,digest=?3,specialization=?4 WHERE id=1",
        params![s.enabled, s.model, s.digest, s.specialization],
    )
    .map_err(storage)?;
    settings(c)
}
pub(crate) fn validate_settings(s: &Settings) -> AppResult<()> {
    if s.model.len() > 160 || s.digest.len() > 64 {
        return Err("Configurazione AI oltre i limiti.".into());
    }
    if s.enabled {
        super::runtime::check_model_name(&s.model)?;
        if s.digest.len() != 64 || !s.digest.bytes().all(|v| v.is_ascii_hexdigit()) {
            return Err("Identità del modello non valida.".into());
        }
    }
    if !["dnd-finetuned", "multilingual-rag"].contains(&s.specialization.as_str()) {
        return Err("Profilo AI non valido.".into());
    }
    Ok(())
}
pub fn question(value: &str) -> AppResult<()> {
    if value.trim().chars().count() < 3
        || value.chars().count() > 1000
        || value.chars().any(|c| c == '\0')
    {
        return Err("Scrivi una domanda da 3 a 1000 caratteri.".into());
    }
    Ok(())
}
pub fn tokens(value: &str) -> Vec<String> {
    let stop = [
        "che", "chi", "cosa", "come", "dove", "quando", "perché", "perche", "della", "delle",
        "degli", "dello", "dei", "del", "gli", "alla", "alle", "dalla", "dalle", "sono", "era",
        "essere", "con", "per", "una", "uno", "nella", "nelle", "negli", "sulla", "sulle",
        "questo", "questa", "quali", "quale", "sappiamo", "sai", "puoi", "campagna", "what",
        "where", "when", "does", "the", "and", "with", "about", "has", "have", "ha", "il", "lo",
        "la", "le", "un", "di", "da", "in", "su", "si", "mi", "ho", "do", "is", "of", "to", "me",
        "we", "our",
    ];
    let mut seen = HashSet::new();
    value
        .to_lowercase()
        .split(|c: char| !c.is_alphanumeric())
        .filter(|s| s.len() >= 2 && !stop.contains(s) && seen.insert(s.to_string()))
        .take(10)
        .map(str::to_string)
        .collect()
}
fn crop(value: &str) -> String {
    value.chars().take(1200).collect()
}
fn block_identifier(block: &str) -> AppResult<()> {
    if block.is_empty() || block.len() > 128 || block.contains('\0') {
        return Err("Identità del blocco non valida.".into());
    }
    Ok(())
}
fn mentions_name(text: &str, name: &str) -> bool {
    let text = text.to_lowercase();
    let name = name.to_lowercase();
    let words: Vec<_> = text
        .split(|c: char| !c.is_alphanumeric())
        .filter(|s| !s.is_empty())
        .collect();
    let name: Vec<_> = name
        .split(|c: char| !c.is_alphanumeric())
        .filter(|s| !s.is_empty())
        .collect();
    !name.is_empty() && words.windows(name.len()).any(|w| w == name)
}
pub fn canonical(
    c: &Connection,
    campaign: &str,
    kind: &str,
    id: &str,
    block: Option<&str>,
) -> AppResult<Option<Source>> {
    require_campaign(c, campaign)?;
    if kind == "wiki" {
        if let Some(page) = id.strip_prefix("wikidot/") {
            if crate::wikidot::category_of(page).is_none() {
                return Err("Identità fonte regole non valida.".into());
            }
            return crate::wikidot::read_entry(c, page)?
                .map(|(e, _)| {
                    let text = crop(&crate::wikidot::plain_text(&e));
                    Ok(Source {
                        key: String::new(),
                        kind: kind.into(),
                        source_id: id.into(),
                        block_id: None,
                        title: e.title.clone(),
                        revision: 0,
                        hash: hash(&text),
                        text,
                        edition: Some(e.edition),
                    })
                })
                .transpose();
        }
        let raw: Option<String> = c
            .query_row(
                "SELECT payload FROM wiki_cache WHERE key=?1 AND key LIKE 'entry/%'",
                [id],
                |r| r.get(0),
            )
            .optional()
            .map_err(storage)?;
        return raw
            .map(|raw| {
                let v: Value =
                    serde_json::from_str(&raw).map_err(|_| "Fonte regole illeggibile.")?;
                let text = crop(&format!(
                    "{}\n{}\n{}",
                    v["entry"]["name"].as_str().unwrap_or(""),
                    v["entry"]["desc"].as_str().unwrap_or(""),
                    v["document"]["name"].as_str().unwrap_or("")
                ));
                Ok(Source {
                    key: String::new(),
                    kind: kind.into(),
                    source_id: id.into(),
                    block_id: None,
                    title: v["entry"]["name"].as_str().unwrap_or("Voce wiki").into(),
                    revision: 0,
                    hash: hash(&text),
                    text,
                    edition: v["document"]["gamesystem"]["key"]
                        .as_str()
                        .map(str::to_string),
                })
            })
            .transpose();
    }
    identifier(id)?;
    if let Some(block) = block {
        block_identifier(block)?
    }
    let table = match kind {
        "session" => "sessions",
        "page" => "pages",
        "character" => "characters",
        "item" | "spell" | "ability" => "player_assets",
        _ => return Err("Tipo fonte AI non valido.".into()),
    };
    let revision: Option<i64> = c
        .query_row(
            &format!("SELECT revision FROM {table} WHERE campaign_id=?1 AND id=?2"),
            params![campaign, id],
            |r| r.get(0),
        )
        .optional()
        .map_err(storage)?;
    let Some(revision) = revision else {
        return Ok(None);
    };
    let row:Option<(String,String)>=c.query_row("SELECT title,body FROM search_documents WHERE campaign_id=?1 AND kind=?2 AND source_id=?3 AND block_id=?4",params![campaign,kind,id,block.unwrap_or("")],|r|Ok((r.get(0)?,r.get(1)?))).optional().map_err(storage)?;
    let Some((title, mut text)) = row else {
        return Ok(None);
    };
    if block.is_none() && ["page", "session"].contains(&kind) {
        let mut q=c.prepare("SELECT body FROM search_documents WHERE campaign_id=?1 AND kind=?2 AND source_id=?3 AND block_id<>'' ORDER BY id LIMIT 3").map_err(storage)?;
        for row in q
            .query_map(params![campaign, kind, id], |r| r.get::<_, String>(0))
            .map_err(storage)?
        {
            text.push('\n');
            text.push_str(&row.map_err(storage)?)
        }
    }
    if kind == "page" {
        let member:Option<(String,String,String)>=c.query_row("SELECT player_name,role,status FROM party_members WHERE campaign_id=?1 AND page_id=?2",params![campaign,id],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?))).optional().map_err(storage)?;
        if let Some((player, role, status)) = member {
            text = format!(
                "Membro del party. Giocatore: {player}. Ruolo: {role}. Presenza: {status}.\n{text}"
            );
        }
    }
    let text = crop(&text);
    Ok(Some(Source {
        key: String::new(),
        kind: kind.into(),
        source_id: id.into(),
        block_id: block.map(str::to_string),
        title,
        revision,
        hash: hash(&text),
        text,
        edition: None,
    }))
}
pub fn retrieve(
    c: &Connection,
    campaign: &str,
    q: &str,
    mode: &str,
    edition: Option<&str>,
    keys: &[String],
) -> AppResult<Vec<Source>> {
    require_campaign(c, campaign)?;
    question(q)?;
    let mut out = Vec::new();
    if mode == "rules" {
        let ed = edition.ok_or("Scegli l'edizione delle regole.")?;
        if !["5e-2014", "5e-2024", "3.5"].contains(&ed) || keys.is_empty() || keys.len() > 6 {
            return Err("Scegli fino a sei fonti locali della stessa edizione.".into());
        }
        for key in keys {
            let source = canonical(c, campaign, "wiki", key, None)?
                .ok_or("Fonte regole non disponibile: consultala nella wiki.")?;
            if source.edition.as_deref() != Some(ed) {
                return Err(
                    "Le fonti selezionate appartengono a edizioni diverse: non saranno mescolate."
                        .into(),
                );
            }
            if !out.iter().any(|s: &Source| s.source_id == source.source_id) {
                out.push(source)
            }
        }
    } else if mode == "campaign" {
        if edition.is_some() || !keys.is_empty() {
            return Err("La modalità Campagna non accetta fonti di regole esterne.".into());
        }
        let terms = tokens(q);
        // If the question names a known page/alias, keep matching evidence from
        // any note, including sessions, and discard hits sharing only generic
        // words such as "chiave". This is lexical scope, not a factual inference.
        let names: Vec<String> = crate::knowledge::list_pages(c, campaign)?
            .into_iter()
            .flat_map(|p| std::iter::once(p.title).chain(p.aliases))
            .filter(|name| mentions_name(q, name))
            .collect();
        if !terms.is_empty() {
            let expression = terms
                .iter()
                .map(|t| format!("\"{}\"*", t.replace('"', "\"\"")))
                .collect::<Vec<_>>()
                .join(" OR ");
            let mut rows=c.prepare("SELECT d.kind,d.source_id,NULLIF(d.block_id,'') FROM search_fts JOIN search_documents d ON d.id=search_fts.rowid WHERE search_fts MATCH ?1 AND d.campaign_id=?2 ORDER BY bm25(search_fts,5.0,1.0),d.id LIMIT 32").map_err(storage)?;
            let hits = rows
                .query_map(params![expression, campaign], |r| {
                    Ok((
                        r.get::<_, String>(0)?,
                        r.get::<_, String>(1)?,
                        r.get::<_, Option<String>>(2)?,
                    ))
                })
                .map_err(storage)?
                .collect::<rusqlite::Result<Vec<_>>>()
                .map_err(storage)?;
            // A title/summary row and its block are the same underlying evidence.
            // Prefer the block so it can be reopened, without duplicating it as
            // apparent independent corroboration in the model's context.
            for (kind, id, block) in &hits {
                if out.len() >= 8 {
                    break;
                }
                if out.iter().filter(|s| s.source_id == *id).count() >= 2 {
                    continue;
                }
                if block.is_none()
                    && hits
                        .iter()
                        .any(|(k, i, b)| k == kind && i == id && b.is_some())
                {
                    continue;
                }
                if let Some(s) = canonical(c, campaign, kind, id, block.as_deref())? {
                    if !names.is_empty()
                        && !names.iter().any(|name| {
                            mentions_name(&s.title, name) || mentions_name(&s.text, name)
                        })
                    {
                        continue;
                    }
                    if !s.text.trim().is_empty() {
                        out.push(s)
                    }
                }
            }
        }
        if q.to_lowercase().contains("party") || q.to_lowercase().contains("compagnia") {
            for member in party::list(c, campaign)? {
                if out.len() >= 8 {
                    break;
                }
                if !out.iter().any(|s| s.source_id == member.page.id) {
                    if let Some(s) = canonical(c, campaign, "page", &member.page.id, None)? {
                        out.push(s)
                    }
                }
            }
        }
        if out.is_empty()
            && ["riassum", "riepilog"]
                .iter()
                .any(|t| q.to_lowercase().contains(t))
        {
            let mut query=c.prepare("SELECT kind,source_id,NULLIF(block_id,'') FROM search_documents WHERE campaign_id=?1 AND kind IN ('session','page') AND block_id<>'' ORDER BY updated_at DESC,id DESC LIMIT 8").map_err(storage)?;
            for r in query
                .query_map([campaign], |r| {
                    Ok((
                        r.get::<_, String>(0)?,
                        r.get::<_, String>(1)?,
                        r.get::<_, Option<String>>(2)?,
                    ))
                })
                .map_err(storage)?
            {
                let (kind, id, block) = r.map_err(storage)?;
                if let Some(s) = canonical(c, campaign, &kind, &id, block.as_deref())? {
                    out.push(s)
                }
            }
        }
    } else {
        return Err("Modalità assistente non valida.".into());
    }
    let mut chars = 0;
    out.retain(|s| {
        chars += s.text.chars().count();
        chars <= 8000
    });
    for (i, s) in out.iter_mut().enumerate() {
        s.key = format!("S{}", i + 1)
    }
    Ok(out)
}
fn row(r: &rusqlite::Row<'_>) -> rusqlite::Result<Turn> {
    let sources: String = r.get(9)?;
    let metrics: String = r.get(10)?;
    Ok(Turn {
        id: r.get(0)?,
        campaign_id: r.get(1)?,
        question: r.get(2)?,
        mode: r.get(3)?,
        edition: r.get(4)?,
        model: r.get(5)?,
        digest: r.get(6)?,
        status: r.get(7)?,
        answer: r.get(8)?,
        sources: serde_json::from_str(&sources).map_err(|e| {
            rusqlite::Error::FromSqlConversionFailure(9, rusqlite::types::Type::Text, Box::new(e))
        })?,
        metrics: serde_json::from_str(&metrics).map_err(|e| {
            rusqlite::Error::FromSqlConversionFailure(10, rusqlite::types::Type::Text, Box::new(e))
        })?,
        error: r.get(11)?,
        created_at: r.get(12)?,
    })
}
const COLUMNS:&str="id,campaign_id,question,mode,edition,model,digest,status,answer,sources,metrics,error,created_at";
pub fn get(c: &Connection, campaign: &str, id: &str) -> AppResult<Turn> {
    require_campaign(c, campaign)?;
    identifier(id)?;
    c.query_row(
        &format!("SELECT {COLUMNS} FROM assistant_turns WHERE campaign_id=?1 AND id=?2"),
        params![campaign, id],
        row,
    )
    .optional()
    .map_err(storage)?
    .ok_or("Risposta AI non trovata in questa campagna.".into())
}
pub fn history(c: &Connection, campaign: &str, offset: u32) -> AppResult<Vec<Turn>> {
    require_campaign(c, campaign)?;
    let mut q=c.prepare(&format!("SELECT {COLUMNS} FROM assistant_turns WHERE campaign_id=?1 ORDER BY created_at DESC,rowid DESC LIMIT 50 OFFSET ?2")).map_err(storage)?;
    let result = q
        .query_map(params![campaign, offset], row)
        .map_err(storage)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(storage);
    result
}
// The persisted row mirrors the narrow command payload and its immutable sources.
#[allow(clippy::too_many_arguments)]
pub fn begin(
    c: &Connection,
    campaign: &str,
    id: &str,
    q: &str,
    mode: &str,
    edition: Option<&str>,
    config: &Settings,
    sources: &[Source],
) -> AppResult<Turn> {
    require_campaign(c, campaign)?;
    identifier(id)?;
    question(q)?;
    let count: i64 = c
        .query_row(
            "SELECT count(*) FROM assistant_turns WHERE campaign_id=?1",
            [campaign],
            |r| r.get(0),
        )
        .map_err(storage)?;
    if count >= 1000 {
        return Err(
            "Cronologia piena: esporta e cancella le risposte meno utili prima di continuare."
                .into(),
        );
    }
    c.execute("INSERT INTO assistant_turns(id,campaign_id,question,mode,edition,model,digest,status,sources) VALUES(?1,?2,?3,?4,?5,?6,?7,'running',?8)",params![id,campaign,q,mode,edition,config.model,config.digest,serde_json::to_string(sources).map_err(|_|"Fonti AI non serializzabili.")?]).map_err(storage)?;
    get(c, campaign, id)
}
pub fn finish(
    c: &Connection,
    campaign: &str,
    id: &str,
    status: &str,
    answer: &str,
    metrics: &Value,
    error: &str,
) -> AppResult<Turn> {
    if ![
        "running",
        "complete",
        "cancelled",
        "error",
        "no_sources",
        "interrupted",
    ]
    .contains(&status)
        || answer.chars().count() > 12000
        || error.chars().count() > 1000
        || metrics.to_string().len() > 4000
    {
        return Err("Risposta AI oltre i limiti.".into());
    }
    if c.execute("UPDATE assistant_turns SET status=?1,answer=?2,metrics=?3,error=?4,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE campaign_id=?5 AND id=?6",params![status,answer,metrics.to_string(),error,campaign,id]).map_err(storage)?!=1{return Err("Risposta AI non trovata.".into())}
    get(c, campaign, id)
}
pub fn delete(c: &Connection, campaign: &str, id: &str) -> AppResult<()> {
    get(c, campaign, id)?;
    c.execute(
        "DELETE FROM assistant_turns WHERE campaign_id=?1 AND id=?2",
        params![campaign, id],
    )
    .map_err(storage)?;
    Ok(())
}
pub fn recover(c: &Connection) -> AppResult<()> {
    c.execute("UPDATE assistant_turns SET status='interrupted',error='Generazione interrotta dalla chiusura precedente.' WHERE status='running'",[]).map_err(storage)?;
    Ok(())
}
pub fn validate_archive(c: &Connection) -> AppResult<()> {
    let s = settings(c)?;
    validate_settings(&s)?;
    for campaign in crate::journal::list_campaigns(c)? {
        let mut offset = 0;
        loop {
            let rows = history(c, &campaign.id, offset)?;
            if rows.is_empty() {
                break;
            }
            for t in &rows {
                identifier(&t.id)?;
                question(&t.question)?;
                super::runtime::check_model_name(&t.model)?;
                if t.answer.chars().count() > 12000
                    || t.sources.len() > 8
                    || t.digest.len() != 64
                    || !t.digest.bytes().all(|b| b.is_ascii_hexdigit())
                    || t.error.chars().count() > 1000
                    || t.metrics.to_string().len() > 4000
                {
                    return Err("Cronologia AI oltre i limiti nel backup.".into());
                }
                let mut keys = HashSet::new();
                for (index, s) in t.sources.iter().enumerate() {
                    if s.key != format!("S{}", index + 1)
                        || !keys.insert(&s.key)
                        || ![
                            "page",
                            "session",
                            "character",
                            "item",
                            "spell",
                            "ability",
                            "wiki",
                        ]
                        .contains(&s.kind.as_str())
                        || (s.kind == "wiki"
                            && (!(s.source_id.starts_with("entry/")
                                || s.source_id.starts_with("wikidot/"))
                                || s.source_id.len() > 500))
                    {
                        return Err("Identità della fonte AI non valida.".into());
                    }
                    if s.text.chars().count() > 1200
                        || hash(&s.text) != s.hash
                        || s.title.chars().count() > 500
                        || s.revision < 0
                    {
                        return Err("Fonte AI alterata nel backup.".into());
                    }
                    if s.kind != "wiki" {
                        identifier(&s.source_id)?
                    }
                    if let Some(b) = &s.block_id {
                        block_identifier(b)?
                    }
                }
            }
            offset += rows.len() as u32;
            if offset > 1000 {
                return Err("Cronologia AI oltre i limiti nel backup.".into());
            }
        }
    }
    Ok(())
}
pub fn source_state(c: &Connection, campaign: &str, turn: &str, key: &str) -> AppResult<Value> {
    let t = get(c, campaign, turn)?;
    let old = t
        .sources
        .iter()
        .find(|s| s.key == key)
        .ok_or("Citazione non appartenente alla risposta.")?;
    let current = canonical(
        c,
        campaign,
        &old.kind,
        &old.source_id,
        old.block_id.as_deref(),
    )?;
    Ok(match current {
        Some(s) => {
            json!({"available":true,"changed":s.hash!=old.hash||s.revision!=old.revision||s.title!=old.title,"title":s.title})
        }
        None => json!({"available":false,"changed":true,"title":old.title}),
    })
}
