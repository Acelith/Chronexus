use crate::{journal::AppResult, maps, Database};

#[tauri::command]
pub async fn list_map_images(
    db: tauri::State<'_, Database>,
    campaign_id: String,
) -> AppResult<Vec<maps::MapImage>> {
    db.run(move |c| maps::images(c, &campaign_id)).await
}
#[tauri::command]
pub async fn list_map_pins(
    db: tauri::State<'_, Database>,
    campaign_id: String,
    image_id: String,
) -> AppResult<Vec<maps::Pin>> {
    db.run(move |c| maps::pins(c, &campaign_id, &image_id))
        .await
}
#[tauri::command]
pub async fn save_map_pin(
    db: tauri::State<'_, Database>,
    campaign_id: String,
    image_id: String,
    id: Option<String>,
    revision: Option<i64>,
    input: maps::PinInput,
) -> AppResult<maps::Pin> {
    db.run(move |c| maps::save_pin(c, &campaign_id, &image_id, id, revision, input))
        .await
}
#[tauri::command]
pub async fn delete_map_pin(
    db: tauri::State<'_, Database>,
    campaign_id: String,
    image_id: String,
    id: String,
    revision: i64,
) -> AppResult<()> {
    db.run(move |c| maps::delete_pin(c, &campaign_id, &image_id, &id, revision))
        .await
}
#[tauri::command]
pub async fn list_map_routes(
    db: tauri::State<'_, Database>,
    campaign_id: String,
    image_id: String,
) -> AppResult<Vec<maps::Route>> {
    db.run(move |c| maps::routes(c, &campaign_id, &image_id))
        .await
}
#[tauri::command]
pub async fn add_map_route(
    db: tauri::State<'_, Database>,
    campaign_id: String,
    image_id: String,
    from_pin_id: String,
    to_pin_id: String,
    label: String,
) -> AppResult<maps::Route> {
    db.run(move |c| maps::add_route(c, &campaign_id, &image_id, &from_pin_id, &to_pin_id, &label))
        .await
}
#[tauri::command]
pub async fn delete_map_route(
    db: tauri::State<'_, Database>,
    campaign_id: String,
    image_id: String,
    id: String,
    revision: i64,
) -> AppResult<()> {
    db.run(move |c| maps::delete_route(c, &campaign_id, &image_id, &id, revision))
        .await
}
#[tauri::command]
pub async fn relink_map_image(
    db: tauri::State<'_, Database>,
    campaign_id: String,
    old_image_id: String,
    new_image_id: String,
) -> AppResult<()> {
    db.run(move |c| maps::relink(c, &campaign_id, &old_image_id, &new_image_id))
        .await
}
