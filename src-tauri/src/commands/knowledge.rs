use crate::{graph, import_sources, journal::AppResult, knowledge, party, search, Database};

#[tauri::command]
pub async fn list_pages(
    db: tauri::State<'_, Database>,
    campaign_id: String,
) -> AppResult<Vec<knowledge::Page>> {
    db.run(move |c| knowledge::list_pages(c, &campaign_id))
        .await
}

#[tauri::command]
pub async fn create_page(
    db: tauri::State<'_, Database>,
    campaign_id: String,
    title: String,
    kind: String,
    status: String,
    aliases: Vec<String>,
) -> AppResult<knowledge::Page> {
    db.run(move |c| knowledge::create_page(c, &campaign_id, &title, &kind, &status, &aliases))
        .await
}

#[tauri::command]
pub async fn update_page(
    db: tauri::State<'_, Database>,
    campaign_id: String,
    id: String,
    input: knowledge::Metadata,
    expected: knowledge::Metadata,
) -> AppResult<knowledge::Page> {
    db.run(move |c| knowledge::update_page_checked(c, &campaign_id, &id, input, expected))
        .await
}

#[tauri::command]
pub async fn save_page_document(
    db: tauri::State<'_, Database>,
    campaign_id: String,
    id: String,
    revision: i64,
    document: serde_json::Value,
) -> AppResult<knowledge::Page> {
    db.run(move |c| knowledge::save_page_document(c, &campaign_id, &id, revision, document))
        .await
}

#[tauri::command]
pub async fn get_backlinks(
    db: tauri::State<'_, Database>,
    campaign_id: String,
    id: String,
) -> AppResult<Vec<knowledge::Backlink>> {
    db.run(move |c| knowledge::backlinks(c, &campaign_id, &id))
        .await
}

#[tauri::command]
pub async fn recover_page(
    db: tauri::State<'_, Database>,
    campaign_id: String,
    id: String,
    title: String,
) -> AppResult<knowledge::Page> {
    db.run(move |c| knowledge::recover_page(c, &campaign_id, &id, &title))
        .await
}

#[tauri::command]
pub async fn get_graph(
    db: tauri::State<'_, Database>,
    campaign_id: String,
    query: graph::GraphQuery,
) -> AppResult<graph::GraphData> {
    db.run(move |c| graph::graph(c, &campaign_id, query)).await
}

#[tauri::command]
pub async fn get_relationship(
    db: tauri::State<'_, Database>,
    campaign_id: String,
    id: String,
) -> AppResult<graph::Relationship> {
    db.run(move |c| graph::get_relationship(c, &campaign_id, &id))
        .await
}

#[tauri::command]
pub async fn save_relationship(
    db: tauri::State<'_, Database>,
    campaign_id: String,
    id: Option<String>,
    revision: Option<i64>,
    input: graph::RelationshipInput,
) -> AppResult<graph::Relationship> {
    db.run(move |c| graph::save_relationship(c, &campaign_id, id.as_deref(), revision, input))
        .await
}

#[tauri::command]
pub async fn delete_relationship(
    db: tauri::State<'_, Database>,
    campaign_id: String,
    id: String,
    revision: i64,
) -> AppResult<()> {
    db.run(move |c| graph::delete_relationship(c, &campaign_id, &id, revision))
        .await
}

#[tauri::command]
pub async fn search_campaign(
    db: tauri::State<'_, Database>,
    campaign_id: String,
    query: String,
    kind: Option<String>,
    sort: String,
) -> AppResult<Vec<search::SearchResult>> {
    db.run(move |c| search::find(c, &campaign_id, &query, kind.as_deref(), &sort))
        .await
}

#[tauri::command]
pub async fn rebuild_search_index(db: tauri::State<'_, Database>) -> AppResult<i64> {
    db.run(search::rebuild).await
}

#[tauri::command]
pub async fn get_import_source(
    db: tauri::State<'_, Database>,
    campaign_id: String,
    kind: String,
    id: String,
) -> AppResult<Option<import_sources::ImportSource>> {
    db.run(move |c| import_sources::get(c, &campaign_id, &kind, &id))
        .await
}

#[tauri::command]
pub async fn add_import_source(
    db: tauri::State<'_, Database>,
    campaign_id: String,
    kind: String,
    id: String,
    name: String,
    content: String,
) -> AppResult<import_sources::ImportSource> {
    db.run(move |c| import_sources::add(c, &campaign_id, &kind, &id, &name, &content))
        .await
}

#[tauri::command]
pub async fn list_party(
    db: tauri::State<'_, Database>,
    campaign_id: String,
) -> AppResult<Vec<party::Member>> {
    db.run(move |c| party::list(c, &campaign_id)).await
}

#[tauri::command]
pub async fn save_party_member(
    db: tauri::State<'_, Database>,
    campaign_id: String,
    input: party::MemberInput,
) -> AppResult<party::Member> {
    db.run(move |c| party::save(c, &campaign_id, &input)).await
}

#[tauri::command]
pub async fn remove_party_member(
    db: tauri::State<'_, Database>,
    campaign_id: String,
    page_id: String,
    revision: i64,
) -> AppResult<()> {
    db.run(move |c| party::remove(c, &campaign_id, &page_id, revision))
        .await
}
