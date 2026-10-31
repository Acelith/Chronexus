use crate::{db, journal::AppResult};
use serde::Serialize;
use std::collections::VecDeque;
use std::sync::{Mutex, OnceLock};

// Only typed events can enter the buffer: no message, path or payload is accepted.
#[derive(Clone, Copy, Serialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum Event {
    ArchiveOperationFailed,
    ArchiveUnavailable,
    OperationInterrupted,
}
#[derive(Clone, Serialize)]
struct Entry {
    sequence: u64,
    event: Event,
}
#[derive(Default)]
struct Buffer {
    sequence: u64,
    events: VecDeque<Entry>,
    previews: VecDeque<String>,
}
static BUFFER: OnceLock<Mutex<Buffer>> = OnceLock::new();
fn buffer() -> &'static Mutex<Buffer> {
    BUFFER.get_or_init(|| Mutex::new(Buffer::default()))
}
pub(crate) fn record(event: Event) {
    if let Ok(mut state) = buffer().lock() {
        state.sequence = state.sequence.saturating_add(1);
        let sequence = state.sequence;
        state.events.push_back(Entry { sequence, event });
        while state.events.len() > 32 {
            state.events.pop_front();
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Preview {
    pub content: String,
}

fn content() -> AppResult<String> {
    // Deliberately use an allowlist. Neither the archive nor application logs
    // are read: both can contain names, paths, campaign prose and credentials.
    let events = buffer()
        .lock()
        .map(|s| s.events.clone())
        .unwrap_or_default();
    let value = serde_json::json!({
        "format": "chronexus-diagnostics-v1",
        "appVersion": env!("CARGO_PKG_VERSION"),
        "operatingSystem": std::env::consts::OS,
        "architecture": std::env::consts::ARCH,
        "schemaVersion": db::LATEST_SCHEMA,
        "features": { "localArchive": true, "manualBackup": true, "localAiOptional": true, "sharingOptional": true },
        "recentErrors": events,
        "logExcerpts": events,
        "note": "Session-only fixed event codes; no raw error messages, paths or campaign content."
    });
    serde_json::to_string_pretty(&value).map_err(|_| "Cannot prepare diagnostics.".into())
}

#[tauri::command]
pub async fn preview_diagnostics() -> AppResult<Preview> {
    let content = content()?;
    let mut state = buffer().lock().map_err(|_| "Cannot prepare diagnostics.")?;
    state.previews.push_back(content.clone());
    while state.previews.len() > 4 {
        state.previews.pop_front();
    }
    Ok(Preview { content })
}

#[tauri::command]
pub async fn save_diagnostics(app: tauri::AppHandle, content: String) -> AppResult<bool> {
    let valid = buffer()
        .lock()
        .map(|s| s.previews.contains(&content))
        .unwrap_or(false);
    if !valid || content.len() > 8192 {
        return Err("Diagnostic preview changed. Preview it again before saving.".into());
    }
    let expected = content;
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
    fn fixed_event_buffer_is_bounded_and_cannot_capture_payloads() {
        for _ in 0..100 {
            record(Event::ArchiveOperationFailed);
        }
        let report = content().unwrap();
        let value: serde_json::Value = serde_json::from_str(&report).unwrap();
        assert!(value["recentErrors"].as_array().unwrap().len() <= 32);
        assert!(report.contains("archive_operation_failed"));
        assert!(!report.contains("password"));
        assert!(report.len() < 8192);
    }
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
