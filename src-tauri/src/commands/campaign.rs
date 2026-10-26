use crate::{
    dice,
    journal::{self, AppResult, Campaign, Session},
    Database,
};

#[tauri::command]
pub async fn roll_dice(
    db: tauri::State<'_, Database>,
    campaign_id: String,
    request_id: String,
    selections: Vec<dice::Selection>,
) -> AppResult<dice::Roll> {
    db.run(move |c| dice::roll(c, &campaign_id, &request_id, &selections))
        .await
}

#[tauri::command]
pub async fn list_dice_rolls(
    db: tauri::State<'_, Database>,
    campaign_id: String,
    before: Option<dice::Cursor>,
) -> AppResult<dice::History> {
    db.run(move |c| dice::history(c, &campaign_id, before.as_ref()))
        .await
}

#[tauri::command]
pub async fn list_campaigns(db: tauri::State<'_, Database>) -> AppResult<Vec<Campaign>> {
    db.run(journal::list_campaigns).await
}

#[tauri::command]
pub async fn create_campaign(db: tauri::State<'_, Database>, name: String) -> AppResult<Campaign> {
    db.run(move |c| journal::create_campaign(c, &name)).await
}

#[tauri::command]
pub async fn rename_campaign(
    db: tauri::State<'_, Database>,
    id: String,
    name: String,
) -> AppResult<Campaign> {
    db.run(move |c| journal::rename_campaign(c, &id, &name))
        .await
}

#[tauri::command]
pub async fn list_sessions(
    db: tauri::State<'_, Database>,
    campaign_id: String,
) -> AppResult<Vec<Session>> {
    db.run(move |c| journal::list_sessions(c, &campaign_id))
        .await
}

#[tauri::command]
pub async fn create_session(
    db: tauri::State<'_, Database>,
    campaign_id: String,
    sequence: i64,
    title: String,
    played_on: Option<String>,
) -> AppResult<Session> {
    db.run(move |c| journal::create_session(c, &campaign_id, sequence, &title, played_on))
        .await
}

#[tauri::command]
pub async fn save_document(
    db: tauri::State<'_, Database>,
    campaign_id: String,
    id: String,
    revision: i64,
    document: serde_json::Value,
) -> AppResult<Session> {
    db.run(move |c| journal::save_document(c, &campaign_id, &id, revision, document))
        .await
}
