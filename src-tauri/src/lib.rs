mod ai_setup;
mod assistant;
mod automation;
mod backup;
mod backup_folder;
#[cfg(test)]
mod backup_tests;
mod catalog;
mod commands;
mod db;
mod dice;
mod export;
#[cfg(test)]
mod export_tests;
mod graph;
#[cfg(test)]
mod graph_tests;
mod images;
#[cfg(test)]
mod images_tests;
mod import_sources;
#[cfg(test)]
mod import_sources_tests;
mod journal;
#[cfg(test)]
mod journal_tests;
mod json_file;
mod knowledge;
#[cfg(test)]
mod knowledge_tests;
mod party;
#[cfg(test)]
mod party_tests;
mod player;
#[cfg(test)]
mod player_tests;
mod preferences;
mod search;
#[cfg(test)]
mod search_tests;
#[cfg(test)]
mod test_support;
mod updates;
mod wiki;
mod wiki_provider;
mod wiki_translation;
mod wikidot;
use journal::AppResult;
use std::sync::{Arc, Mutex};
use tauri::Emitter;
use tauri::Manager;

/// The archive shared by commands, the automation bridge and background work.
/// Commands reach it through [`Database::run`]/[`Database::run_store`], which
/// wait for the Store lock on the blocking pool: Tauri runs non-async commands
/// on the main thread, where waiting behind a backup or restore froze the UI.
pub(crate) struct Database {
    store: Result<Arc<Mutex<backup::Store>>, String>,
    /// Fixed for the process lifetime (restores switch only the profile directory).
    root: Option<std::path::PathBuf>,
}
/// Runs blocking work (dialogs, archive files, image decoding) on the blocking
/// pool; `interrupted` is reported if the task panics or is cancelled.
pub(crate) async fn blocking<T: Send + 'static>(
    app: tauri::AppHandle,
    interrupted: &'static str,
    job: impl FnOnce(tauri::AppHandle) -> AppResult<T> + Send + 'static,
) -> AppResult<T> {
    tauri::async_runtime::spawn_blocking(move || job(app))
        .await
        .map_err(|_| interrupted.to_string())?
}
const POISONED: &str = "Archive busy. Restart Chronexus without closing unsaved notes.";
const INTERRUPTED: &str = "Operation interrupted. Try again: nothing was confirmed.";
impl Database {
    pub(crate) fn new(store: Result<Arc<Mutex<backup::Store>>, String>) -> Self {
        let root = store
            .as_ref()
            .ok()
            .and_then(|s| s.lock().ok().map(|s| s.root.clone()));
        Self { store, root }
    }
    pub(crate) fn shared(&self) -> AppResult<Arc<Mutex<backup::Store>>> {
        self.store.as_ref().map(Arc::clone).map_err(Clone::clone)
    }
    /// Data root outside restore generations, available without the Store lock.
    pub(crate) fn root(&self) -> AppResult<std::path::PathBuf> {
        match (&self.store, &self.root) {
            (Err(error), _) => Err(error.clone()),
            (Ok(_), Some(root)) => Ok(root.clone()),
            (Ok(_), None) => Err(POISONED.into()),
        }
    }
    #[cfg(test)]
    pub(crate) fn with<T>(
        &self,
        action: impl FnOnce(&rusqlite::Connection) -> AppResult<T>,
    ) -> AppResult<T> {
        self.with_store(|store| action(&store.connection))
    }
    pub(crate) fn with_store<T>(
        &self,
        action: impl FnOnce(&mut backup::Store) -> AppResult<T>,
    ) -> AppResult<T> {
        let shared = self.store.as_ref().map_err(Clone::clone)?;
        let mut store = shared.lock().map_err(|_| POISONED.to_string())?;
        action(&mut store)
    }
    pub(crate) async fn run<T: Send + 'static>(
        &self,
        action: impl FnOnce(&rusqlite::Connection) -> AppResult<T> + Send + 'static,
    ) -> AppResult<T> {
        self.run_store(move |store| action(&store.connection)).await
    }
    pub(crate) async fn run_store<T: Send + 'static>(
        &self,
        action: impl FnOnce(&mut backup::Store) -> AppResult<T> + Send + 'static,
    ) -> AppResult<T> {
        let shared = self.shared()?;
        tauri::async_runtime::spawn_blocking(move || {
            let mut store = shared.lock().map_err(|_| POISONED.to_string())?;
            action(&mut store)
        })
        .await
        .map_err(|_| INTERRUPTED.to_string())?
    }
}

