use crate::{db, journal::AppResult};
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Preview {
    pub content: String,
}

fn content() -> AppResult<String> {
    // Deliberately use an allowlist. Neither the archive nor application logs
    // are read: both can contain names, paths, campaign prose and credentials.
    let value = serde_json::json!({
        "format": "chronexus-diagnostics-v1",
        "appVersion": env!("CARGO_PKG_VERSION"),
        "operatingSystem": std::env::consts::OS,
        "architecture": std::env::consts::ARCH,
        "schemaVersion": db::LATEST_SCHEMA,
        "features": { "localArchive": true, "manualBackup": true, "localAiOptional": true, "sharingOptional": true },
        "recentErrors": [],
        "logExcerpts": [],
        "note": "Chronexus does not retain a diagnostic error log. No campaign content is included."
    });
    serde_json::to_string_pretty(&value).map_err(|_| "Cannot prepare diagnostics.".into())
}

#[tauri::command]
pub async fn preview_diagnostics() -> AppResult<Preview> {
    Ok(Preview {
        content: content()?,
    })
}

#[tauri::command]
pub async fn save_diagnostics(app: tauri::AppHandle, content: String) -> AppResult<bool> {
    let expected = self::content()?;
    if content != expected || content.len() > 8192 {
        return Err("Diagnostic preview changed. Preview it again before saving.".into());
    }
    crate::blocking(app, "Diagnostic save interrupted.", move |app| {
        use tauri_plugin_dialog::DialogExt;
        let path = app
            .dialog()
            .file()
            .add_filter("JSON", &["json"])
            .set_title("Save Chronexus diagnostics")
            .set_file_name("chronexus-diagnostics.json")
            .blocking_save_file();
        let Some(path) = path else { return Ok(false) };
        let path = path
            .into_path()
            .map_err(|_| "Choose a local file.".to_string())?;
        if path.exists() {
            return Err("Choose a new diagnostic file name.".into());
        }
        let parent = path.parent().ok_or("Choose a local file.")?;
        let mut file = tempfile::NamedTempFile::new_in(parent)
            .map_err(|_| "Cannot create the diagnostic file.".to_string())?;
        use std::io::Write;
        file.write_all(expected.as_bytes())
            .map_err(|_| "Cannot write the diagnostic file.".to_string())?;
        file.persist_noclobber(path)
            .map_err(|_| "Cannot save the diagnostic file.".to_string())?;
        Ok(true)
    })
    .await
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn preview_is_bounded_and_contains_no_private_data() {
        let report = content().unwrap();
        assert!(report.len() < 8192);
        assert!(!report.contains("campaignId"));
        assert!(!report.contains("token"));
        assert!(!report.contains("C:\\Users"));
        assert_eq!(
            serde_json::from_str::<serde_json::Value>(&report).unwrap()["schemaVersion"],
            db::LATEST_SCHEMA
        );
    }
}
