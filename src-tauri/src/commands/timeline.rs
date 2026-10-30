use crate::{journal::AppResult, timeline, Database};

#[tauri::command]
pub async fn get_world_calendar(
    db: tauri::State<'_, Database>,
    campaign_id: String,
) -> AppResult<Option<timeline::Calendar>> {
    db.run(move |c| timeline::calendar(c, &campaign_id)).await
}
#[tauri::command]
pub async fn save_world_calendar(
    db: tauri::State<'_, Database>,
    campaign_id: String,
    calendar: timeline::Calendar,
) -> AppResult<timeline::Calendar> {
    db.run(move |c| timeline::save_calendar(c, &campaign_id, calendar))
        .await
}
#[tauri::command]
pub async fn list_timeline(
    db: tauri::State<'_, Database>,
    campaign_id: String,
) -> AppResult<Vec<timeline::Entry>> {
    db.run(move |c| timeline::list(c, &campaign_id)).await
}
#[tauri::command]
pub async fn save_timeline_entry(
    db: tauri::State<'_, Database>,
    campaign_id: String,
    id: Option<String>,
    revision: Option<i64>,
    input: timeline::EntryInput,
) -> AppResult<timeline::Entry> {
    db.run(move |c| timeline::save(c, &campaign_id, id, revision, input))
        .await
}
#[tauri::command]
pub async fn delete_timeline_entry(
    db: tauri::State<'_, Database>,
    campaign_id: String,
    id: String,
    revision: i64,
) -> AppResult<()> {
    db.run(move |c| timeline::delete(c, &campaign_id, &id, revision))
        .await
}
