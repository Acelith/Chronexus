mod db;
mod journal;
#[cfg(test)]
mod journal_tests;
mod knowledge;
#[cfg(test)]
mod knowledge_tests;
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

#[tauri::command]
fn list_pages(db: tauri::State<Database>, campaign_id: String) -> AppResult<Vec<knowledge::Page>> {
    db.with(|c| knowledge::list_pages(c, &campaign_id))
}
#[tauri::command]
fn create_page(
    db: tauri::State<Database>,
    campaign_id: String,
    title: String,
    kind: String,
    status: String,
    aliases: Vec<String>,
) -> AppResult<knowledge::Page> {
    db.with(|c| knowledge::create_page(c, &campaign_id, &title, &kind, &status, &aliases))
}
#[tauri::command]
fn update_page(
    db: tauri::State<Database>,
    campaign_id: String,
    id: String,
    title: String,
    kind: String,
    status: String,
    aliases: Vec<String>,
) -> AppResult<knowledge::Page> {
    db.with(|c| knowledge::update_page(c, &campaign_id, &id, &title, &kind, &status, &aliases))
}
#[tauri::command]
fn save_page_document(
    db: tauri::State<Database>,
    campaign_id: String,
    id: String,
    revision: i64,
    document: serde_json::Value,
) -> AppResult<knowledge::Page> {
    db.with(|c| knowledge::save_page_document(c, &campaign_id, &id, revision, document))
}
#[tauri::command]
fn get_backlinks(
    db: tauri::State<Database>,
    campaign_id: String,
    id: String,
) -> AppResult<Vec<knowledge::Backlink>> {
    db.with(|c| knowledge::backlinks(c, &campaign_id, &id))
}
#[tauri::command]
fn recover_page(
    db: tauri::State<Database>,
    campaign_id: String,
    id: String,
    title: String,
) -> AppResult<knowledge::Page> {
    db.with(|c| knowledge::recover_page(c, &campaign_id, &id, &title))
}

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Keep the window usable when initialization fails so the UI can explain recovery.
            let connection = (|| -> Result<_, Box<dyn std::error::Error>> {
                let directory = app.path().app_data_dir()?;
                #[cfg(debug_assertions)]
                let directory = match std::env::var_os("NODEX_DEV_DATA_DIR") {
                    Some(path) => {
                        let path = std::path::PathBuf::from(path);
                        if !path.is_absolute() { return Err("NODEX_DEV_DATA_DIR deve essere assoluta".into()); }
                        path
                    },
                    None => directory,
                };
                std::fs::create_dir_all(&directory)?;
                Ok(Mutex::new(db::open(&directory.join("nodex.sqlite3"))?))
            })().map_err(|error| format!("Archivio non disponibile: {error}. Verifica spazio e permessi della cartella dati e riavvia Nodex. Se usi una versione precedente, torna a quella più recente."));
            app.manage(Database(connection));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![list_campaigns,create_campaign,rename_campaign,list_sessions,create_session,save_document,list_pages,create_page,update_page,save_page_document,get_backlinks,recover_page])
        .run(tauri::generate_context!())
        .expect("Impossibile avviare la finestra Nodex.");
}
