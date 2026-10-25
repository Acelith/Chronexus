use crate::journal::{storage, AppResult};
use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;
use serde_json::Value;
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    pub(crate) payload: Value,
    fetched_at: String,
}
fn valid_key(key: &str) -> bool {
    key.len() <= 600
        && !key.chars().any(char::is_control)
        && (key.starts_with("search/") || key.starts_with("entry/"))
}
fn validate(key: &str, v: &Value) -> AppResult<()> {
    if !valid_key(key) || v.to_string().len() > 2 * 1024 * 1024 || !v.is_object() {
        return Err("Invalid or too large wiki response.".into());
    }
    if key.starts_with("search/") {
        let rows = v["results"].as_array().ok_or("Invalid wiki list.")?;
        if rows.len() > 20 || !v["count"].is_u64() {
            return Err("Wiki list over its limit.".into());
        }
        for r in rows {
            if r["object_name"]
                .as_str()
                .is_none_or(|s| s.is_empty() || s.chars().count() > 500)
                || r["object_pk"].as_str().is_none_or(|s| s.len() > 200)
                || !r["document"].is_object()
            {
                return Err("Invalid wiki entry.".into());
            }
        }
    } else {
        let id = key.rsplit('/').next().unwrap_or("");
        if v["entry"]["key"].as_str() != Some(id)
            || !v["entry"]["name"].is_string()
            || !v["document"].is_object()
            || v["document"]["key"] != v["entry"]["document"]["key"]
        {
            return Err("Wiki details do not match the source.".into());
        }
    }
    Ok(())
}
pub fn read(c: &Connection, key: &str) -> AppResult<Option<Entry>> {
    if !valid_key(key) {
        return Err("Invalid wiki request.".into());
    }
    let r: Option<(String, String)> = c
        .query_row(
            "SELECT payload,fetched_at FROM wiki_cache WHERE key=?1",
            [key],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()
        .map_err(storage)?;
    r.map(|(raw, fetched_at)| {
        let payload = serde_json::from_str(&raw).map_err(|_| "Wiki copy unreadable.")?;
        validate(key, &payload)?;
        Ok(Entry {
            payload,
            fetched_at,
        })
    })
    .transpose()
}
pub fn store(c: &Connection, key: &str, payload: Value) -> AppResult<Entry> {
    validate(key, &payload)?;
    let tx = c.unchecked_transaction().map_err(storage)?;
    tx.execute("INSERT INTO wiki_cache(key,payload) VALUES(?1,?2) ON CONFLICT(key) DO UPDATE SET payload=excluded.payload,fetched_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')",params![key,payload.to_string()]).map_err(storage)?;
    tx.execute("DELETE FROM wiki_cache WHERE key IN (SELECT key FROM wiki_cache WHERE key<>?1 ORDER BY fetched_at DESC,key LIMIT -1 OFFSET 99)",[key]).map_err(storage)?;
    let entry = read(&tx, key)?.ok_or("Wiki copy not available.")?;
    tx.commit().map_err(storage)?;
    Ok(entry)
}
pub fn validate_archive(c: &Connection) -> AppResult<()> {
    let mut q = c
        .prepare("SELECT key,payload FROM wiki_cache")
        .map_err(storage)?;
    let rows = q
        .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))
        .map_err(storage)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(storage)?;
    if rows.len() > 100 {
        return Err("Wiki cache over its limit.".into());
    }
    for (key, raw) in rows {
        let v = serde_json::from_str(&raw).map_err(|_| "Wiki cache unreadable.")?;
        validate(&key, &v)?;
    }
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    use crate::{backup, journal};
    use serde_json::json;
    #[test]
    fn wiki_cache_rejects_mismatched_sources_and_survives_backup_restore() {
        let d = tempfile::tempdir().unwrap();
        let s = backup::Store::open(&d.path().join("profile")).unwrap();
        let c = &s.connection;
        journal::create_campaign(c, "A").unwrap();
        let v = json!({"entry":{"key":"sample","name":"Sample","document":{"key":"srd"}},"document":{"key":"srd","licenses":[]}});
        store(c, "entry/spells/sample", v.clone()).unwrap();
        assert!(store(c, "entry/spells/other", v).is_err());
        assert!(store(c, "http://bad", json!({})).is_err());
        let file = d.path().join("wiki.nodex");
        backup::write_backup(c, &s.directory, &file).unwrap();
        let mut r = backup::Store::open(&d.path().join("restore")).unwrap();
        let p = r.prepare(&file).unwrap();
        r.restore(&p.token).unwrap();
        assert!(read(&r.connection, "entry/spells/sample")
            .unwrap()
            .is_some());
    }
}