pub fn run() {
    let application = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(updates::State::default())
        .manage(assistant::service::State::default())
        .manage(wikidot::State::default())
        .manage(ai_setup::State::default())
        .setup(|app| {
            // Keep the window usable when initialization fails so the UI can explain recovery.
            let connection = (|| -> Result<_, Box<dyn std::error::Error>> {
                let directory = app.path().app_data_dir()?;
                #[cfg(debug_assertions)]
                let directory = match std::env::var_os("NODEX_DEV_DATA_DIR") {
                    Some(path) => {
                        let path = std::path::PathBuf::from(path);
                        if !path.is_absolute() { return Err("NODEX_DEV_DATA_DIR must be absolute".into()); }
                        path
                    },
                    None => directory,
                };
                // An earlier install leaves its SQLite archive here; see keep_legacy_italian.
                let archive_existed = directory.join("nodex.sqlite3").exists()
                    || directory.join("active-profile.json").exists();
                std::fs::create_dir_all(&directory)?;
                let store = backup::Store::open(&directory).map_err(std::io::Error::other)?;
                // A failure only means the app opens in English; it never blocks the archive.
                let _ = preferences::keep_legacy_italian(&store.root, archive_existed);
                assistant::store::recover(&store.connection).map_err(std::io::Error::other)?;
                assistant::training::recover(&store.connection).map_err(std::io::Error::other)?;
                Ok(Arc::new(Mutex::new(store)))
            })().map_err(|error| format!("Archive not available: {error}. Check space and permissions of the data folder and restart Chronexus. If you are using an older version, go back to the most recent one."));
            app.manage(Database::new(connection));
            if let Some(config)=automation::Config::parse(std::env::args()).map_err(std::io::Error::other)? {
                let state=app.state::<Database>();
                let store=state.shared().map_err(std::io::Error::other)?;
                let root=state.root().map_err(std::io::Error::other)?;
                let handle=app.handle().clone();
                let server=automation::Server::start(&root,config,store,Arc::new(move|campaign|{let _=handle.emit("chronexus:external-change",campaign);})).map_err(std::io::Error::other)?;
                app.manage(server);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            backup_folder::commands::get_backup_settings,
            backup_folder::commands::save_backup_schedule,
            backup_folder::commands::choose_backup_destination,
            backup_folder::commands::reset_backup_destination,
            backup_folder::commands::list_backup_files,
            backup_folder::commands::inspect_listed_backup,
            backup_folder::commands::copy_legacy_update_backup,
            backup_folder::commands::open_backup_folder,
            backup_folder::commands::periodic_backup_tick,
            backup_folder::commands::run_periodic_backup_now,
            commands::ai::ai_setup_status,
            commands::ai::ai_install_runtime,
            commands::ai::ai_start_runtime,
            commands::ai::ai_stop_runtime,
            commands::ai::ai_pull_model,
            commands::ai::ai_cancel_setup,
            commands::ai::ai_remove_runtime,
            commands::ai::get_training_overview,
            commands::ai::start_campaign_training,
            commands::ai::activate_campaign_training,
            commands::ai::get_campaign_ai,
            commands::ai::save_campaign_ai,
            commands::ai::refresh_campaign_ai,
            commands::ai::get_ai_settings,
            commands::ai::configure_local_ai,
            commands::ai::ask_local_ai,
            commands::ai::cancel_local_ai,
            commands::ai::list_ai_history,
            commands::ai::delete_ai_turn,
            commands::ai::check_ai_source,
            commands::ai::list_ai_rule_sources,
            commands::ai::probe_local_ai,
            commands::archive::create_backup,
            commands::archive::inspect_backup,
            commands::archive::restore_backup,
            commands::archive::cancel_restore,
            commands::archive::export_campaign,
            commands::campaign::roll_dice,
            commands::campaign::list_dice_rolls,
            commands::campaign::list_campaigns,
            commands::campaign::create_campaign,
            commands::campaign::rename_campaign,
            commands::campaign::list_sessions,
            commands::campaign::create_session,
            commands::campaign::save_document,
            commands::knowledge::list_party,
            commands::knowledge::save_party_member,
            commands::knowledge::remove_party_member,
            commands::knowledge::list_pages,
            commands::knowledge::create_page,
            commands::knowledge::update_page,
            commands::knowledge::save_page_document,
            commands::knowledge::get_backlinks,
            commands::knowledge::recover_page,
            commands::knowledge::get_graph,
            commands::knowledge::get_relationship,
            commands::knowledge::save_relationship,
            commands::knowledge::delete_relationship,
            commands::knowledge::get_import_source,
            commands::knowledge::add_import_source,
            commands::knowledge::search_campaign,
            commands::knowledge::rebuild_search_index,
            commands::player::get_character,
            commands::player::save_character,
            commands::player::change_character_counter,
            commands::player::list_player_assets,
            commands::player::save_player_asset,
            commands::player::delete_player_asset,
            commands::player::list_images,
            commands::player::add_image,
            commands::player::read_image,
            commands::player::detach_image,
            commands::player::read_catalog_cache,
            commands::player::store_catalog_cache,
            commands::settings::get_interface_preferences,
            commands::settings::save_interface_preferences,
            commands::wiki::read_wiki_cache,
            commands::wiki::store_wiki_cache,
            commands::wiki::wiki_cache_epoch,
            commands::wiki::get_wiki_provider,
            commands::wiki::save_wiki_provider,
            commands::wiki::wiki_cache_summary,
            commands::wiki::clear_wiki_cache,
            commands::wiki::cancel_wikidot,
            commands::wiki::wikidot_search,
            commands::wiki::wikidot_entry,
            updates::get_update_settings,
            updates::save_update_settings,
            updates::check_app_update,
            updates::download_app_update,
            updates::cancel_app_update,
            updates::install_app_update,
            updates::get_herald_settings,
            updates::save_herald_settings,
            updates::startup_update_check,
            updates::record_update_announcement,
            updates::update_announcement_blocked,
            wiki_translation::read_wiki_translation,
            wiki_translation::translate_wiki,
        ])
        .build(tauri::generate_context!())
        .expect("Cannot start the Chronexus window.");
    application.run(|app, event| {
        if matches!(event, tauri::RunEvent::Exit) {
            app.state::<updates::State>().shutdown();
            app.state::<ai_setup::State>().shutdown();
            if let Some(server) = app.try_state::<automation::Server>() {
                server.shutdown();
            }
        }
    });
}
#[cfg(test)]
mod database_tests {
    use super::*;
    use std::time::{Duration, Instant};
    #[tokio::test(flavor = "current_thread")]
    async fn waiting_for_the_store_does_not_block_the_calling_thread() {
        let dir = tempfile::tempdir().unwrap();
        let db = Database::new(Ok(Arc::new(Mutex::new(
            backup::Store::open(dir.path()).unwrap(),
        ))));
        assert_eq!(
            db.root().unwrap(),
            std::fs::canonicalize(dir.path()).unwrap()
        );
        // A long archive operation (backup, restore) holds the Store lock.
        let shared = db.shared().unwrap();
        let (locked, wait) = std::sync::mpsc::channel();
        let holder = std::thread::spawn(move || {
            let _guard = shared.lock().unwrap();
            locked.send(()).unwrap();
            std::thread::sleep(Duration::from_millis(300));
        });
        wait.recv().unwrap();
        // The single executor thread must keep serving other work meanwhile.
        let ticks = Arc::new(std::sync::atomic::AtomicU32::new(0));
        let counter = Arc::clone(&ticks);
        let ticker = tokio::spawn(async move {
            loop {
                counter.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                tokio::time::sleep(Duration::from_millis(20)).await;
            }
        });
        let start = Instant::now();
        let campaigns = db.run(journal::list_campaigns).await.unwrap();
        assert!(campaigns.is_empty());
        assert!(start.elapsed() >= Duration::from_millis(200));
        assert!(ticks.load(std::sync::atomic::Ordering::SeqCst) >= 5);
        ticker.abort();
        holder.join().unwrap();
        let failed = Database::new(Err("Archive not available.".into()));
        assert_eq!(
            failed.run(journal::list_campaigns).await.unwrap_err(),
            "Archive not available."
        );
        assert!(failed.root().is_err());
    }
}
