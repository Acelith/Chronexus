use crate::{journal::AppResult, preferences, Database};

#[tauri::command]
pub async fn get_interface_preferences(
    db: tauri::State<'_, Database>,
) -> AppResult<preferences::Preferences> {
    // Small files in the data root: no need to wait for the archive lock.
    preferences::read(&db.root()?)
}

#[tauri::command]
pub async fn save_interface_preferences(
    db: tauri::State<'_, Database>,
    preferences: preferences::Preferences,
) -> AppResult<preferences::Preferences> {
    preferences::save(&db.root()?, preferences)
}
