use super::{Listing, Location, Outcome, Schedule, Status};
use crate::{backup, journal::AppResult, Database};
use serde::Serialize;
use std::path::PathBuf;
use tauri::Manager;

/// The user's Documents folder. Isolated debug profiles never touch the real
/// one: they use `NODEX_DEV_DOCUMENTS_DIR` or a folder inside the profile.
pub fn documents(app: &tauri::AppHandle) -> Option<PathBuf> {
    #[cfg(debug_assertions)]
    if let Some(profile) = std::env::var_os("NODEX_DEV_DATA_DIR") {
        let path = std::env::var_os("NODEX_DEV_DOCUMENTS_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from(profile).join("documenti-simulati"));
        return path.is_absolute().then_some(path);
    }
    app.path().document_dir().ok()
}
fn root(app: &tauri::AppHandle) -> AppResult<PathBuf> {
    app.state::<Database>().root()
}
async fn blocking<T: Send + 'static>(
    app: tauri::AppHandle,
    job: impl FnOnce(tauri::AppHandle) -> AppResult<T> + Send + 'static,
) -> AppResult<T> {
    crate::blocking(app, "Backup operation interrupted.", job).await
}
/// Update, AI answer or training in progress: periodic backups wait.
fn activity(app: &tauri::AppHandle) -> AppResult<Option<&'static str>> {
    Ok(crate::updates::update_announcement_blocked(app.clone())?
        .then_some("Update or AI operation in progress: the periodic backup is waiting."))
}

#[tauri::command]
pub fn get_backup_settings(app: tauri::AppHandle) -> AppResult<Status> {
    super::status(&root(&app)?, documents(&app).as_deref())
}
#[tauri::command]
pub fn save_backup_schedule(app: tauri::AppHandle, schedule: Schedule) -> AppResult<Status> {
    let root = root(&app)?;
    super::save_schedule(&root, schedule)?;
    super::status(&root, documents(&app).as_deref())
}
#[tauri::command]
pub async fn choose_backup_destination(app: tauri::AppHandle) -> AppResult<Option<Status>> {
    blocking(app, |app| {
        let Some(folder) = pick_folder(&app)? else {
            return Ok(None);
        };
        let root = root(&app)?;
        super::set_destination(&root, Some(&folder))?;
        super::status(&root, documents(&app).as_deref()).map(Some)
    })
    .await
}
#[tauri::command]
pub fn reset_backup_destination(app: tauri::AppHandle) -> AppResult<Status> {
    let root = root(&app)?;
    super::set_destination(&root, None)?;
    super::status(&root, documents(&app).as_deref())
}
fn pick_folder(app: &tauri::AppHandle) -> AppResult<Option<PathBuf>> {
    #[cfg(debug_assertions)]
    if std::env::var_os("NODEX_DEV_DATA_DIR").is_some() {
        if let Some(path) = std::env::var_os("NODEX_DEV_BACKUP_FOLDER") {
            return Ok(Some(PathBuf::from(path)));
        }
    }
    use tauri_plugin_dialog::DialogExt;
    app.dialog()
        .file()
        .set_title("Choose the periodic backup folder")
        .blocking_pick_folder()
        .map(|f| {
            f.into_path()
                .map_err(|_| "Choose a local folder or one on a mounted disk.".to_string())
        })
        .transpose()
}
#[tauri::command]
pub async fn list_backup_files(app: tauri::AppHandle) -> AppResult<Listing> {
    // Folder scans can be slow on external or network disks.
    blocking(app, |app| {
        super::list(&root(&app)?, documents(&app).as_deref())
    })
    .await
}
#[tauri::command]
pub async fn inspect_listed_backup(
    app: tauri::AppHandle,
    location: Location,
    name: String,
) -> AppResult<backup::Preview> {
    blocking(app, move |app| {
        let docs = documents(&app);
        app.state::<Database>().with_store(|store| {
            store.pending = None;
            let path = super::resolve(&store.root, docs.as_deref(), location, &name)?;
            store.prepare(&path)
        })
    })
    .await
}
#[tauri::command]
pub async fn copy_legacy_update_backup(app: tauri::AppHandle, name: String) -> AppResult<String> {
    blocking(app, move |app| {
        super::copy_legacy(&root(&app)?, documents(&app).as_deref(), &name)
    })
    .await
}
#[tauri::command]
pub fn open_backup_folder(app: tauri::AppHandle, location: Location) -> AppResult<String> {
    let folder = super::open_target(&root(&app)?, documents(&app).as_deref(), location)?;
    #[cfg(debug_assertions)]
    if std::env::var_os("NODEX_DEV_NO_OPEN").is_some() {
        return Ok(super::shown(&folder));
    }
    let program = if cfg!(windows) {
        "explorer"
    } else if cfg!(target_os = "macos") {
        "open"
    } else {
        "xdg-open"
    };
    std::process::Command::new(program)
        .arg(&folder)
        .spawn()
        .map_err(|_| "Cannot open the file manager. The path is shown in the settings.")?;
    Ok(super::shown(&folder))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Tick {
    pub ran: bool,
    pub outcome: Option<Outcome>,
    pub waiting: Option<String>,
}
/// Called by the interface only while it is idle. Never waits for the archive:
/// if a save or restore holds it, the backup waits for the next idle moment.
#[tauri::command]
pub async fn periodic_backup_tick(app: tauri::AppHandle) -> AppResult<Tick> {
    blocking(app, |app| {
        let idle = |reason: &str| Tick {
            ran: false,
            outcome: None,
            waiting: Some(reason.into()),
        };
        if let Some(reason) = activity(&app)? {
            return Ok(idle(reason));
        }
        let docs = documents(&app);
        let db = app.state::<Database>();
        let shared = db.shared()?;
        let Ok(store) = shared.try_lock() else {
            return Ok(idle("Archive busy: the periodic backup is waiting."));
        };
        if store.pending.is_some() {
            return Ok(idle("Restore waiting for confirmation."));
        }
        let preferences = super::read_preferences(&store.root)?;
        let index = super::read_index(&store.root)?;
        if !super::due(&preferences, &index, super::now()) {
            return Ok(Tick {
                ran: false,
                outcome: None,
                waiting: None,
            });
        }
        let outcome = super::run(&store, docs.as_deref(), super::now())?;
        Ok(Tick {
            ran: true,
            outcome: Some(outcome),
            waiting: None,
        })
    })
    .await
}
#[tauri::command]
pub async fn run_periodic_backup_now(app: tauri::AppHandle) -> AppResult<Outcome> {
    blocking(app, |app| {
        if let Some(reason) = activity(&app)? {
            return Err(reason.into());
        }
        let docs = documents(&app);
        app.state::<Database>().with_store(|store| {
            if store.pending.is_some() {
                return Err("Confirm or cancel the restore in progress first.".into());
            }
            super::run(store, docs.as_deref(), super::now())
        })
    })
    .await
}
