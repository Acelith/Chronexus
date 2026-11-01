//! Only an explicitly opened table may start a live connection. No table state is persisted.
use crate::{
    journal::AppResult,
    sync::{
        self,
        api::tables::{validate_operation, TableError},
    },
    Database,
};
use serde_json::{json, Value};
use tokio_util::sync::CancellationToken;
struct Subscription {
    id: String,
    table_id: String,
    cancel: CancellationToken,
    sender: tokio::sync::mpsc::Sender<Value>,
    account: sync::Account,
}
#[derive(Default)]
pub struct Live(std::sync::Mutex<Option<Subscription>>);
pub struct Images(tokio::sync::Semaphore);
impl Default for Images {
    fn default() -> Self {
        Self(tokio::sync::Semaphore::new(2))
    }
}
#[tauri::command]
pub async fn table_operation(
    db: tauri::State<'_, Database>,
    table_id: String,
    operation: Value,
) -> Result<Value, TableError> {
    validate_operation(&operation)?;
    let (_, _, client) = super::sync::signed_in(&db)?;
    client.table_operation(&table_id, operation).await
}
#[tauri::command]
pub async fn table_image(
    db: tauri::State<'_, Database>,
    gate: tauri::State<'_, Images>,
    live: tauri::State<'_, Live>,
    table_id: String,
    asset_id: String,
    map: bool,
) -> Result<String, TableError> {
    let (cancel, identity) = {
        let slot = live.0.lock().map_err(|_| TableError { status: 503 })?;
        let slot = slot
            .as_ref()
            .filter(|s| s.table_id == table_id)
            .ok_or(TableError { status: 403 })?;
        (slot.cancel.clone(), slot.account.clone())
    };
    let _permit = tokio::select! {_=cancel.cancelled()=>return Err(TableError{status:403}),p=gate.0.acquire()=>p.map_err(|_|TableError{status:503})?};
    let (current, _, client) = super::sync::signed_in(&db)?;
    if current != identity || cancel.is_cancelled() {
        return Err(TableError { status: 403 });
    }
    client.table_image(&table_id, &asset_id, map).await
}
#[tauri::command]
pub async fn table_seats(
    db: tauri::State<'_, Database>,
    table_id: String,
) -> Result<Value, TableError> {
    let (_, _, client) = super::sync::signed_in(&db)?;
    client
        .table_call(reqwest::Method::GET, &table_id, "/seats", None)
        .await
}
#[tauri::command]
pub async fn table_leave(
    db: tauri::State<'_, Database>,
    table_id: String,
) -> Result<(), TableError> {
    let (_, session, client) = super::sync::signed_in(&db)?;
    client
        .table_call(
            reqwest::Method::DELETE,
            &table_id,
            &format!("/seats/{}", session.account_id),
            None,
        )
        .await?;
    Ok(())
}
#[tauri::command]
pub async fn table_live_start(
    db: tauri::State<'_, Database>,
    live: tauri::State<'_, Live>,
    table_id: String,
    on_event: tauri::ipc::Channel<Value>,
) -> AppResult<String> {
    sync::remote_id(&table_id)?;
    let (account, _, _) = super::sync::signed_in(&db)?;
    let root = db.root()?;
    let id = uuid::Uuid::new_v4().to_string();
    let cancel = CancellationToken::new();
    let (sender, mut outgoing) = tokio::sync::mpsc::channel(16);
    {
        let mut slot = live.0.lock().map_err(|_| "Table connection unavailable.")?;
        if let Some(old) = slot.take() {
            old.cancel.cancel();
        }
        *slot = Some(Subscription {
            id: id.clone(),
            table_id: table_id.clone(),
            cancel: cancel.clone(),
            sender,
            account: account.clone(),
        });
    }
    tauri::async_runtime::spawn(async move {
        let mut delay = 1;
        loop {
            if cancel.is_cancelled() {
                break;
            }
            let current = sync::read_account(&root).ok();
            if current.as_ref() != Some(&account) {
                let _ = on_event.send(json!({"type":"accessLost"}));
                break;
            }
            let Some(session) = account.session.as_ref() else {
                break;
            };
            let Ok(base) = sync::server_url(account.server.as_deref().unwrap_or(""), false) else {
                break;
            };
            let Ok(client) = sync::api::Client::new(base, Some(session.token.clone()), false)
            else {
                break;
            };
            let sent = on_event.clone();
            let bound = cancel.clone();
            let watched = cancel.clone();
            let root_check = root.clone();
            let identity = account.clone();
            let mut checked_at = std::time::Instant::now();
            let stream = client.table_stream(
                &table_id,
                move |value| {
                    if watched.is_cancelled() {
                        return false;
                    }
                    // At most once a second: the account file is a blocking disk read.
                    if checked_at.elapsed() >= std::time::Duration::from_secs(1) {
                        checked_at = std::time::Instant::now();
                        if sync::read_account(&root_check).ok().as_ref() != Some(&identity) {
                            let _ = sent.send(json!({"type":"accessLost"}));
                            return false;
                        }
                    }
                    sent.send(value).is_ok()
                },
                bound,
                &mut outgoing,
            );
            let opened = std::time::Instant::now();
            let result = tokio::select! {_ = cancel.cancelled()=>break,result=stream=>result};
            // A connection that held for a minute was healthy: the next drop retries fast.
            if opened.elapsed() >= std::time::Duration::from_secs(60) {
                delay = 1;
            }
            if matches!(
                result,
                Err(sync::api::Failure::Unauthorized(_) | sync::api::Failure::AccessLost(_))
            ) {
                let _ = on_event.send(json!({"type":"accessLost"}));
                break;
            }
            if on_event.send(json!({"type":"disconnected"})).is_err() {
                break;
            }
            tokio::select! {_=cancel.cancelled()=>break,_=tokio::time::sleep(std::time::Duration::from_secs(delay))=>{}}
            delay = (delay * 2).min(30);
        }
    });
    Ok(id)
}
#[tauri::command]
pub fn table_live_stop(live: tauri::State<'_, Live>, subscription: String) -> AppResult<()> {
    let mut slot = live.0.lock().map_err(|_| "Table connection unavailable.")?;
    if slot.as_ref().is_some_and(|s| s.id == subscription) {
        if let Some(old) = slot.take() {
            old.cancel.cancel();
        }
    }
    Ok(())
}
#[tauri::command]
pub fn table_live_message(
    db: tauri::State<'_, Database>,
    live: tauri::State<'_, Live>,
    subscription: String,
    operation_id: String,
    base_revision: i64,
    text: String,
) -> Result<(), TableError> {
    if text.trim().is_empty()
        || text.chars().count() > 2000
        || base_revision < 1
        || uuid::Uuid::parse_str(&operation_id).map_or(true, |u| u.get_version_num() != 7)
    {
        return Err(TableError { status: 400 });
    }
    let current = sync::read_account(&db.root()?)?;
    let slot = live.0.lock().map_err(|_| TableError { status: 503 })?;
    let slot = slot
        .as_ref()
        .filter(|s| s.id == subscription && s.account == current)
        .ok_or(TableError { status: 401 })?;
    slot.sender.try_send(json!({"operationId":operation_id,"baseRevision":base_revision,"audience":"public","text":text})).map_err(|_|TableError{status:503})
}
/// Transient map ping on the active scene. The server validates the scene, bounds and rate.
#[tauri::command]
pub fn table_live_ping(
    db: tauri::State<'_, Database>,
    live: tauri::State<'_, Live>,
    subscription: String,
    scene_id: String,
    x: f64,
    y: f64,
) -> Result<(), TableError> {
    if sync::remote_id(&scene_id).is_err()
        || !x.is_finite()
        || !y.is_finite()
        || !(0.0..=100_000.0).contains(&x)
        || !(0.0..=100_000.0).contains(&y)
    {
        return Err(TableError { status: 400 });
    }
    let current = sync::read_account(&db.root()?)?;
    let slot = live.0.lock().map_err(|_| TableError { status: 503 })?;
    let slot = slot
        .as_ref()
        .filter(|s| s.id == subscription && s.account == current)
        .ok_or(TableError { status: 401 })?;
    slot.sender
        .try_send(json!({"type":"ping","sceneId":scene_id,"x":x,"y":y}))
        .map_err(|_| TableError { status: 503 })
}
#[tauri::command]
pub async fn table_links(
    db: tauri::State<'_, Database>,
    campaign_id: String,
) -> AppResult<Vec<crate::tables::Link>> {
    db.run(move |c| crate::tables::links(c, &campaign_id)).await
}
#[tauri::command]
pub async fn table_link(
    db: tauri::State<'_, Database>,
    campaign_id: String,
    table_id: String,
    enabled: bool,
) -> Result<(), TableError> {
    let (account, session, client) = super::sync::signed_in(&db)?;
    if enabled {
        client
            .table_call(reqwest::Method::GET, &table_id, "", None)
            .await?;
    }
    let server = account.server.unwrap_or_default();
    db.run(move |c| {
        crate::tables::set_link(
            c,
            &campaign_id,
            &server,
            &session.account_id,
            &table_id,
            enabled,
        )
    })
    .await
    .map_err(|_| TableError { status: 400 })
}
#[tauri::command]
pub async fn table_grant(
    db: tauri::State<'_, Database>,
    campaign_id: String,
    table_id: String,
    kind: String,
    item_id: String,
    enabled: bool,
) -> Result<(), TableError> {
    sync::kind(&kind).map_err(|_| TableError { status: 400 })?;
    sync::remote_id(&item_id).map_err(|_| TableError { status: 400 })?;
    let (account, session, client) = super::sync::signed_in(&db)?;
    let link = super::sync::linked(
        &db,
        &campaign_id,
        &session,
        account.server.as_deref().unwrap_or(""),
    )
    .await
    .map_err(|_| TableError { status: 400 })?;
    let c = campaign_id.clone();
    let k = kind.clone();
    let id = item_id.clone();
    if enabled {
        let allowed = db
            .run(move |conn| {
                Ok(sync::engine::items(conn, &c)?.iter().any(|v| {
                    v.kind == k && v.item_id == id && v.scope == "shared" && v.status == "synced"
                }))
            })
            .await
            .map_err(|_| TableError { status: 400 })?;
        if !allowed {
            return Err(TableError { status: 400 });
        }
    }
    client
        .table_call(
            if enabled {
                reqwest::Method::POST
            } else {
                reqwest::Method::DELETE
            },
            &table_id,
            "/journal-grants",
            Some(json!({"campaignId":link.remote_id,"kind":kind,"itemId":item_id})),
        )
        .await?;
    Ok(())
}
#[tauri::command]
pub async fn table_character_preview(
    db: tauri::State<'_, Database>,
    campaign_id: String,
) -> AppResult<Value> {
    db.run(move|c|{let character=crate::player::get_character(c,&campaign_id)?.ok_or("Character not found in this campaign.")?;
        let pictures=crate::images::list(c,&campaign_id,&crate::images::ImageTarget{kind:"character".into(),id:character.id.clone()})?;
        Ok(json!({"id":character.id,"revision":character.revision,"name":character.data.name,"hp":character.data.hp_current,"maxHp":character.data.hp_maximum,"portraits":pictures.iter().map(|p|json!({"id":p.id,"caption":p.caption})).collect::<Vec<_>>()}))
    }).await
}
#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProjectionChoice {
    pub character_id: String,
    pub character_revision: i64,
    pub name: bool,
    pub vitals: bool,
    pub ac: Option<i32>,
    pub speed: Option<ProjectionDistance>,
    pub portrait: Option<String>,
}
#[derive(serde::Deserialize, serde::Serialize)]
#[serde(deny_unknown_fields)]
pub struct ProjectionDistance {
    value: f64,
    unit: String,
}
#[tauri::command]
pub async fn table_project_character(
    db: tauri::State<'_, Database>,
    campaign_id: String,
    table_id: String,
    token_id: String,
    base_revision: i64,
    choice: ProjectionChoice,
) -> Result<Value, TableError> {
    let (_, session, client) = super::sync::signed_in(&db)?;
    let board = crate::sync::api::tables::validate_board(
        client
            .table_board(&table_id)
            .await
            .map_err(TableError::from)?,
    )?;
    if board["revision"].as_i64() != Some(base_revision) {
        return Err(TableError { status: 409 });
    }
    if !board["tokens"].as_array().is_some_and(|tokens| {
        tokens.iter().any(|t| {
            t["id"].as_str() == Some(&token_id)
                && t["ownerId"].as_str() == Some(&session.account_id)
                && t["sceneId"] == board["activeScene"]
        })
    }) {
        return Err(TableError { status: 403 });
    }
    let root = db.root()?;
    let portrait = choice.portrait.clone();
    let expected_id = choice.character_id.clone();
    let expected_revision = choice.character_revision;
    let (character, picture) = db
        .run(move |c| {
            if crate::demo::is_demo(c, &campaign_id)? {
                return Err("Demo data cannot be shared.".into());
            }
            let character = crate::player::get_character(c, &campaign_id)?
                .ok_or("Character not found in this campaign.")?;
            if character.id != expected_id || character.revision != expected_revision {
                return Err("Character revision changed.".into());
            }
            let image = if let Some(id) = portrait {
                let images = crate::images::list(
                    c,
                    &campaign_id,
                    &crate::images::ImageTarget {
                        kind: "character".into(),
                        id: character.id.clone(),
                    },
                )?;
                let found = images
                    .iter()
                    .find(|p| p.id == id)
                    .ok_or("Image not found.")?;
                Some(crate::images::bytes(&root, found)?)
            } else {
                None
            };
            Ok((character, image))
        })
        .await
        .map_err(|_| TableError { status: 409 })?;
    let portrait_id = if let Some(bytes) = picture {
        let format = image::guess_format(&bytes).map_err(|_| TableError { status: 400 })?;
        let mime = match format {
            image::ImageFormat::Png => "image/png",
            image::ImageFormat::Jpeg => "image/jpeg",
            image::ImageFormat::WebP => "image/webp",
            _ => return Err(TableError { status: 400 }),
        };
        Some(client.upload_table_portrait(&table_id, bytes, mime).await?)
    } else {
        None
    };
    let c = character.data;
    let op = json!({"operationId":uuid::Uuid::now_v7().to_string(),"baseRevision":base_revision,"command":{"type":"projectToken","projection":{"tokenId":token_id,"characterId":character.id,"name":if choice.name{Some(c.name)}else{None},"speed":choice.speed,"portraitId":portrait_id,"vitals":if choice.vitals{Some(json!({"hp":c.hp_current,"maxHp":c.hp_maximum,"ac":choice.ac,"showHp":false}))}else{None}}}});
    client.table_operation(&table_id, op).await
}
