mod db;
mod journal;
#[cfg(test)]
mod journal_tests;
use journal::{AppResult, Campaign, Session};
use std::sync::Mutex;
use tauri::Manager;

struct Database(Result<Mutex<rusqlite::Connection>, String>);
impl Database {
    fn with<T>(&self, action: impl FnOnce(&rusqlite::Connection) -> AppResult<T>) -> AppResult<T> {
        let connection = self.0.as_ref().map_err(Clone::clone)?.lock().map_err(|_| {
            "Archivio occupato. Riavvia Nodex senza chiudere gli appunti non salvati.".to_string()
        })?;
        action(&connection)
    }
}

#[tauri::command]
fn list_campaigns(db: tauri::State<Database>) -> AppResult<Vec<Campaign>> {
    db.with(journal::list_campaigns)
}
#[tauri::command]
fn create_campaign(db: tauri::State<Database>, name: String) -> AppResult<Campaign> {
    db.with(|c| journal::create_campaign(c, &name))
}
#[tauri::command]
fn rename_campaign(db: tauri::State<Database>, id: String, name: String) -> AppResult<Campaign> {
    db.with(|c| journal::rename_campaign(c, &id, &name))
}
#[tauri::command]
fn list_sessions(db: tauri::State<Database>, campaign_id: String) -> AppResult<Vec<Session>> {
    db.with(|c| journal::list_sessions(c, &campaign_id))
}
#[tauri::command]
fn create_session(
    db: tauri::State<Database>,
    campaign_id: String,
    sequence: i64,
    title: String,
    played_on: Option<String>,
) -> AppResult<Session> {
    db.with(|c| journal::create_session(c, &campaign_id, sequence, &title, played_on))
}
#[tauri::command]
fn save_document(
    db: tauri::State<Database>,
    campaign_id: String,
    id: String,
    revision: i64,
    document: serde_json::Value,
) -> AppResult<Session> {
    db.with(|c| journal::save_document(c, &campaign_id, &id, revision, document))
}

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Keep the window usable when initialization fails so the UI can explain recovery.
            let connection = (|| -> Result<_, Box<dyn std::error::Error>> {
                let directory = app.path().app_data_dir()?;
                std::fs::create_dir_all(&directory)?;
                Ok(Mutex::new(db::open(&directory.join("nodex.sqlite3"))?))
            })().map_err(|error| format!("Archivio non disponibile: {error}. Verifica spazio e permessi della cartella dati e riavvia Nodex. Se usi una versione precedente, torna a quella più recente."));
            app.manage(Database(connection));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![list_campaigns,create_campaign,rename_campaign,list_sessions,create_session,save_document])
        .run(tauri::generate_context!())
        .expect("Impossibile avviare la finestra Nodex.");
}
