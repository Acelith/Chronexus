use crate::{catalog, images, journal::AppResult, player, Database};
use tauri::Manager;

#[tauri::command]
pub async fn get_character(
    db: tauri::State<'_, Database>,
    campaign_id: String,
) -> AppResult<Option<player::Character>> {
    db.run(move |c| player::get_character(c, &campaign_id))
        .await
}

#[tauri::command]
pub async fn save_character(
    db: tauri::State<'_, Database>,
    campaign_id: String,
    id: Option<String>,
    revision: Option<i64>,
    input: player::CharacterInput,
) -> AppResult<player::Character> {
    db.run(move |c| player::save_character(c, &campaign_id, id.as_deref(), revision, input))
        .await
}

#[tauri::command]
pub async fn change_character_counter(
    db: tauri::State<'_, Database>,
    campaign_id: String,
    id: String,
    revision: i64,
    target: String,
    delta: i64,
) -> AppResult<player::Character> {
    db.run(move |c| player::change_counter(c, &campaign_id, &id, revision, &target, delta))
        .await
}

#[tauri::command]
pub async fn list_player_assets(
    db: tauri::State<'_, Database>,
    campaign_id: String,
    character_id: String,
) -> AppResult<Vec<player::Asset>> {
    db.run(move |c| player::list_assets(c, &campaign_id, &character_id))
        .await
}

#[tauri::command]
pub async fn save_player_asset(
    db: tauri::State<'_, Database>,
    campaign_id: String,
    character_id: String,
    id: Option<String>,
    revision: Option<i64>,
    input: player::AssetInput,
) -> AppResult<player::Asset> {
    db.run(move |c| {
        player::save_asset(
            c,
            &campaign_id,
            &character_id,
            id.as_deref(),
            revision,
            input,
        )
    })
    .await
}

#[tauri::command]
pub async fn delete_player_asset(
    db: tauri::State<'_, Database>,
    campaign_id: String,
    character_id: String,
    id: String,
    revision: i64,
) -> AppResult<()> {
    db.run(move |c| player::delete_asset(c, &campaign_id, &character_id, &id, revision))
        .await
}

#[tauri::command]
pub async fn read_catalog_cache(
    db: tauri::State<'_, Database>,
    path: String,
) -> AppResult<Option<catalog::CacheEntry>> {
    db.run(move |c| catalog::read(c, &path)).await
}

#[tauri::command]
pub async fn store_catalog_cache(
    db: tauri::State<'_, Database>,
    path: String,
    payload: serde_json::Value,
) -> AppResult<catalog::CacheEntry> {
    db.run(move |c| catalog::store(c, &path, payload)).await
}

#[tauri::command]
pub async fn list_images(
    db: tauri::State<'_, Database>,
    campaign_id: String,
    target: images::ImageTarget,
) -> AppResult<Vec<images::Attachment>> {
    db.run(move |c| images::list(c, &campaign_id, &target))
        .await
}

#[tauri::command]
pub async fn add_image(
    app: tauri::AppHandle,
    campaign_id: String,
    target: images::ImageTarget,
    caption: String,
    role: String,
    data_base64: String,
) -> AppResult<images::Attachment> {
    crate::blocking(app, "Image import interrupted.", move |app| {
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
}

#[tauri::command]
pub async fn read_image(
    app: tauri::AppHandle,
    campaign_id: String,
    id: String,
    thumbnail: bool,
) -> AppResult<String> {
    crate::blocking(app, "Image reading interrupted.", move |app| {
        app.state::<Database>()
            .with_store(|s| images::read(&s.connection, &s.directory, &campaign_id, &id, thumbnail))
    })
    .await
}

#[tauri::command]
pub async fn detach_image(
    db: tauri::State<'_, Database>,
    campaign_id: String,
    id: String,
) -> AppResult<()> {
    db.run(move |c| images::detach(c, &campaign_id, &id)).await
}
