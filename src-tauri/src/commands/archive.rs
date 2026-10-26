use crate::{backup, export, journal::AppResult, Database};
use tauri::Manager;

// Native choosers and archive work run outside the UI thread. Paths are never
// supplied by React: only the native chooser may select an external location.
pub fn choose_backup_file(
    app: &tauri::AppHandle,
    save: bool,
) -> AppResult<Option<std::path::PathBuf>> {
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
pub async fn create_backup(app: tauri::AppHandle) -> AppResult<Option<backup::BackupReceipt>> {
    crate::blocking(
        app,
        "Operation interrupted. Try the backup again.",
        move |app| {
            let Some(path) = choose_backup_file(&app, true)? else {
                return Ok(None);
            };
            app.state::<Database>().with_store(|store| {
                backup::write_backup(&store.connection, &store.directory, &path).map(Some)
            })
        },
    )
    .await
}

#[tauri::command]
pub async fn inspect_backup(app: tauri::AppHandle) -> AppResult<Option<backup::Preview>> {
    crate::blocking(
        app,
        "Verification interrupted. Select the backup again.",
        move |app| {
            app.state::<Database>().with_store(|store| {
                store.pending = None;
                Ok(())
            })?;
            let Some(path) = choose_backup_file(&app, false)? else {
                return Ok(None);
            };
            app.state::<Database>()
                .with_store(|store| store.prepare(&path).map(Some))
        },
    )
    .await
}

#[tauri::command]
pub async fn restore_backup(
    app: tauri::AppHandle,
    token: String,
) -> AppResult<backup::RestoreReceipt> {
    let handle = app.clone();
    let receipt = crate::blocking(
        app,
        "Restore interrupted. Restart Chronexus and check the active archive before trying again.",
        move |app| {
            app.state::<Database>()
                .with_store(|store| store.restore(&token))
        },
    )
    .await?;
    // The restored archive may link other campaigns, or none: match the running loops to it.
    handle.state::<crate::sync::auto::Auto>().reload().await;
    Ok(receipt)
}

#[tauri::command]
pub async fn cancel_restore(db: tauri::State<'_, Database>) -> AppResult<()> {
    db.run_store(move |store| {
        store.pending = None;
        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn export_campaign(
    app: tauri::AppHandle,
    campaign_id: String,
) -> AppResult<Option<export::ExportReceipt>> {
    crate::blocking(
        app,
        "Export interrupted. Try again with a new file.",
        move |app| {
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
        },
    )
    .await
}
