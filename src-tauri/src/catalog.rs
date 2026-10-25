use crate::journal::{storage, AppResult};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value;

const CATEGORIES: &[&str] = &[
    "spells",
    "classes",
    "races",
    "equipment",
    "magic-items",
    "features",
    "traits",
    "skills",
    "conditions",
    "rules",
    "rule-sections",
    "backgrounds",
    "feats",
];
pub fn valid_path(path: &str) -> bool {
    let parts: Vec<_> = path.split('/').collect();
    (parts.len() == 1 || parts.len() == 2)
        && CATEGORIES.contains(&parts[0])
        && parts.iter().all(|p| {
            !p.is_empty()
                && p.len() <= 160
                && p.bytes()
                    .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
        })
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CatalogSource {
    pub path: String,
    pub name: String,
    /// Absent for the D&D 5e API SRD catalog; "wikidot" for a public wiki page.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub provider: Option<String>,
}
impl CatalogSource {
    pub fn validate(&self) -> AppResult<()> {
        let path_ok = match self.provider.as_deref() {
            None => valid_path(&self.path) && self.path.starts_with("spells/"),
            Some("wikidot") => {
                self.path.starts_with("spell:")
                    && crate::wikidot::category_of(&self.path) == Some("spells")
            }
            Some(_) => false,
        };
        if !path_ok
            || self.name.trim().is_empty()
            || self.name.chars().count() > 200
            || self.name.contains('\0')
        {
            return Err("Riferimento alla fonte dell’incantesimo non valido.".into());
        }
        Ok(())
    }
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CacheEntry {
    pub payload: Value,
    pub fetched_at: String,
}
fn validate(path: &str, value: &Value) -> AppResult<()> {
    if !valid_path(path) || !value.is_object() || value.to_string().len() > 2 * 1024 * 1024 {
        return Err("Risposta del catalogo non valida o troppo grande.".into());
    }
    if let Some((_, index)) = path.split_once('/') {
        if value.get("index").and_then(Value::as_str) != Some(index)
            || value
                .get("name")
                .and_then(Value::as_str)
                .is_none_or(|s| s.is_empty() || s.chars().count() > 200)
        {
            return Err("La risposta non corrisponde alla voce richiesta.".into());
        }
    } else if value
        .get("results")
        .and_then(Value::as_array)
        .is_none_or(|r| r.len() > 5000)
    {
        return Err("Indice del catalogo non valido.".into());
    }
    Ok(())
}
pub fn read(c: &Connection, path: &str) -> AppResult<Option<CacheEntry>> {
    if !valid_path(path) {
        return Err("Percorso del catalogo non ammesso.".into());
    }
    let raw: Option<(String, String)> = c
        .query_row(
            "SELECT payload,fetched_at FROM catalog_cache WHERE path=?1",
            [path],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()
        .map_err(storage)?;
    raw.map(|(raw, fetched_at)| {
        let payload =
            serde_json::from_str(&raw).map_err(|_| "Copia locale del catalogo illeggibile.")?;
        validate(path, &payload)?;
        Ok(CacheEntry {
            payload,
            fetched_at,
        })
    })
    .transpose()
}
pub fn store(c: &Connection, path: &str, payload: Value) -> AppResult<CacheEntry> {
    validate(path, &payload)?;
    let tx = c.unchecked_transaction().map_err(storage)?;
    tx.execute("INSERT INTO catalog_cache(path,payload) VALUES(?1,?2) ON CONFLICT(path) DO UPDATE SET payload=excluded.payload,fetched_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')",params![path,payload.to_string()]).map_err(storage)?;
    // This is a disposable cache; imported user assets are independent copies.
    tx.execute("DELETE FROM catalog_cache WHERE path IN (SELECT path FROM catalog_cache WHERE path<>?1 ORDER BY fetched_at DESC,path LIMIT -1 OFFSET 149)", [path]).map_err(storage)?;
    let entry = read(&tx, path)?.ok_or("Copia locale non disponibile.")?;
    tx.commit().map_err(storage)?;
    Ok(entry)
}
pub fn validate_archive(c: &Connection) -> AppResult<()> {
    let mut q = c
        .prepare("SELECT path,payload FROM catalog_cache")
        .map_err(storage)?;
    let entries = q
        .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))
        .map_err(storage)?;
    for entry in entries {
        let (path, raw) = entry.map_err(storage)?;
        let value = serde_json::from_str(&raw).map_err(|_| "Catalogo nel backup illeggibile.")?;
        validate(&path, &value)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn cache_is_persistent_bounded_and_rejects_untrusted_paths_or_mismatched_data() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("cache.sqlite3");
        let c = crate::db::open(&path).unwrap();
        assert!(read(&c, "spells").unwrap().is_none());
        for p in [
            "../spells",
            "https://evil.test",
            "spells/a?x=1",
            "spells/a/b",
            "spells/",
        ] {
            assert!(store(&c, p, json!({})).is_err());
        }
        assert!(store(
            &c,
            "spells/acid-arrow",
            json!({"index":"fireball","name":"Fireball"})
        )
        .is_err());
        store(&c, "spells", json!({"results":[]})).unwrap();
        for n in 0..155 {
            let slug = format!("spell-{n}");
            store(
                &c,
                &format!("spells/{slug}"),
                json!({"index":slug,"name":"Custom test"}),
            )
            .unwrap();
        }
        assert_eq!(
            c.query_row("SELECT COUNT(*) FROM catalog_cache", [], |r| r
                .get::<_, i64>(0))
                .unwrap(),
            150
        );
        c.execute(
            "UPDATE catalog_cache SET fetched_at='2099-01-01T00:00:00Z'",
            [],
        )
        .unwrap();
        store(
            &c,
            "spells/acid-arrow",
            json!({"index":"acid-arrow","name":"Acid Arrow"}),
        )
        .unwrap();
        drop(c);
        let c = crate::db::open(&path).unwrap();
        assert_eq!(
            read(&c, "spells/acid-arrow").unwrap().unwrap().payload["name"],
            "Acid Arrow"
        );
        validate_archive(&c).unwrap();
    }
}
