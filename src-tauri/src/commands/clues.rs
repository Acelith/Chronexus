use crate::{clues, journal::AppResult, Database};

#[tauri::command]
pub async fn list_clues(
    db: tauri::State<'_, Database>,
    campaign_id: String,
) -> AppResult<Vec<clues::Clue>> {
    db.run(move |c| clues::list(c, &campaign_id)).await
}

#[tauri::command]
pub async fn save_clue(
    db: tauri::State<'_, Database>,
    campaign_id: String,
    id: Option<String>,
    revision: Option<i64>,
    input: clues::Input,
) -> AppResult<clues::Clue> {
    db.run(move |c| clues::save(c, &campaign_id, id.as_deref(), revision, input))
        .await
}

#[tauri::command]
pub async fn delete_clue(
    db: tauri::State<'_, Database>,
    campaign_id: String,
    id: String,
    revision: i64,
) -> AppResult<()> {
    db.run(move |c| clues::delete(c, &campaign_id, &id, revision))
        .await
}
