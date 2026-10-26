mod ai_setup;
mod assistant;
mod automation;
mod backup;
mod backup_folder;
#[cfg(test)]
mod backup_tests;
mod catalog;
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
mod updates;
mod wiki;
mod wiki_provider;
mod wiki_translation;
mod wikidot;
use journal::{AppResult, Campaign, Session};
use std::sync::{Arc, Mutex};
use tauri::Emitter;
use tauri::Manager;

struct Database(Result<Arc<Mutex<backup::Store>>, String>);
impl Database {
    fn with<T>(&self, action: impl FnOnce(&rusqlite::Connection) -> AppResult<T>) -> AppResult<T> {
        let connection = self.0.as_ref().map_err(Clone::clone)?.lock().map_err(|_| {
            "Archive busy. Restart Chronexus without closing unsaved notes.".to_string()
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
            .map_err(|_| "Archive busy. Restart Chronexus.".to_string())?;
        action(&mut store)
    }
}

#[tauri::command]
fn get_interface_preferences(db: tauri::State<Database>) -> AppResult<preferences::Preferences> {
    db.with_store(|store| preferences::read(&store.root))
}
#[tauri::command]
fn save_interface_preferences(
    db: tauri::State<Database>,
    preferences: preferences::Preferences,
) -> AppResult<preferences::Preferences> {
    db.with_store(|store| preferences::save(&store.root, preferences))
}
#[tauri::command]
fn roll_dice(
    db: tauri::State<Database>,
    campaign_id: String,
    request_id: String,
    selections: Vec<dice::Selection>,
) -> AppResult<dice::Roll> {
    db.with(|c| dice::roll(c, &campaign_id, &request_id, &selections))
}
#[tauri::command]
fn list_dice_rolls(
    db: tauri::State<Database>,
    campaign_id: String,
    before: Option<dice::Cursor>,
) -> AppResult<dice::History> {
    db.with(|c| dice::history(c, &campaign_id, before.as_ref()))
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
    input: knowledge::Metadata,
    expected: knowledge::Metadata,
) -> AppResult<knowledge::Page> {
    db.with(|c| knowledge::update_page_checked(c, &campaign_id, &id, input, expected))
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
                return Err(format!("{key} must be an absolute path."));
            }
            return Ok(Some(path));
        }
    }
    use tauri_plugin_dialog::DialogExt;
    let dialog = app
        .dialog()
        .file()
        .add_filter("Chronexus archive", &["nodex"]);
    let file = if save {
        dialog
            .set_title("Save Chronexus backup — choose a new name")
            .set_file_name(format!("nodex-{}.nodex", uuid::Uuid::new_v4()))
            .blocking_save_file()
    } else {
        dialog
            .set_title("Select a Chronexus backup to verify")
            .blocking_pick_file()
    };
    file.map(|f| {
        f.into_path()
            .map_err(|_| "Choose a local file or one on a mounted disk.".to_string())
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
    .map_err(|_| "Operation interrupted. Try the backup again.".to_string())?
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
    .map_err(|_| "Verification interrupted. Select the backup again.".to_string())?
}
#[tauri::command]
async fn restore_backup(app: tauri::AppHandle, token: String) -> AppResult<backup::RestoreReceipt> {
    tauri::async_runtime::spawn_blocking(move || {
        app.state::<Database>()
            .with_store(|store| store.restore(&token))
    })
    .await
    .map_err(|_| {
        "Restore interrupted. Restart Chronexus and check the active archive before trying again."
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
#[tauri::command]
fn search_campaign(
    db: tauri::State<Database>,
    campaign_id: String,
    query: String,
    kind: Option<String>,
    sort: String,
) -> AppResult<Vec<search::SearchResult>> {
    db.with(|c| search::find(c, &campaign_id, &query, kind.as_deref(), &sort))
}
#[tauri::command]
fn rebuild_search_index(db: tauri::State<Database>) -> AppResult<i64> {
    db.with(search::rebuild)
}
#[tauri::command]
fn list_images(
    db: tauri::State<Database>,
    campaign_id: String,
    target: images::ImageTarget,
) -> AppResult<Vec<images::Attachment>> {
    db.with(|c| images::list(c, &campaign_id, &target))
}
#[tauri::command]
async fn add_image(
    app: tauri::AppHandle,
    campaign_id: String,
    target: images::ImageTarget,
    caption: String,
    role: String,
    data_base64: String,
) -> AppResult<images::Attachment> {
    tauri::async_runtime::spawn_blocking(move || {
        use base64::Engine;
        if data_base64.len() > 28 * 1024 * 1024 {
            return Err("Image too large: up to 20 MiB.".into());
        }
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(data_base64)
            .map_err(|_| "Invalid image data.")?;
        app.state::<Database>().with_store(|s| {
            images::add(
                &s.connection,
                &s.directory,
                &campaign_id,
                &target,
                &caption,
                &role,
                bytes,
            )
        })
    })
    .await
    .map_err(|_| "Image import interrupted.".to_string())?
}
#[tauri::command]
async fn read_image(
    app: tauri::AppHandle,
    campaign_id: String,
    id: String,
    thumbnail: bool,
) -> AppResult<String> {
    tauri::async_runtime::spawn_blocking(move || {
        app.state::<Database>()
            .with_store(|s| images::read(&s.connection, &s.directory, &campaign_id, &id, thumbnail))
    })
    .await
    .map_err(|_| "Image reading interrupted.".to_string())?
}
#[tauri::command]
fn detach_image(db: tauri::State<Database>, campaign_id: String, id: String) -> AppResult<()> {
    db.with(|c| images::detach(c, &campaign_id, &id))
}
#[tauri::command]
async fn export_campaign(
    app: tauri::AppHandle,
    campaign_id: String,
) -> AppResult<Option<export::ExportReceipt>> {
    tauri::async_runtime::spawn_blocking(move || {
        let path = {
            #[cfg(debug_assertions)]
            let predefined = if std::env::var_os("NODEX_DEV_DATA_DIR").is_some() {
                std::env::var_os("NODEX_DEV_EXPORT_FILE").map(std::path::PathBuf::from)
            } else {
                None
            };
            #[cfg(not(debug_assertions))]
            let predefined: Option<std::path::PathBuf> = None;
            if let Some(path) = predefined {
                Some(path)
            } else {
                use tauri_plugin_dialog::DialogExt;
                app.dialog()
                    .file()
                    .add_filter("Campaign as Markdown and JSON", &["zip"])
                    .set_title("Export campaign — choose a new name")
                    .set_file_name(format!("chronexus-export-{}.zip", uuid::Uuid::new_v4()))
                    .blocking_save_file()
                    .map(|f| {
                        f.into_path()
                            .map_err(|_| "Choose a file on a local or mounted disk.")
                    })
                    .transpose()?
            }
        };
        let Some(path) = path else {
            return Ok(None);
        };
        app.state::<Database>().with_store(|s| {
            export::write_export(&s.connection, &s.directory, &campaign_id, &path).map(Some)
        })
    })
    .await
    .map_err(|_| "Export interrupted. Try again with a new file.".to_string())?
}
#[tauri::command]
fn get_import_source(
    db: tauri::State<Database>,
    campaign_id: String,
    kind: String,
    id: String,
) -> AppResult<Option<import_sources::ImportSource>> {
    db.with(|c| import_sources::get(c, &campaign_id, &kind, &id))
}
#[tauri::command]
fn add_import_source(
    db: tauri::State<Database>,
    campaign_id: String,
    kind: String,
    id: String,
    name: String,
    content: String,
) -> AppResult<import_sources::ImportSource> {
    db.with(|c| import_sources::add(c, &campaign_id, &kind, &id, &name, &content))
}

#[tauri::command]
fn list_party(db: tauri::State<Database>, campaign_id: String) -> AppResult<Vec<party::Member>> {
    db.with(|c| party::list(c, &campaign_id))
}
#[tauri::command]
fn save_party_member(
    db: tauri::State<Database>,
    campaign_id: String,
    input: party::MemberInput,
) -> AppResult<party::Member> {
    db.with(|c| party::save(c, &campaign_id, &input))
}
#[tauri::command]
fn remove_party_member(
    db: tauri::State<Database>,
    campaign_id: String,
    page_id: String,
    revision: i64,
) -> AppResult<()> {
    db.with(|c| party::remove(c, &campaign_id, &page_id, revision))
}

#[tauri::command]
fn read_wiki_cache(db: tauri::State<Database>, key: String) -> AppResult<Option<wiki::Entry>> {
    db.with(|c| wiki::read(c, &key))
}
#[tauri::command]
fn store_wiki_cache(
    db: tauri::State<Database>,
    state: tauri::State<wikidot::State>,
    key: String,
    payload: serde_json::Value,
    epoch: Option<u64>,
) -> AppResult<wiki::Entry> {
    db.with(|c| {
        // A clear that happened while the request was pending wins over its result.
        if epoch.is_some_and(|e| e != state.epoch()) {
            return Err(CACHE_CLEARED.into());
        }
        wiki::store(c, &key, payload)
    })
}
const CACHE_CLEARED: &str =
    "The wiki cache was cleared during the request: the copy was not saved.";
#[tauri::command]
fn wiki_cache_epoch(state: tauri::State<wikidot::State>) -> u64 {
    state.epoch()
}
#[tauri::command]
fn get_wiki_provider(db: tauri::State<Database>) -> AppResult<wiki_provider::WikiChoice> {
    db.with_store(|store| wiki_provider::read(&store.root))
}
#[tauri::command]
fn save_wiki_provider(
    db: tauri::State<Database>,
    provider: String,
) -> AppResult<wiki_provider::WikiChoice> {
    db.with_store(|store| wiki_provider::save(&store.root, &provider))
}
#[tauri::command]
fn wiki_cache_summary(db: tauri::State<Database>) -> AppResult<wikidot::CacheSummary> {
    db.with(wikidot::summary)
}
#[tauri::command]
fn clear_wiki_cache(
    db: tauri::State<Database>,
    state: tauri::State<wikidot::State>,
    provider: String,
) -> AppResult<wikidot::CacheSummary> {
    if !["open5e", "wikidot", "all"].contains(&provider.as_str()) {
        return Err("Choose which wiki cache to clear.".into());
    }
    state.invalidate();
    db.with(|c| wikidot::clear(c, &provider))
}
#[tauri::command]
fn cancel_wikidot(state: tauri::State<wikidot::State>) {
    state.cancel();
}
/// Cached copy first; network only when missing or explicitly refreshed.
async fn wikidot_load<T: serde::Serialize + serde::de::DeserializeOwned>(
    db: &Database,
    state: &wikidot::State,
    key: String,
    refresh: bool,
    load: impl std::future::Future<Output = AppResult<T>>,
) -> AppResult<wikidot::Cached<T>> {
    let old = db.with(|c| wikidot::read_raw(c, &key))?;
    let decode = |v: serde_json::Value| -> AppResult<T> {
        serde_json::from_value(v).map_err(|_| "Wikidot copy unreadable.".into())
    };
    if let (Some((value, at)), false) = (&old, refresh) {
        return Ok(wikidot::Cached {
            payload: decode(value.clone())?,
            fetched_at: at.clone(),
            cached: true,
            warning: None,
        });
    }
    let epoch = state.epoch();
    match load.await {
        Ok(fresh) => {
            let value = serde_json::to_value(&fresh).map_err(|_| "Invalid Wikidot copy.")?;
            let at = db.with(|c| {
                if state.epoch() != epoch {
                    return Err(CACHE_CLEARED.into());
                }
                wikidot::store(c, &key, &value)
            })?;
            Ok(wikidot::Cached {
                payload: fresh,
                fetched_at: at,
                cached: false,
                warning: None,
            })
        }
        Err(error) => match old {
            Some((value, at)) => Ok(wikidot::Cached {
                payload: decode(value)?,
                fetched_at: at,
                cached: true,
                warning: Some(format!(
                    "{error} Refresh failed: you are reading the local copy."
                )),
            }),
            None => Err(error),
        },
    }
}
#[tauri::command]
async fn wikidot_search(
    db: tauri::State<'_, Database>,
    state: tauri::State<'_, wikidot::State>,
    category: String,
    query: String,
    refresh: bool,
) -> AppResult<wikidot::SearchResult> {
    wikidot::index_path(&category)?;
    if query.chars().count() > 100 || query.contains('\0') {
        return Err("Enter at most 100 characters.".into());
    }
    let token = state.token();
    let client = wikidot::client()?;
    let base = wikidot::base();
    let index = wikidot_load(
        &db,
        &state,
        format!("index/{category}"),
        refresh,
        wikidot::fetch_index(&client, &state, &base, &category, &token),
    )
    .await?;
    let (total, rows) = wikidot::filter(&index.payload, &query);
    Ok(wikidot::SearchResult {
        category,
        url: index.payload.url,
        fetched_at: index.fetched_at,
        cached: index.cached,
        warning: index.warning,
        index_size: index.payload.rows.len(),
        total,
        rows,
    })
}
#[tauri::command]
async fn wikidot_entry(
    db: tauri::State<'_, Database>,
    state: tauri::State<'_, wikidot::State>,
    page: String,
    refresh: bool,
) -> AppResult<wikidot::Cached<wikidot::Entry>> {
    if wikidot::category_of(&page).is_none() {
        return Err("Wikidot page not allowed.".into());
    }
    let token = state.token();
    let client = wikidot::client()?;
    let base = wikidot::base();
    wikidot_load(
        &db,
        &state,
        format!("entry/{page}"),
        refresh,
        wikidot::fetch_entry(&client, &state, &base, &page, &token),
    )
    .await
}
#[tauri::command]
async fn probe_local_ai() -> AppResult<assistant::runtime::Runtime> {
    let client = assistant::runtime::client()?;
    assistant::runtime::probe_at(&client, assistant::runtime::BASE).await
}
#[tauri::command]
fn get_ai_settings(
    db: tauri::State<Database>,
    campaign_id: Option<String>,
) -> AppResult<assistant::store::Settings> {
    db.with(|c| match campaign_id {
        Some(id) => Ok(assistant::campaign::get(c, &id)?.settings),
        None => assistant::store::settings(c),
    })
}
#[tauri::command]
async fn configure_local_ai(
    db: tauri::State<'_, Database>,
    state: tauri::State<'_, assistant::service::State>,
    enabled: bool,
    model: String,
    multilingual_consent: bool,
    campaign_id: Option<String>,
) -> AppResult<assistant::store::Settings> {
    if assistant::service::busy(&state)? {
        return Err("Cancel the generation before changing the AI configuration.".into());
    }
    if !enabled {
        return db.with(|c| {
            let mut s = match &campaign_id {
                Some(id) => assistant::campaign::get(c, id)?.settings,
                None => assistant::store::settings(c)?,
            };
            s.enabled = false;
            if let Some(id) = &campaign_id {
                let mut p = assistant::campaign::get(c, id)?;
                p.settings = s.clone();
                assistant::campaign::write(c, id, &p)?;
                Ok(s)
            } else {
                assistant::store::set_settings(c, &s)
            }
        });
    }
    if !multilingual_consent {
        return Err("Confirm the multilingual model with local sources; the D&D candidate did not pass the evaluation.".into());
    }
    db.with(|c| assistant::training::model_owned(c, campaign_id.as_deref(), &model))?;
    assistant::runtime::check_model_name(&model)?;
    assistant::models::options(&model)?;
    let client = assistant::runtime::client()?;
    let runtime = assistant::runtime::probe_at(&client, assistant::runtime::BASE).await?;
    let selected=runtime.models.into_iter().find(|m|m.name==model&&!m.dnd_specialized&&m.weight_digest.is_some()).ok_or("Choose a verifiable local multilingual GGUF model. The test D&D model is not qualified.")?;
    assistant::models::verify(&selected.name, selected.weight_digest.as_deref())?;
    db.with(|c| {
        let settings = assistant::store::Settings {
            enabled: true,
            model: selected.name,
            digest: selected.digest,
            specialization: "multilingual-rag".into(),
        };
        if let Some(id) = &campaign_id {
            let mut p = assistant::campaign::get(c, id)?;
            p.settings = settings.clone();
            assistant::campaign::write(c, id, &p)?;
            Ok(settings)
        } else {
            assistant::store::set_settings(c, &settings)
        }
    })
}
#[tauri::command]
fn get_training_overview(
    db: tauri::State<Database>,
    campaign_id: String,
) -> AppResult<assistant::training::Overview> {
    db.with_store(|s| assistant::training::overview(&s.connection, &s.root, &campaign_id))
}
#[tauri::command]
async fn start_campaign_training(
    app: tauri::AppHandle,
    campaign_id: String,
    id: String,
    dataset_hash: String,
    events: tauri::ipc::Channel<serde_json::Value>,
) -> AppResult<assistant::training::Job> {
    assistant::training::start(app, campaign_id, id, dataset_hash, events).await
}
#[tauri::command]
async fn activate_campaign_training(
    app: tauri::AppHandle,
    campaign_id: String,
    id: String,
) -> AppResult<assistant::campaign::Profile> {
    assistant::training::activate_with_restore(app, campaign_id, id).await
}
#[tauri::command]
fn get_campaign_ai(
    db: tauri::State<Database>,
    campaign_id: String,
) -> AppResult<assistant::campaign::Overview> {
    db.with(|c| assistant::campaign::overview(c, &campaign_id))
}
#[tauri::command]
fn save_campaign_ai(
    db: tauri::State<Database>,
    state: tauri::State<assistant::service::State>,
    campaign_id: String,
    profile: assistant::campaign::Profile,
) -> AppResult<assistant::campaign::Profile> {
    if assistant::service::busy(&state)? {
        return Err("Wait for or cancel the AI operation before changing sources.".into());
    }
    db.with(|c| assistant::campaign::save_preferences(c, &campaign_id, &profile))
}
#[tauri::command]
fn refresh_campaign_ai(
    db: tauri::State<Database>,
    campaign_id: String,
) -> AppResult<assistant::campaign::Overview> {
    db.with(|c| assistant::campaign::refresh(c, &campaign_id))
}
#[tauri::command]
async fn ask_local_ai(
    db: tauri::State<'_, Database>,
    state: tauri::State<'_, assistant::service::State>,
    request: assistant::service::Request,
    events: tauri::ipc::Channel<assistant::service::Event>,
) -> AppResult<assistant::store::Turn> {
    assistant::service::ask(&db, &state, request, events).await
}
#[tauri::command]
fn cancel_local_ai(state: tauri::State<assistant::service::State>, id: String) -> AppResult<()> {
    assistant::service::cancel(&state, &id)
}
#[tauri::command]
fn list_ai_history(
    db: tauri::State<Database>,
    state: tauri::State<assistant::service::State>,
    campaign_id: String,
    offset: u32,
) -> AppResult<Vec<assistant::store::Turn>> {
    db.with(|c| {
        if !assistant::service::busy(&state)? {
            assistant::store::recover(c)?
        }
        assistant::store::history(c, &campaign_id, offset)
    })
}
#[tauri::command]
fn delete_ai_turn(
    db: tauri::State<Database>,
    state: tauri::State<assistant::service::State>,
    campaign_id: String,
    id: String,
) -> AppResult<()> {
    if assistant::service::busy(&state)? {
        return Err("Cancel the generation in progress first.".into());
    }
    db.with(|c| assistant::store::delete(c, &campaign_id, &id))
}
#[tauri::command]
fn check_ai_source(
    db: tauri::State<Database>,
    campaign_id: String,
    turn_id: String,
    key: String,
) -> AppResult<serde_json::Value> {
    db.with(|c| assistant::store::source_state(c, &campaign_id, &turn_id, &key))
}
#[tauri::command]
fn list_ai_rule_sources(
    db: tauri::State<Database>,
    edition: String,
) -> AppResult<serde_json::Value> {
    db.with(|c|{let mut q=c.prepare("SELECT key,payload FROM wiki_cache WHERE key LIKE 'entry/%' ORDER BY fetched_at DESC").map_err(journal::storage)?;let rows=q.query_map([],|r|Ok((r.get::<_,String>(0)?,r.get::<_,String>(1)?))).map_err(journal::storage)?.collect::<rusqlite::Result<Vec<_>>>().map_err(journal::storage)?;let mut out=Vec::new();for (key,raw) in rows{let value:serde_json::Value=serde_json::from_str(&raw).map_err(|_|"Wiki source unreadable.")?;if value["document"]["gamesystem"]["key"].as_str()==Some(&edition){out.push(serde_json::json!({"key":key,"title":value["entry"]["name"],"document":value["document"]["name"]}))}}
        if edition == wikidot::EDITION {
            let mut q = c.prepare("SELECT substr(key,7) FROM wikidot_cache WHERE key LIKE 'entry/%' ORDER BY fetched_at DESC").map_err(journal::storage)?;
            let pages = q.query_map([], |r| r.get::<_, String>(0)).map_err(journal::storage)?.collect::<rusqlite::Result<Vec<_>>>().map_err(journal::storage)?;
            for page in pages {
                if let Some((e, _)) = wikidot::read_entry(c, &page)? {
                    let document = format!("Wikidot D&D 5e · {}", e.source.as_deref().unwrap_or("source not specified"));
                    out.push(serde_json::json!({"key":format!("wikidot/{page}"),"title":e.title,"document":document}));
                }
            }
        }
        Ok(serde_json::json!(out))})
}
fn data_root(db: &Database) -> AppResult<std::path::PathBuf> {
    db.with_store(|s| Ok(s.root.clone()))
}
const AI_SETUP_BUSY: &str = "An AI component operation is already running.";
#[tauri::command]
async fn ai_setup_status(
    db: tauri::State<'_, Database>,
    state: tauri::State<'_, ai_setup::State>,
) -> AppResult<ai_setup::Status> {
    ai_setup::status(&data_root(&db)?, &state, assistant::runtime::BASE).await
}
#[tauri::command]
async fn ai_install_runtime(
    db: tauri::State<'_, Database>,
    state: tauri::State<'_, ai_setup::State>,
    accept: bool,
    events: tauri::ipc::Channel<ai_setup::Progress>,
) -> AppResult<()> {
    if !accept {
        return Err("Confirm size, origin and license before installing Ollama.".into());
    }
    if !ai_setup::SUPPORTED_PLATFORM {
        return Err("Guided installation is currently available only on Windows x64.".into());
    }
    let _gate = state.gate.try_lock().map_err(|_| AI_SETUP_BUSY)?;
    let token = state.token();
    let source = ai_setup::download::Source {
        url: ai_setup::OLLAMA_URL,
        sha256: ai_setup::OLLAMA_SHA256,
        bytes: ai_setup::OLLAMA_BYTES,
        unpacked: ai_setup::OLLAMA_EXTRACTED_BYTES,
        loopback_test: false,
    };
    ai_setup::download::install(&data_root(&db)?, &source, &token, |p| {
        let _ = events.send(p);
    })
    .await
}
#[tauri::command]
async fn ai_start_runtime(
    db: tauri::State<'_, Database>,
    state: tauri::State<'_, ai_setup::State>,
) -> AppResult<String> {
    let _gate = state.gate.try_lock().map_err(|_| AI_SETUP_BUSY)?;
    ai_setup::start(&data_root(&db)?, &state, assistant::runtime::BASE).await
}
#[tauri::command]
fn ai_stop_runtime(
    state: tauri::State<ai_setup::State>,
    service: tauri::State<assistant::service::State>,
) -> AppResult<()> {
    if assistant::service::busy(&service)? {
        return Err("Wait for or cancel the AI answer before stopping the runtime.".into());
    }
    state.shutdown();
    Ok(())
}
#[tauri::command]
async fn ai_pull_model(
    state: tauri::State<'_, ai_setup::State>,
    role: String,
    accept: bool,
    events: tauri::ipc::Channel<ai_setup::Progress>,
) -> AppResult<ai_setup::ModelState> {
    if !accept {
        return Err("Confirm the model size and origin before downloading.".into());
    }
    let _gate = state.gate.try_lock().map_err(|_| AI_SETUP_BUSY)?;
    let token = state.token();
    ai_setup::pull(assistant::runtime::BASE, &role, &token, |p| {
        let _ = events.send(p);
    })
    .await
}
#[tauri::command]
fn ai_cancel_setup(state: tauri::State<ai_setup::State>) {
    state.cancel();
}
#[tauri::command]
fn ai_remove_runtime(
    db: tauri::State<Database>,
    state: tauri::State<ai_setup::State>,
    accept: bool,
) -> AppResult<()> {
    if !accept {
        return Err("Confirm removal of the managed runtime.".into());
    }
    let _gate = state.gate.try_lock().map_err(|_| AI_SETUP_BUSY)?;
    ai_setup::remove_runtime(&data_root(&db)?, &state)
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
            app.manage(Database(connection));
            if let Some(config)=automation::Config::parse(std::env::args()).map_err(std::io::Error::other)? {
                let state=app.state::<Database>();
                let store=Arc::clone(state.0.as_ref().map_err(|e|std::io::Error::other(e.clone()))?);
                let root=store.lock().map_err(|_|std::io::Error::other("Archive busy."))?.root.clone();
                let handle=app.handle().clone();
                let server=automation::Server::start(&root,config,store,Arc::new(move|campaign|{let _=handle.emit("chronexus:external-change",campaign);})).map_err(std::io::Error::other)?;
                app.manage(server);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![backup_folder::commands::get_backup_settings,backup_folder::commands::save_backup_schedule,backup_folder::commands::choose_backup_destination,backup_folder::commands::reset_backup_destination,backup_folder::commands::list_backup_files,backup_folder::commands::inspect_listed_backup,backup_folder::commands::copy_legacy_update_backup,backup_folder::commands::open_backup_folder,backup_folder::commands::periodic_backup_tick,backup_folder::commands::run_periodic_backup_now,ai_setup_status,ai_install_runtime,ai_start_runtime,ai_stop_runtime,ai_pull_model,ai_cancel_setup,ai_remove_runtime,wiki_translation::read_wiki_translation,wiki_translation::translate_wiki,updates::get_update_settings,updates::save_update_settings,updates::check_app_update,updates::download_app_update,updates::cancel_app_update,updates::install_app_update,updates::get_herald_settings,updates::save_herald_settings,updates::startup_update_check,updates::record_update_announcement,updates::update_announcement_blocked,get_interface_preferences,save_interface_preferences,roll_dice,list_dice_rolls,get_training_overview,start_campaign_training,activate_campaign_training,get_campaign_ai,save_campaign_ai,refresh_campaign_ai,get_ai_settings,configure_local_ai,ask_local_ai,cancel_local_ai,list_ai_history,delete_ai_turn,check_ai_source,list_ai_rule_sources,probe_local_ai,read_wiki_cache,store_wiki_cache,wiki_cache_epoch,get_wiki_provider,save_wiki_provider,wiki_cache_summary,clear_wiki_cache,cancel_wikidot,wikidot_search,wikidot_entry,list_party,save_party_member,remove_party_member,list_campaigns,create_campaign,rename_campaign,list_sessions,create_session,save_document,list_pages,create_page,update_page,save_page_document,get_backlinks,recover_page,get_graph,get_relationship,save_relationship,delete_relationship,create_backup,inspect_backup,restore_backup,cancel_restore,get_character,save_character,change_character_counter,list_player_assets,save_player_asset,delete_player_asset,get_import_source,add_import_source,export_campaign,list_images,add_image,read_image,detach_image,search_campaign,rebuild_search_index,read_catalog_cache,store_catalog_cache])
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
mod wiki_load_tests {
    use super::*;
    fn entry(page: &str) -> wikidot::Entry {
        let html = r#"<div class="page-title"><span>T</span></div><div id="page-content"><p>Source: S</p><p>Text</p></div>"#;
        wikidot::parse::entry(html, page).unwrap()
    }
    #[tokio::test]
    async fn pending_result_is_not_cached_after_a_clear_and_cache_wins_offline() {
        let dir = tempfile::tempdir().unwrap();
        let db = Database(Ok(Arc::new(Mutex::new(
            backup::Store::open(dir.path()).unwrap(),
        ))));
        let state = wikidot::State::default();
        let key = "entry/feat:alert".to_string();
        // The clear happens while the network request is still pending.
        let late = async {
            state.invalidate();
            Ok(entry("feat:alert"))
        };
        let error = wikidot_load(&db, &state, key.clone(), false, late)
            .await
            .unwrap_err();
        assert_eq!(error, CACHE_CLEARED);
        assert!(db.with(|c| wikidot::read_raw(c, &key)).unwrap().is_none());
        let fresh = wikidot_load(&db, &state, key.clone(), false, async {
            Ok(entry("feat:alert"))
        })
        .await
        .unwrap();
        assert!(!fresh.cached);
        // Cached copies answer without touching the network; failed refresh falls back visibly.
        let unused = async { Err::<wikidot::Entry, String>("network must not run".into()) };
        assert!(
            wikidot_load(&db, &state, key.clone(), false, unused)
                .await
                .unwrap()
                .cached
        );
        let offline = async { Err::<wikidot::Entry, String>("Wikidot not reachable.".into()) };
        let stale = wikidot_load(&db, &state, key, true, offline).await.unwrap();
        assert!(stale.cached && stale.warning.unwrap().contains("local copy"));
    }
}
