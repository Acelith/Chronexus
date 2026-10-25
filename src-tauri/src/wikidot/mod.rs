//! Read-only adapter for the public dnd5e.wikidot.com HTML pages (M16).
//! Requests are explicit, serialized, spaced, bounded and never carry campaign data.
pub mod parse;
#[cfg(test)]
mod tests;
use crate::journal::{storage, AppResult};
use reqwest::{Client, Url};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    sync::{
        atomic::{AtomicU64, Ordering},
        Mutex,
    },
    time::{Duration, Instant},
};
use tokio_util::sync::CancellationToken;

pub const BASE: &str = "https://dnd5e.wikidot.com/";
/// dnd5e.wikidot.com hosts the 2014 ruleset; 2024 rules live on a separate wiki.
pub const EDITION: &str = "5e-2014";
const LIMIT: usize = 2 * 1024 * 1024;
const MAX_ENTRIES: i64 = 200;
const CLASSES: &[&str] = &[
    "artificer",
    "barbarian",
    "bard",
    "blood-hunter",
    "cleric",
    "druid",
    "fighter",
    "monk",
    "paladin",
    "ranger",
    "rogue",
    "sorcerer",
    "warlock",
    "wizard",
];
/// (category, index page, page prefixes). Classes use CLASSES instead of a prefix.
const CATEGORIES: &[(&str, &str, &[&str])] = &[
    ("spells", "spells", &["spell"]),
    ("feats", "", &["feat"]),
    ("species", "lineage", &["lineage"]),
    ("backgrounds", "", &["background"]),
    ("items", "wondrous-items", &["wondrous-items"]),
    ("classes", "", &[]),
];
fn slug(s: &str) -> bool {
    !s.is_empty()
        && s.len() <= 100
        && s.bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
}
/// Maps a page name to its supported category; anything else is refused.
pub fn category_of(page: &str) -> Option<&'static str> {
    if page.len() > 160 {
        return None;
    }
    let (head, tail) = match page.split_once(':') {
        Some((h, t)) => (h, Some(t)),
        None => (page, None),
    };
    if !slug(head) || tail.is_some_and(|t| !slug(t)) {
        return None;
    }
    if CLASSES.contains(&head) {
        return Some("classes");
    }
    tail?;
    CATEGORIES
        .iter()
        .find(|(_, _, prefixes)| prefixes.contains(&head))
        .map(|(c, _, _)| *c)
}
pub fn index_path(category: &str) -> AppResult<&'static str> {
    CATEGORIES
        .iter()
        .find(|(c, _, _)| *c == category)
        .map(|(_, p, _)| *p)
        .ok_or_else(|| "Categoria Wikidot non supportata.".into())
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Block {
    Heading { level: u8, text: String },
    Paragraph { text: String },
    List { items: Vec<String> },
    Table { rows: Vec<Vec<String>> },
}
#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SpellFields {
    pub level: Option<String>,
    pub school: Option<String>,
    pub level_line: Option<String>,
    pub casting_time: Option<String>,
    pub range: Option<String>,
    pub components: Option<String>,
    pub duration: Option<String>,
    pub higher_levels: Option<String>,
    pub classes: Option<String>,
    pub description: Option<String>,
    pub ritual: bool,
    pub concentration: bool,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Entry {
    pub page: String,
    pub url: String,
    pub category: String,
    pub title: String,
    pub source: Option<String>,
    /// published | ua | homebrew | unspecified, as declared by the wiki itself.
    pub origin: String,
    pub edition: String,
    pub license: String,
    pub blocks: Vec<Block>,
    pub spell: Option<SpellFields>,
    /// Spell fields the parser could not find; shown instead of invented values.
    pub missing: Vec<String>,
    pub truncated: bool,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct IndexRow {
    pub page: String,
    pub name: String,
    pub group: String,
    pub details: Vec<String>,
    pub origin: String,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Index {
    pub category: String,
    pub url: String,
    pub rows: Vec<IndexRow>,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Cached<T> {
    pub payload: T,
    pub fetched_at: String,
    pub cached: bool,
    pub warning: Option<String>,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub category: String,
    pub url: String,
    pub fetched_at: String,
    pub cached: bool,
    pub warning: Option<String>,
    pub index_size: usize,
    pub total: usize,
    pub rows: Vec<IndexRow>,
}
fn index_url(category: &str) -> AppResult<String> {
    Ok(format!("{BASE}{}", index_path(category)?))
}
fn origin_ok(o: &str) -> bool {
    ["published", "ua", "homebrew", "unspecified"].contains(&o)
}
fn short(s: &str, n: usize) -> bool {
    s.chars().count() <= n && !s.contains('\0')
}
fn validate_entry(page: &str, e: &Entry) -> AppResult<()> {
    let text_ok = |b: &Block| match b {
        Block::Heading { level, text } => (1..=6).contains(level) && short(text, 20_000),
        Block::Paragraph { text } => short(text, 20_000),
        Block::List { items } => items.len() <= 500 && items.iter().all(|i| short(i, 20_000)),
        Block::Table { rows } => {
            rows.len() <= 300
                && rows
                    .iter()
                    .all(|r| r.len() <= 16 && r.iter().all(|c| short(c, 2000)))
        }
    };
    if e.page != page
        || category_of(page) != Some(e.category.as_str())
        || e.url != format!("{BASE}{page}")
        || e.edition != EDITION
        || !origin_ok(&e.origin)
        || e.title.is_empty()
        || !short(&e.title, 200)
        || e.source.as_deref().is_some_and(|s| !short(s, 200))
        || !short(&e.license, 400)
        || e.blocks.is_empty()
        || e.blocks.len() > 2000
        || !e.blocks.iter().all(text_ok)
        || e.missing.len() > 10
        || (e.spell.is_some() != (e.category == "spells"))
    {
        return Err("Voce Wikidot non valida o non corrispondente alla pagina richiesta.".into());
    }
    Ok(())
}
fn validate_index(category: &str, i: &Index) -> AppResult<()> {
    if i.category != category
        || i.url != index_url(category)?
        || i.rows.is_empty()
        || i.rows.len() > 3000
        || i.rows.iter().any(|r| {
            category_of(&r.page) != Some(category)
                || r.name.is_empty()
                || !short(&r.name, 200)
                || !short(&r.group, 200)
                || r.details.len() > 8
                || r.details.iter().any(|d| !short(d, 200))
                || !origin_ok(&r.origin)
        })
    {
        return Err("Indice Wikidot non valido.".into());
    }
    Ok(())
}
fn validate(key: &str, v: &Value) -> AppResult<()> {
    if v.to_string().len() > LIMIT {
        return Err("Copia Wikidot troppo grande.".into());
    }
    if let Some(category) = key.strip_prefix("index/") {
        let i: Index =
            serde_json::from_value(v.clone()).map_err(|_| "Indice Wikidot illeggibile.")?;
        validate_index(category, &i)
    } else if let Some(page) = key.strip_prefix("entry/") {
        let e: Entry =
            serde_json::from_value(v.clone()).map_err(|_| "Voce Wikidot illeggibile.")?;
        validate_entry(page, &e)
    } else {
        Err("Chiave cache Wikidot non valida.".into())
    }
}
pub fn read_raw(c: &Connection, key: &str) -> AppResult<Option<(Value, String)>> {
    let row: Option<(String, String)> = c
        .query_row(
            "SELECT payload,fetched_at FROM wikidot_cache WHERE key=?1",
            [key],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()
        .map_err(storage)?;
    row.map(|(raw, at)| {
        let v: Value = serde_json::from_str(&raw).map_err(|_| "Copia Wikidot illeggibile.")?;
        validate(key, &v)?;
        Ok((v, at))
    })
    .transpose()
}
pub fn read_entry(c: &Connection, page: &str) -> AppResult<Option<(Entry, String)>> {
    read_raw(c, &format!("entry/{page}"))?
        .map(|(v, at)| {
            Ok((
                serde_json::from_value(v).map_err(|_| "Voce Wikidot illeggibile.")?,
                at,
            ))
        })
        .transpose()
}
#[cfg(test)]
pub fn read_index(c: &Connection, category: &str) -> AppResult<Option<(Index, String)>> {
    read_raw(c, &format!("index/{category}"))?
        .map(|(v, at)| {
            Ok((
                serde_json::from_value(v).map_err(|_| "Indice Wikidot illeggibile.")?,
                at,
            ))
        })
        .transpose()
}
pub fn store(c: &Connection, key: &str, payload: &Value) -> AppResult<String> {
    validate(key, payload)?;
    let tx = c.unchecked_transaction().map_err(storage)?;
    tx.execute("INSERT INTO wikidot_cache(key,payload) VALUES(?1,?2) ON CONFLICT(key) DO UPDATE SET payload=excluded.payload,fetched_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')",params![key,payload.to_string()]).map_err(storage)?;
    // Disposable cache: only consulted copies are evicted, never imported spells.
    let keep = MAX_ENTRIES - i64::from(key.starts_with("entry/"));
    tx.execute("DELETE FROM wikidot_cache WHERE key IN (SELECT key FROM wikidot_cache WHERE key LIKE 'entry/%' AND key<>?1 ORDER BY fetched_at DESC,key LIMIT -1 OFFSET ?2)",params![key,keep]).map_err(storage)?;
    let at: String = tx
        .query_row(
            "SELECT fetched_at FROM wikidot_cache WHERE key=?1",
            [key],
            |r| r.get(0),
        )
        .map_err(storage)?;
    tx.commit().map_err(storage)?;
    Ok(at)
}
pub fn validate_archive(c: &Connection) -> AppResult<()> {
    let mut q = c
        .prepare("SELECT key,payload FROM wikidot_cache")
        .map_err(storage)?;
    let rows = q
        .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))
        .map_err(storage)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(storage)?;
    if rows.len() as i64 > MAX_ENTRIES + CATEGORIES.len() as i64 {
        return Err("Cache Wikidot fuori limite.".into());
    }
    for (key, raw) in rows {
        let v = serde_json::from_str(&raw).map_err(|_| "Cache Wikidot illeggibile.")?;
        validate(&key, &v)?;
    }
    Ok(())
}
/// Matches names and page slugs on the device; the query never leaves it.
pub fn filter(index: &Index, query: &str) -> (usize, Vec<IndexRow>) {
    let q = query.trim().to_lowercase();
    let hits: Vec<&IndexRow> = index
        .rows
        .iter()
        .filter(|r| q.is_empty() || r.name.to_lowercase().contains(&q) || r.page.contains(&q))
        .collect();
    (hits.len(), hits.into_iter().take(200).cloned().collect())
}
/// Plain text used when an approved Wikidot copy feeds the local assistant.
pub fn plain_text(e: &Entry) -> String {
    let mut parts = vec![e.title.clone()];
    if let Some(s) = &e.source {
        parts.push(format!("Source: {s}"));
    }
    for b in &e.blocks {
        parts.push(match b {
            Block::Paragraph { text } | Block::Heading { text, .. } => text.clone(),
            Block::List { items } => items.join("\n"),
            Block::Table { rows } => rows
                .iter()
                .map(|r| r.join(" | "))
                .collect::<Vec<_>>()
                .join("\n"),
        });
    }
    parts.join("\n")
}

pub struct State {
    gate: tokio::sync::Mutex<Option<Instant>>,
    interval: Duration,
    epoch: AtomicU64,
    cancel: Mutex<CancellationToken>,
}
impl Default for State {
    fn default() -> Self {
        Self::with_interval(Duration::from_millis(1500))
    }
}
impl State {
    pub fn with_interval(interval: Duration) -> Self {
        Self {
            gate: tokio::sync::Mutex::new(None),
            interval,
            epoch: AtomicU64::new(0),
            cancel: Mutex::new(CancellationToken::new()),
        }
    }
    /// Changes after every cache clear; writes started before it are rejected.
    pub fn epoch(&self) -> u64 {
        self.epoch.load(Ordering::SeqCst)
    }
    pub fn token(&self) -> CancellationToken {
        self.cancel
            .lock()
            .map(|t| t.clone())
            .unwrap_or_else(|_| CancellationToken::new())
    }
    pub fn cancel(&self) {
        if let Ok(mut t) = self.cancel.lock() {
            t.cancel();
            *t = CancellationToken::new();
        }
    }
    pub fn invalidate(&self) {
        self.epoch.fetch_add(1, Ordering::SeqCst);
        self.cancel();
    }
}
pub fn client() -> AppResult<Client> {
    Client::builder()
        .https_only(true)
        .redirect(reqwest::redirect::Policy::none())
        .connect_timeout(Duration::from_secs(10))
        .read_timeout(Duration::from_secs(15))
        .timeout(Duration::from_secs(25))
        .user_agent(concat!(
            "Chronexus/",
            env!("CARGO_PKG_VERSION"),
            " (personal offline campaign journal; explicit single-page lookup)"
        ))
        .build()
        .map_err(|_| "Connessione a Wikidot non disponibile.".into())
}
fn status_error(code: u16) -> String {
    match code {
        404 | 410 => "Wikidot non ha questa pagina (HTTP 404).".into(),
        403 | 429 => format!("Wikidot ha rifiutato o limitato la richiesta (HTTP {code}). Attendi prima di riprovare: non vengono fatti nuovi tentativi automatici."),
        500..=599 => format!("Wikidot non è disponibile in questo momento (HTTP {code})."),
        _ => format!("Risposta Wikidot inattesa (HTTP {code})."),
    }
}
/// GET one allowlisted page. `base` is fixed to BASE outside tests.
pub async fn fetch(
    client: &Client,
    state: &State,
    base: &Url,
    path: &str,
    token: &CancellationToken,
) -> AppResult<String> {
    if !(path.is_empty()
        || category_of(path).is_some()
        || CATEGORIES.iter().any(|(_, p, _)| *p == path))
    {
        return Err("Pagina Wikidot non ammessa.".into());
    }
    let mut gate = tokio::select! {
        biased;
        _ = token.cancelled() => return Err("Richiesta Wikidot annullata.".into()),
        g = state.gate.lock() => g,
    };
    if let Some(last) = *gate {
        let wait = state.interval.saturating_sub(last.elapsed());
        tokio::select! {
            biased;
            _ = token.cancelled() => return Err("Richiesta Wikidot annullata.".into()),
            _ = tokio::time::sleep(wait) => {}
        }
    }
    let result = request(client, base, path, token).await;
    *gate = Some(Instant::now());
    result
}
async fn request(
    client: &Client,
    base: &Url,
    path: &str,
    token: &CancellationToken,
) -> AppResult<String> {
    // "spell:x" would parse as a URL scheme with Url::join, so build the path explicitly.
    let mut url = Url::parse(&format!("{base}{path}"))
        .ok()
        .filter(|u| u.origin() == base.origin())
        .ok_or("Pagina Wikidot non ammessa.")?;
    for _ in 0..3 {
        let response = tokio::select! {
            biased;
            _ = token.cancelled() => return Err("Richiesta Wikidot annullata.".into()),
            r = client.get(url.clone()).header(reqwest::header::ACCEPT, "text/html").send() => r.map_err(|_| "Wikidot non raggiungibile. Controlla la connessione e riprova.")?,
        };
        let status = response.status();
        if status.is_redirection() {
            let next = response
                .headers()
                .get(reqwest::header::LOCATION)
                .and_then(|v| v.to_str().ok())
                .and_then(|l| url.join(l).ok())
                .ok_or("Reindirizzamento Wikidot non valido.")?;
            let page = next.path().trim_start_matches('/');
            if next.origin() != base.origin()
                || next.query().is_some()
                || !(page.is_empty()
                    || category_of(page).is_some()
                    || CATEGORIES.iter().any(|(_, p, _)| *p == page))
            {
                return Err(
                    "Reindirizzamento fuori dalle pagine Wikidot ammesse: richiesta interrotta."
                        .into(),
                );
            }
            url = next;
            continue;
        }
        if !status.is_success() {
            return Err(status_error(status.as_u16()));
        }
        let html = response
            .headers()
            .get(reqwest::header::CONTENT_TYPE)
            .and_then(|v| v.to_str().ok())
            .is_some_and(|v| v.to_ascii_lowercase().starts_with("text/html"));
        if !html {
            return Err("Wikidot non ha restituito una pagina HTML.".into());
        }
        if response.content_length().is_some_and(|n| n > LIMIT as u64) {
            return Err("Pagina Wikidot oltre il limite di 2 MiB.".into());
        }
        let mut response = response;
        let mut bytes = Vec::new();
        loop {
            let chunk = tokio::select! {
                biased;
                _ = token.cancelled() => return Err("Richiesta Wikidot annullata.".into()),
                c = response.chunk() => c.map_err(|_| "Download della pagina Wikidot interrotto.")?,
            };
            let Some(chunk) = chunk else { break };
            if chunk.len() > LIMIT.saturating_sub(bytes.len()) {
                return Err("Pagina Wikidot oltre il limite di 2 MiB.".into());
            }
            bytes.extend_from_slice(&chunk);
        }
        return String::from_utf8(bytes).map_err(|_| "Pagina Wikidot non decodificabile.".into());
    }
    Err("Troppi reindirizzamenti Wikidot.".into())
}
pub fn base() -> Url {
    Url::parse(BASE).expect("static Wikidot base")
}
pub async fn fetch_index(
    client: &Client,
    state: &State,
    base: &Url,
    category: &str,
    token: &CancellationToken,
) -> AppResult<Index> {
    let path = index_path(category)?;
    let html = fetch(client, state, base, path, token).await?;
    Ok(Index {
        category: category.into(),
        url: index_url(category)?,
        rows: parse::index(&html, category)?,
    })
}
pub async fn fetch_entry(
    client: &Client,
    state: &State,
    base: &Url,
    page: &str,
    token: &CancellationToken,
) -> AppResult<Entry> {
    if category_of(page).is_none() {
        return Err("Pagina Wikidot non ammessa.".into());
    }
    let html = fetch(client, state, base, page, token).await?;
    parse::entry(&html, page)
}
#[derive(Debug, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProviderCache {
    pub entries: i64,
    pub bytes: i64,
    /// Rule sources approved in campaign AI settings that live in this cache.
    pub ai_sources: i64,
}
#[derive(Debug, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CacheSummary {
    pub open5e: ProviderCache,
    pub wikidot: ProviderCache,
}
fn approved_rule_keys(c: &Connection) -> AppResult<Vec<String>> {
    let mut q = c
        .prepare("SELECT payload FROM campaign_ai_settings")
        .map_err(storage)?;
    let rows = q
        .query_map([], |r| r.get::<_, String>(0))
        .map_err(storage)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(storage)?;
    Ok(rows
        .iter()
        .filter_map(|raw| serde_json::from_str::<Value>(raw).ok())
        .flat_map(|v| {
            v["ruleKeys"]
                .as_array()
                .map(|a| {
                    a.iter()
                        .filter_map(|k| k.as_str().map(String::from))
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default()
        })
        .collect())
}
pub fn summary(c: &Connection) -> AppResult<CacheSummary> {
    let count = |sql: &str| -> AppResult<(i64, i64)> {
        c.query_row(sql, [], |r| Ok((r.get(0)?, r.get(1)?)))
            .map_err(storage)
    };
    let (oe, ob) = count("SELECT COUNT(*),COALESCE(SUM(LENGTH(payload)),0) FROM wiki_cache")?;
    let (we, wb) = count("SELECT COUNT(*),COALESCE(SUM(LENGTH(payload)),0) FROM wikidot_cache")?;
    let keys = approved_rule_keys(c)?;
    let exists = |table: &str, key: String| -> AppResult<bool> {
        c.query_row(
            &format!("SELECT EXISTS(SELECT 1 FROM {table} WHERE key=?1)"),
            [key],
            |r| r.get(0),
        )
        .map_err(storage)
    };
    let mut summary = CacheSummary {
        open5e: ProviderCache {
            entries: oe,
            bytes: ob,
            ai_sources: 0,
        },
        wikidot: ProviderCache {
            entries: we,
            bytes: wb,
            ai_sources: 0,
        },
    };
    for key in keys {
        if let Some(page) = key.strip_prefix("wikidot/") {
            if exists("wikidot_cache", format!("entry/{page}"))? {
                summary.wikidot.ai_sources += 1;
            }
        } else if exists("wiki_cache", key)? {
            summary.open5e.ai_sources += 1;
        }
    }
    Ok(summary)
}
/// Removes only disposable cached copies. Imported spells, campaigns, images,
/// backups and the provider preference live elsewhere and are untouched.
pub fn clear(c: &Connection, provider: &str) -> AppResult<CacheSummary> {
    let tx = c.unchecked_transaction().map_err(storage)?;
    match provider {
        "open5e" => {
            tx.execute("DELETE FROM wiki_cache", []).map_err(storage)?;
        }
        "wikidot" => {
            tx.execute("DELETE FROM wikidot_cache", [])
                .map_err(storage)?;
        }
        "all" => {
            tx.execute("DELETE FROM wiki_cache", []).map_err(storage)?;
            tx.execute("DELETE FROM wikidot_cache", [])
                .map_err(storage)?;
        }
        _ => return Err("Scegli quale cache wiki svuotare.".into()),
    }
    tx.commit().map_err(storage)?;
    summary(c)
}
