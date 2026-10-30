//! Read-only inspection of a Kanka JSON campaign export (M36).
//!
//! The layout follows Kanka's `ExportService`: `info.json` (older documentation says
//! `info.md`) carries `kanka_version`; each built-in entity is `<module>/<slug>_<id>.json`
//! with the shared fields and `relationships` inside its `entity` object. Relations are
//! returned only as candidates; the frontend stores them as unconfirmed. Nothing in the
//! archive is executed or followed; image files and settings are ignored.
use crate::journal::AppResult;
use serde::Serialize;
use serde_json::Value;
use std::io::{Cursor, Read};
use zip::ZipArchive;

const MAX_ZIP: u64 = 50_000_000;
const MAX_EXPANDED: u64 = 100_000_000;
const MAX_ENTITIES: usize = 2000;
const MAX_RELATIONS: usize = 200;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Relation {
    pub id: String,
    pub target_id: String,
    pub label: String,
    pub mirror_id: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Entity {
    pub path: String,
    pub source_id: String,
    pub name: String,
    pub kind: String,
    pub entry: String,
    pub original: String,
    pub relations: Vec<Relation>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Preview {
    pub version: String,
    pub entities: Vec<Entity>,
    pub warnings: Vec<String>,
}

fn category(path: &str) -> Option<&'static str> {
    let mut parts = path.split('/');
    let folder = parts.next()?;
    if parts.next().is_none() || parts.next().is_some() {
        return None;
    }
    match folder {
        "characters" => Some("npc"),
        "locations" => Some("place"),
        "organisations" | "families" => Some("faction"),
        "quests" => Some("quest"),
        "items" => Some("item"),
        "events" => Some("event"),
        "notes" | "journals" => Some("note"),
        "races" | "creatures" => Some("lore"),
        _ => None,
    }
}

fn text(value: Option<&Value>, limit: usize) -> String {
    value
        .and_then(Value::as_str)
        .unwrap_or("")
        .chars()
        .take(limit)
        .collect()
}

fn id(value: Option<&Value>) -> String {
    match value {
        Some(Value::Number(n)) if n.is_u64() => n.to_string(),
        Some(Value::String(s))
            if !s.is_empty() && s.len() <= 20 && s.bytes().all(|b| b.is_ascii_digit()) =>
        {
            s.clone()
        }
        _ => String::new(),
    }
}

fn read_limited(file: &mut impl Read, limit: u64) -> AppResult<String> {
    let mut value = String::new();
    file.take(limit + 1)
        .read_to_string(&mut value)
        .map_err(|_| "Kanka export file is not valid UTF-8.".to_string())?;
    if value.len() as u64 > limit {
        return Err("Kanka export file is too large.".into());
    }
    Ok(value)
}

/// `kanka_version` from `info.json`, or from the `info.md` the documentation describes.
fn version(zip: &mut ZipArchive<Cursor<Vec<u8>>>) -> AppResult<String> {
    if let Ok(mut file) = zip.by_name("info.json") {
        let raw = read_limited(&mut file, 65_536)?;
        let value: Value = serde_json::from_str(&raw)
            .map_err(|_| "Invalid Kanka export information.".to_string())?;
        return Ok(match value.get("kanka_version") {
            Some(Value::String(s)) => s.chars().take(40).collect(),
            Some(Value::Number(n)) => n.to_string(),
            _ => String::new(),
        });
    }
    let mut file = zip
        .by_name("info.md")
        .map_err(|_| "This ZIP is not a Kanka 2.1 or later JSON export.".to_string())?;
    let raw = read_limited(&mut file, 65_536)?;
    Ok(raw
        .lines()
        .find_map(|line| {
            let line = line.trim().trim_start_matches(['-', '*', ' ']);
            line.strip_prefix("kanka_version::")
                .or_else(|| line.strip_prefix("kanka_version:"))
        })
        .map(|v| {
            v.trim()
                .trim_matches(['`', '"', '\''])
                .chars()
                .take(40)
                .collect()
        })
        .unwrap_or_default())
}

fn supported(version: &str) -> bool {
    let mut parts = version.trim_start_matches(['v', 'V']).split('.');
    let major = parts
        .next()
        .and_then(|s| s.parse::<u32>().ok())
        .unwrap_or(0);
    let minor = parts
        .next()
        .and_then(|s| s.parse::<u32>().ok())
        .unwrap_or(0);
    major > 2 || (major == 2 && minor >= 1)
}

fn relations(entity: &Value, warnings: &mut Vec<String>, name: &str) -> Vec<Relation> {
    let Some(list) = entity.get("relationships").and_then(Value::as_array) else {
        return Vec::new();
    };
    if list.len() > MAX_RELATIONS {
        warnings.push(format!(
            "{name}: only the first {MAX_RELATIONS} relations are offered"
        ));
    }
    list.iter()
        .take(MAX_RELATIONS)
        .filter_map(|relation| {
            let target_id = id(relation.get("target_id"));
            let label = text(relation.get("relation"), 100).trim().to_string();
            if target_id.is_empty() || label.is_empty() {
                return None;
            }
            Some(Relation {
                id: id(relation.get("id")),
                target_id,
                label,
                mirror_id: id(relation.get("mirror_id")),
            })
        })
        .collect()
}

pub fn parse(bytes: Vec<u8>) -> AppResult<Preview> {
    if bytes.is_empty() || bytes.len() as u64 > MAX_ZIP {
        return Err("The Kanka ZIP is empty or larger than 50 MB.".into());
    }
    let mut zip = ZipArchive::new(Cursor::new(bytes))
        .map_err(|_| "This file is not a valid ZIP.".to_string())?;
    if zip.len() > 5000 {
        return Err("The Kanka ZIP has too many files.".into());
    }
    let version = version(&mut zip)?;
    if !supported(&version) {
        return Err("Kanka export version 2.1 or later is required.".into());
    }
    let mut entities = Vec::new();
    let mut warnings = Vec::new();
    let mut total = 0_u64;
    for index in 0..zip.len() {
        let mut file = zip
            .by_index(index)
            .map_err(|_| "Cannot read a file in the Kanka ZIP.".to_string())?;
        if file.is_dir() {
            continue;
        }
        let name = file
            .name()
            .map_err(|_| "The Kanka ZIP contains an unsafe file name.".to_string())?
            .replace('\\', "/");
        if name.starts_with('/')
            || name.contains(':')
            || name
                .split('/')
                .any(|part| part == ".." || part == "." || part.is_empty())
        {
            return Err("The Kanka ZIP contains an unsafe file name.".into());
        }
        total = total.saturating_add(file.size());
        if total > MAX_EXPANDED {
            return Err("The Kanka ZIP expands beyond 100 MB.".into());
        }
        let Some(kind) = category(&name) else {
            continue;
        };
        if !name.ends_with(".json") {
            continue;
        }
        if file.size() > 1_000_000 {
            warnings.push(format!("{name}: larger than 1 MB, skipped"));
            continue;
        }
        let original = read_limited(&mut file, 1_000_000)?;
        let Ok(value) = serde_json::from_str::<Value>(&original) else {
            warnings.push(format!("{name}: invalid JSON, skipped"));
            continue;
        };
        let Some(entity) = value.get("entity").filter(|v| v.is_object()) else {
            warnings.push(format!("{name}: no entity data, skipped"));
            continue;
        };
        let entity_name = {
            let own = text(entity.get("name"), 200);
            if own.trim().is_empty() {
                text(value.get("name"), 200)
            } else {
                own
            }
        };
        let source_id = id(entity.get("id"));
        if entity_name.trim().is_empty() || source_id.is_empty() {
            warnings.push(format!("{name}: missing name or entity ID, skipped"));
            continue;
        }
        if entities.len() >= MAX_ENTITIES {
            return Err("The Kanka export has more than 2000 supported entities.".into());
        }
        let relations = relations(entity, &mut warnings, &entity_name);
        entities.push(Entity {
            path: name,
            source_id,
            name: entity_name.trim().to_string(),
            kind: kind.into(),
            entry: text(entity.get("entry"), 200_000),
            original,
            relations,
        });
    }
    if entities.is_empty() {
        return Err("No supported Kanka entities were found in this ZIP.".into());
    }
    entities.sort_by(|a, b| a.path.cmp(&b.path));
    warnings.truncate(40);
    Ok(Preview {
        version,
        entities,
        warnings,
    })
}

#[tauri::command]
pub async fn inspect_kanka_export(app: tauri::AppHandle) -> AppResult<Option<Preview>> {
    crate::blocking(app, "Kanka inspection interrupted.", move |app| {
        use tauri_plugin_dialog::DialogExt;
        let Some(file) = app
            .dialog()
            .file()
            .add_filter("Kanka JSON ZIP", &["zip"])
            .set_title("Choose a Kanka JSON export ZIP")
            .blocking_pick_file()
        else {
            return Ok(None);
        };
        let path = file
            .into_path()
            .map_err(|_| "Choose a Kanka ZIP on this computer.".to_string())?;
        let meta =
            std::fs::metadata(&path).map_err(|_| "Cannot read the Kanka ZIP.".to_string())?;
        if meta.len() > MAX_ZIP {
            return Err("The Kanka ZIP is empty or larger than 50 MB.".into());
        }
        parse(std::fs::read(path).map_err(|_| "Cannot read the Kanka ZIP.".to_string())?).map(Some)
    })
    .await
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use zip::{write::SimpleFileOptions, ZipWriter};

    fn archive(files: &[(&str, &str)]) -> Vec<u8> {
        let mut cursor = Cursor::new(Vec::new());
        {
            let mut zip = ZipWriter::new(&mut cursor);
            for (name, body) in files {
                zip.start_file(*name, SimpleFileOptions::default()).unwrap();
                zip.write_all(body.as_bytes()).unwrap();
            }
            zip.finish().unwrap();
        }
        cursor.into_inner()
    }

    const WITNESS: &str = r#"{"id":7,"title":"Clerk","name":"Witness","entity":{"id":42,"entity_id":7,"name":"Witness","type_id":1,"entry":"<p>A claim</p>","relationships":[{"id":3,"owner_id":42,"target_id":5,"relation":"owes money to","mirror_id":4,"attitude":0},{"id":9,"owner_id":42,"target_id":5,"relation":"  ","mirror_id":null}]}}"#;
    const PORT: &str =
        r#"{"id":2,"name":"Port","entity":{"id":5,"name":"Port","entry":null,"relationships":[]}}"#;

    #[test]
    fn synthetic_export_uses_entity_ids_and_keeps_relations_as_candidates() {
        let preview = parse(archive(&[
            (
                "info.json",
                r#"{"kanka_version":"2.6.1","export_version":1}"#,
            ),
            ("campaign.json", r#"{"name":"Synthetic"}"#),
            ("settings/modules.json", "{}"),
            ("characters/witness_42.json", WITNESS),
            ("locations/port_5.json", PORT),
            ("gallery/1.json", r#"{"entity":{"id":1,"name":"Image"}}"#),
            ("characters/broken_8.json", "{"),
        ]))
        .unwrap();
        assert_eq!(preview.version, "2.6.1");
        assert_eq!(preview.entities.len(), 2);
        let witness = preview
            .entities
            .iter()
            .find(|e| e.name == "Witness")
            .unwrap();
        assert_eq!(
            (witness.kind.as_str(), witness.source_id.as_str()),
            ("npc", "42")
        );
        assert_eq!(witness.entry, "<p>A claim</p>");
        assert_eq!(witness.relations.len(), 1, "blank labels are dropped");
        assert_eq!(witness.relations[0].target_id, "5");
        assert_eq!(witness.relations[0].mirror_id, "4");
        assert!(witness.original.contains("owes money to"));
        assert_eq!(preview.warnings.len(), 1);
    }

    #[test]
    fn documented_info_md_with_double_colon_is_accepted_and_old_exports_refused() {
        let ok = parse(archive(&[
            ("info.md", "# Export\nkanka_version:: 2.1.0\n"),
            ("locations/port_5.json", PORT),
        ]))
        .unwrap();
        assert_eq!(ok.version, "2.1.0");
        assert!(parse(archive(&[
            ("info.md", "kanka_version: 2.0.9\n"),
            ("locations/port_5.json", PORT),
        ]))
        .is_err());
        assert!(parse(archive(&[("locations/port_5.json", PORT)])).is_err());
    }

    #[test]
    fn unsafe_names_are_rejected() {
        assert!(parse(archive(&[
            ("info.json", r#"{"kanka_version":"2.1"}"#),
            ("characters/../../evil.json", WITNESS),
        ]))
        .is_err());
    }
}
