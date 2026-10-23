mod backup;
#[cfg(test)]
mod backup_tests;
mod catalog;
mod db;
mod graph;
#[cfg(test)]
mod graph_tests;
mod journal;
#[cfg(test)]
mod journal_tests;
mod knowledge;
#[cfg(test)]
mod knowledge_tests;
mod player;
#[cfg(test)]
mod player_tests;
use journal::{AppResult, Campaign, Session};
use std::sync::Mutex;
use tauri::Manager;

struct Database(Result<Mutex<backup::Store>, String>);
impl Database {
    fn with<T>(&self, action: impl FnOnce(&rusqlite::Connection) -> AppResult<T>) -> AppResult<T> {
        let connection = self.0.as_ref().map_err(Clone::clone)?.lock().map_err(|_| {
            "Archivio occupato. Riavvia Chronexus senza chiudere gli appunti non salvati."
                .to_string()
        })?;
        action(&connection.connection)
    }
    fn with_store<T>(
        &self,
        action: impl FnOnce(&mut backup::Store) -> AppResult<T>,
    ) -> AppResult<T> {
        let mut store = self
            .0
            .as_ref()
            .map_err(Clone::clone)?
            .lock()
            .map_err(|_| "Archivio occupato. Riavvia Chronexus.".to_string())?;
        action(&mut store)
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

#[tauri::command]
fn get_graph(
    db: tauri::State<Database>,
    campaign_id: String,
    query: graph::GraphQuery,
) -> AppResult<graph::GraphData> {
    db.with(|c| graph::graph(c, &campaign_id, query))
}
#[tauri::command]
fn get_relationship(
    db: tauri::State<Database>,
    campaign_id: String,
    id: String,
) -> AppResult<graph::Relationship> {
    db.with(|c| graph::get_relationship(c, &campaign_id, &id))
}
#[tauri::command]
fn save_relationship(
    db: tauri::State<Database>,
    campaign_id: String,
    id: Option<String>,
    revision: Option<i64>,
    input: graph::RelationshipInput,
) -> AppResult<graph::Relationship> {
    db.with(|c| graph::save_relationship(c, &campaign_id, id.as_deref(), revision, input))
}
#[tauri::command]
fn delete_relationship(
    db: tauri::State<Database>,
    campaign_id: String,
    id: String,
    revision: i64,
) -> AppResult<()> {
    db.with(|c| graph::delete_relationship(c, &campaign_id, &id, revision))
}

// Native choosers and archive work run outside the UI thread. Paths are never
// supplied by React: only the native chooser may select an external location.
fn choose_backup_file(app: &tauri::AppHandle, save: bool) -> AppResult<Option<std::path::PathBuf>> {
    // Reproducible desktop tests can supply only the chooser result, never the
    // archive data. This branch is absent from release builds and requires an
    // explicit isolated developer profile as well as a developer-selected file.
    #[cfg(debug_assertions)]
    if std::env::var_os("NODEX_DEV_DATA_DIR").is_some() {
        let key = if save {
            "NODEX_DEV_BACKUP_FILE"
        } else {
            "NODEX_DEV_RESTORE_FILE"
        };
        if let Some(path) = std::env::var_os(key) {
            let path = std::path::PathBuf::from(path);
            if !path.is_absolute() {
                return Err(format!("{key} deve essere assoluta."));
            }
            return Ok(Some(path));
        }
    }
    use tauri_plugin_dialog::DialogExt;
    let dialog = app
        .dialog()
        .file()
        .add_filter("Archivio Chronexus", &["nodex"]);
    let file = if save {
        dialog
            .set_title("Salva backup Chronexus — scegli un nuovo nome")
            .set_file_name(format!("nodex-{}.nodex", uuid::Uuid::new_v4()))
            .blocking_save_file()
    } else {
        dialog
            .set_title("Seleziona un backup Chronexus da verificare")
            .blocking_pick_file()
    };
    file.map(|f| {
        f.into_path()
            .map_err(|_| "Scegli un file locale o su un disco montato.".to_string())
    })
    .transpose()
}
#[tauri::command]
async fn create_backup(app: tauri::AppHandle) -> AppResult<Option<backup::BackupReceipt>> {
    tauri::async_runtime::spawn_blocking(move || {
        let Some(path) = choose_backup_file(&app, true)? else {
            return Ok(None);
        };
        app.state::<Database>().with_store(|store| {
            backup::write_backup(&store.connection, &store.directory, &path).map(Some)
        })
    })
    .await
    .map_err(|_| "Operazione interrotta. Riprova il backup.".to_string())?
}
#[tauri::command]
async fn inspect_backup(app: tauri::AppHandle) -> AppResult<Option<backup::Preview>> {
    tauri::async_runtime::spawn_blocking(move || {
        app.state::<Database>().with_store(|store| {
            store.pending = None;
            Ok(())
        })?;
        let Some(path) = choose_backup_file(&app, false)? else {
            return Ok(None);
        };
        app.state::<Database>()
            .with_store(|store| store.prepare(&path).map(Some))
    })
    .await
    .map_err(|_| "Verifica interrotta. Seleziona nuovamente il backup.".to_string())?
}
#[tauri::command]
async fn restore_backup(app: tauri::AppHandle, token: String) -> AppResult<backup::RestoreReceipt> {
    tauri::async_runtime::spawn_blocking(move || {
        app.state::<Database>()
            .with_store(|store| store.restore(&token))
    })
    .await
    .map_err(|_| {
        "Ripristino interrotto. Riavvia Chronexus e controlla l'archivio attivo prima di riprovare."
            .to_string()
    })?
}
#[tauri::command]
fn cancel_restore(db: tauri::State<Database>) -> AppResult<()> {
    db.with_store(|store| {
        store.pending = None;
        Ok(())
    })
}

#[tauri::command]
fn get_character(
    db: tauri::State<Database>,
    campaign_id: String,
) -> AppResult<Option<player::Character>> {
    db.with(|c| player::get_character(c, &campaign_id))
}
#[tauri::command]
fn save_character(
    db: tauri::State<Database>,
    campaign_id: String,
    id: Option<String>,
    revision: Option<i64>,
    input: player::CharacterInput,
) -> AppResult<player::Character> {
    db.with(|c| player::save_character(c, &campaign_id, id.as_deref(), revision, input))
}
#[tauri::command]
fn change_character_counter(
    db: tauri::State<Database>,
    campaign_id: String,
    id: String,
    revision: i64,
    target: String,
    delta: i64,
) -> AppResult<player::Character> {
    db.with(|c| player::change_counter(c, &campaign_id, &id, revision, &target, delta))
}
#[tauri::command]
fn list_player_assets(
    db: tauri::State<Database>,
    campaign_id: String,
    character_id: String,
) -> AppResult<Vec<player::Asset>> {
    db.with(|c| player::list_assets(c, &campaign_id, &character_id))
}
#[tauri::command]
fn save_player_asset(
    db: tauri::State<Database>,
    campaign_id: String,
    character_id: String,
    id: Option<String>,
    revision: Option<i64>,
    input: player::AssetInput,
) -> AppResult<player::Asset> {
    db.with(|c| {
        player::save_asset(
            c,
            &campaign_id,
            &character_id,
            id.as_deref(),
            revision,
            input,
        )
    })
}
#[tauri::command]
fn delete_player_asset(
    db: tauri::State<Database>,
    campaign_id: String,
    character_id: String,
    id: String,
    revision: i64,
) -> AppResult<()> {
    db.with(|c| player::delete_asset(c, &campaign_id, &character_id, &id, revision))
}

#[tauri::command]
fn read_catalog_cache(
    db: tauri::State<Database>,
    path: String,
) -> AppResult<Option<catalog::CacheEntry>> {
    db.with(|c| catalog::read(c, &path))
}
#[tauri::command]
fn store_catalog_cache(
    db: tauri::State<Database>,
    path: String,
    payload: serde_json::Value,
) -> AppResult<catalog::CacheEntry> {
    db.with(|c| catalog::store(c, &path, payload))
}
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
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
                let store = backup::Store::open(&directory).map_err(std::io::Error::other)?;
                Ok(Mutex::new(store))
            })().map_err(|error| format!("Archivio non disponibile: {error}. Verifica spazio e permessi della cartella dati e riavvia Chronexus. Se usi una versione precedente, torna a quella più recente."));
            app.manage(Database(connection));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![list_campaigns,create_campaign,rename_campaign,list_sessions,create_session,save_document,list_pages,create_page,update_page,save_page_document,get_backlinks,recover_page,get_graph,get_relationship,save_relationship,delete_relationship,create_backup,inspect_backup,restore_backup,cancel_restore,get_character,save_character,change_character_counter,list_player_assets,save_player_asset,delete_player_asset,read_catalog_cache,store_catalog_cache])
        .run(tauri::generate_context!())
        .expect("Impossibile avviare la finestra Chronexus.");
}
