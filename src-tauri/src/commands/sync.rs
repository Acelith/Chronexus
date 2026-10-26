//! M24 sharing commands. Network requests start only from these explicit
//! actions; the session token never reaches the interface.
use crate::{
    journal::{self, AppResult},
    sync::{self, api, auto::Auto, engine, Account, AccountView, Session},
    Database,
};

const BUSY: &str = "A sharing operation is already running.";

fn account(db: &Database) -> AppResult<Account> {
    sync::read_account(&db.root()?)
}
pub(crate) fn signed_in(db: &Database) -> AppResult<(Account, Session, api::Client)> {
    let account = account(db)?;
    let server = account
        .server
        .clone()
        .ok_or("Choose a sharing server first.")?;
    let session = account
        .session
        .clone()
        .ok_or("Sign in to the sharing server first.")?;
    let client = api::Client::new(
        sync::server_url(&server, false)?,
        Some(session.token.clone()),
        false,
    )?;
    Ok((account, session, client))
}
fn check_user(text: &str, what: &str, max: usize) -> AppResult<()> {
    if text.trim().is_empty() || text.chars().count() > max || text.contains('\0') {
        return Err(format!("Enter a valid {what}."));
    }
    Ok(())
}
/// The link must belong to the signed-in account on the configured server.
async fn linked(
    db: &Database,
    campaign: &str,
    session: &Session,
    server: &str,
) -> AppResult<engine::Link> {
    let id = campaign.to_string();
    let link = db
        .run(move |c| engine::link(c, &id))
        .await?
        .ok_or("This campaign is not linked to a sharing server.")?;
    if link.account_id != session.account_id || link.server != server {
        return Err("This campaign is linked with another account or server. Sign in with that account, or unlink it.".into());
    }
    Ok(link)
}

#[tauri::command]
pub async fn sync_account(db: tauri::State<'_, Database>) -> AppResult<AccountView> {
    Ok(AccountView::from(&account(&db)?))
}
#[tauri::command]
pub async fn sync_set_server(
    db: tauri::State<'_, Database>,
    gate: tauri::State<'_, sync::Gate>,
    server: String,
) -> AppResult<AccountView> {
    let _busy = gate.0.try_lock().map_err(|_| BUSY)?;
    let url = sync::server_url(&server, false)?;
    // Explicit check that this is a compatible Chronexus server.
    let meta = api::Client::new(url.clone(), None, false)?.meta().await?;
    if !meta.supports_replication() {
        return Err("This sharing server is older than this version of Chronexus needs: ask its operator to update it.".into());
    }
    let mut current = account(&db)?;
    let origin = url.origin().ascii_serialization();
    if current.server.as_deref() != Some(origin.as_str()) {
        current.session = None;
    }
    current.version = 1;
    current.server = Some(origin);
    sync::write_account(&db.root()?, &current)?;
    Ok(AccountView::from(&current))
}
async fn store_session(
    db: &Database,
    mut current: Account,
    signed: api::SignedIn,
    device: String,
) -> AppResult<AccountView> {
    current.session = Some(Session {
        account_id: signed.account_id,
        username: signed.username,
        display_name: signed.display_name,
        token: signed.token,
        device,
    });
    sync::write_account(&db.root()?, &current)?;
    Ok(AccountView::from(&current))
}
#[tauri::command]
pub async fn sync_sign_in(
    db: tauri::State<'_, Database>,
    gate: tauri::State<'_, sync::Gate>,
    auto: tauri::State<'_, Auto>,
    username: String,
    password: String,
    device: String,
) -> AppResult<AccountView> {
    let _busy = gate.0.try_lock().map_err(|_| BUSY)?;
    check_user(&username, "user name", 64)?;
    check_user(&device, "device name", 64)?;
    if password.is_empty() || password.len() > 1024 {
        return Err("Enter your password.".into());
    }
    let current = account(&db)?;
    let server = current
        .server
        .clone()
        .ok_or("Choose a sharing server first.")?;
    let client = api::Client::new(sync::server_url(&server, false)?, None, false)?;
    let signed = client
        .login(username.trim(), &password, device.trim())
        .await?;
    let view = store_session(&db, current, signed, device.trim().into()).await?;
    auto.reload().await;
    Ok(view)
}
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn sync_redeem_invite(
    db: tauri::State<'_, Database>,
    gate: tauri::State<'_, sync::Gate>,
    auto: tauri::State<'_, Auto>,
    code: String,
    username: String,
    display_name: String,
    password: String,
    device: String,
) -> AppResult<AccountView> {
    let _busy = gate.0.try_lock().map_err(|_| BUSY)?;
    check_user(&code, "invitation code", 128)?;
    check_user(&username, "user name", 64)?;
    check_user(&display_name, "display name", 100)?;
    check_user(&device, "device name", 64)?;
    if password.chars().count() < 12 || password.len() > 1024 {
        return Err("Choose a password of at least 12 characters.".into());
    }
    let current = account(&db)?;
    let server = current
        .server
        .clone()
        .ok_or("Choose a sharing server first.")?;
    let client = api::Client::new(sync::server_url(&server, false)?, None, false)?;
    let signed = client
        .redeem(
            code.trim(),
            username.trim(),
            display_name.trim(),
            &password,
            device.trim(),
        )
        .await?;
    let view = store_session(&db, current, signed, device.trim().into()).await?;
    auto.reload().await;
    Ok(view)
}
#[tauri::command]
pub async fn sync_sign_out(
    db: tauri::State<'_, Database>,
    gate: tauri::State<'_, sync::Gate>,
    auto: tauri::State<'_, Auto>,
) -> AppResult<AccountView> {
    let _busy = gate.0.try_lock().map_err(|_| BUSY)?;
    // Stop continuous synchronization first: its session is about to disappear.
    auto.stop_all();
    let mut current = account(&db)?;
    if let (Some(server), Some(session)) = (&current.server, &current.session) {
        // Best effort: the local session is forgotten even when offline.
        if let Ok(client) = api::Client::new(
            sync::server_url(server, false)?,
            Some(session.token.clone()),
            false,
        ) {
            let _ = client.logout().await;
        }
    }
    current.session = None;
    sync::write_account(&db.root()?, &current)?;
    auto.reload().await;
    Ok(AccountView::from(&current))
}
#[tauri::command]
pub async fn sync_link(
    db: tauri::State<'_, Database>,
    campaign_id: String,
) -> AppResult<Option<engine::Link>> {
    db.run(move |c| engine::link(c, &campaign_id)).await
}
#[tauri::command]
pub async fn sync_connect_campaign(
    db: tauri::State<'_, Database>,
    gate: tauri::State<'_, sync::Gate>,
    campaign_id: String,
    invite_code: Option<String>,
) -> AppResult<engine::Link> {
    let _busy = gate.0.try_lock().map_err(|_| BUSY)?;
    let (current, session, client) = signed_in(&db)?;
    let id = campaign_id.clone();
    let name = db
        .run(move |c| {
            if engine::link(c, &id)?.is_some() {
                return Err("This campaign is already linked. Unlink it first.".into());
            }
            journal::list_campaigns(c)?
                .into_iter()
                .find(|x| x.id == id)
                .map(|x| x.name)
                .ok_or_else(|| "Campaign not found. Reload the archive.".to_string())
        })
        .await?;
    let remote = match invite_code.as_deref().map(str::trim) {
        Some(code) if !code.is_empty() => client.join(code).await?,
        _ => client.create_campaign(&name).await?,
    };
    let link = engine::Link {
        campaign_id,
        server: current.server.unwrap_or_default(),
        remote_id: remote.id,
        account_id: session.account_id,
        role: remote.role,
        cursor: String::new(),
        synced_at: None,
        auto: false,
        paused: false,
        last_error: None,
        access_lost: false,
    };
    let saved = link.clone();
    db.run(move |c| engine::save_link(c, &saved)).await?;
    Ok(link)
}
#[tauri::command]
pub async fn sync_unlink(
    db: tauri::State<'_, Database>,
    auto: tauri::State<'_, Auto>,
    campaign_id: String,
) -> AppResult<()> {
    db.run(move |c| engine::unlink(c, &campaign_id)).await?;
    auto.reload().await;
    Ok(())
}
#[tauri::command]
pub async fn sync_invite(
    db: tauri::State<'_, Database>,
    gate: tauri::State<'_, sync::Gate>,
    campaign_id: String,
    role: String,
) -> AppResult<api::Invite> {
    let _busy = gate.0.try_lock().map_err(|_| BUSY)?;
    if !["player", "reader"].contains(&role.as_str()) {
        return Err("Invite as player or reader.".into());
    }
    let (current, session, client) = signed_in(&db)?;
    let link = linked(
        &db,
        &campaign_id,
        &session,
        current.server.as_deref().unwrap_or(""),
    )
    .await?;
    if link.role != "owner" {
        return Err("Only the owner of the shared campaign can invite.".into());
    }
    client
        .invite(&link.remote_id, &role)
        .await
        .map_err(String::from)
}
#[tauri::command]
pub async fn sync_items(
    db: tauri::State<'_, Database>,
    campaign_id: String,
) -> AppResult<Vec<engine::Item>> {
    db.run(move |c| engine::items(c, &campaign_id)).await
}
#[tauri::command]
pub async fn sync_set_scope(
    db: tauri::State<'_, Database>,
    auto: tauri::State<'_, Auto>,
    campaign_id: String,
    kind: String,
    item_id: String,
    scope: String,
) -> AppResult<Vec<engine::Item>> {
    let items = db
        .run(move |c| {
            engine::set_scope(c, &campaign_id, &kind, &item_id, &scope)?;
            engine::items(c, &campaign_id)
        })
        .await?;
    auto.touch();
    Ok(items)
}
/// Replicates every item privately (nothing becomes visible to the members).
#[tauri::command]
pub async fn sync_replicate_all(
    db: tauri::State<'_, Database>,
    auto: tauri::State<'_, Auto>,
    campaign_id: String,
) -> AppResult<Vec<engine::Item>> {
    let items = db
        .run(move |c| {
            engine::replicate_all_privately(c, &campaign_id)?;
            engine::items(c, &campaign_id)
        })
        .await?;
    auto.touch();
    Ok(items)
}
/// Explicit activation, pause and resumption of continuous synchronization.
#[tauri::command]
pub async fn sync_set_auto(
    db: tauri::State<'_, Database>,
    auto: tauri::State<'_, Auto>,
    campaign_id: String,
    enabled: bool,
    paused: bool,
) -> AppResult<engine::Link> {
    let id = campaign_id.clone();
    let link = db
        .run(move |c| engine::set_auto(c, &id, enabled, paused))
        .await?;
    auto.reload().await;
    Ok(link)
}
#[tauri::command]
pub async fn sync_status(
    auto: tauri::State<'_, Auto>,
    campaign_id: String,
) -> AppResult<sync::auto::Status> {
    auto.status(&campaign_id).await
}
#[tauri::command]
pub async fn sync_now(
    db: tauri::State<'_, Database>,
    auto: tauri::State<'_, Auto>,
    campaign_id: String,
) -> AppResult<engine::Report> {
    let (current, session, _) = signed_in(&db)?;
    linked(
        &db,
        &campaign_id,
        &session,
        current.server.as_deref().unwrap_or(""),
    )
    .await?;
    let report = auto.sync_once(&campaign_id).await.map_err(String::from)?;
    // The visible state may have changed (conflicts, pending items).
    auto.reload().await;
    Ok(report)
}
/// Campaigns of the signed-in account that this device has no local copy of yet.
#[tauri::command]
pub async fn sync_remote_campaigns(
    db: tauri::State<'_, Database>,
) -> AppResult<Vec<api::RemoteCampaign>> {
    let (current, _, client) = signed_in(&db)?;
    let server = current.server.unwrap_or_default();
    let all = client.campaigns().await?;
    db.run(move |c| {
        let mut taken = std::collections::HashSet::new();
        for link in engine::all_links(c)? {
            if link.server == server {
                taken.insert(link.remote_id);
            }
        }
        Ok(all.into_iter().filter(|r| !taken.contains(&r.id)).collect())
    })
    .await
}
/// Creates a local copy of a campaign that lives on the server, for example on a second
/// computer of the same account, and downloads it.
#[tauri::command]
pub async fn sync_attach_campaign(
    db: tauri::State<'_, Database>,
    auto: tauri::State<'_, Auto>,
    remote_id: String,
) -> AppResult<journal::Campaign> {
    let (current, session, client) = signed_in(&db)?;
    let server = current.server.clone().unwrap_or_default();
    let remote = client
        .campaigns()
        .await?
        .into_iter()
        .find(|r| r.id == remote_id)
        .ok_or("This campaign is not available to your account on the sharing server.")?;
    let campaign = db
        .run(move |c| engine::attach_campaign(c, &server, &session.account_id, &remote))
        .await?;
    // First download; a failure leaves the linked, still empty campaign to retry from.
    auto.sync_once(&campaign.id).await.map_err(String::from)?;
    Ok(campaign)
}
#[tauri::command]
pub async fn sync_conflicts(
    db: tauri::State<'_, Database>,
    campaign_id: String,
) -> AppResult<Vec<engine::Conflict>> {
    db.run(move |c| engine::conflicts(c, &campaign_id)).await
}
#[tauri::command]
pub async fn sync_resolve(
    db: tauri::State<'_, Database>,
    campaign_id: String,
    kind: String,
    item_id: String,
    keep: String,
) -> AppResult<Vec<engine::Conflict>> {
    db.run(move |c| {
        engine::resolve(c, &campaign_id, &kind, &item_id, &keep)?;
        engine::conflicts(c, &campaign_id)
    })
    .await
}
#[tauri::command]
pub async fn sync_remote_items(
    db: tauri::State<'_, Database>,
    campaign_id: String,
) -> AppResult<Vec<engine::RemoteItem>> {
    db.run(move |c| engine::remote_items(c, &campaign_id)).await
}

/// Deletes the server copy of everything this account synchronized to the campaign. The
/// local items stay on this device and stop being replicated. Explicit, confirmed in the UI.
#[tauri::command]
pub async fn sync_erase_server_copy(
    db: tauri::State<'_, Database>,
    auto: tauri::State<'_, Auto>,
    campaign_id: String,
) -> AppResult<engine::Link> {
    let (current, session, client) = signed_in(&db)?;
    let link = linked(
        &db,
        &campaign_id,
        &session,
        current.server.as_deref().unwrap_or(""),
    )
    .await?;
    client
        .erase_own_content(&link.remote_id)
        .await
        .map_err(String::from)?;
    let id = campaign_id.clone();
    db.run(move |c| {
        engine::forget_replication(c, &id)?;
        engine::set_auto(c, &id, false, false)
    })
    .await?;
    auto.reload().await;
    let id = campaign_id.clone();
    db.run(move |c| engine::require_link(c, &id)).await
}
/// Owner only: deletes the campaign on the server (exact name required) and unlinks it here.
/// Every local item stays.
#[tauri::command]
pub async fn sync_delete_server_campaign(
    db: tauri::State<'_, Database>,
    auto: tauri::State<'_, Auto>,
    campaign_id: String,
    confirm_name: String,
) -> AppResult<()> {
    let (current, session, client) = signed_in(&db)?;
    let link = linked(
        &db,
        &campaign_id,
        &session,
        current.server.as_deref().unwrap_or(""),
    )
    .await?;
    if link.role != "owner" {
        return Err("Only the owner of the shared campaign can delete it on the server.".into());
    }
    client
        .delete_campaign(&link.remote_id, &confirm_name)
        .await
        .map_err(String::from)?;
    db.run(move |c| engine::unlink(c, &campaign_id)).await?;
    auto.reload().await;
    Ok(())
}
/// Deletes the account on the server after a password check, then forgets the session and
/// the links of that account here. Campaign data on this device is untouched.
#[tauri::command]
pub async fn sync_delete_account(
    db: tauri::State<'_, Database>,
    gate: tauri::State<'_, sync::Gate>,
    auto: tauri::State<'_, Auto>,
    password: String,
    delete_owned_campaigns: bool,
) -> AppResult<AccountView> {
    let _busy = gate.0.try_lock().map_err(|_| BUSY)?;
    if password.is_empty() || password.len() > 1024 {
        return Err("Enter your password.".into());
    }
    let (current, session, client) = signed_in(&db)?;
    auto.stop_all();
    client
        .delete_account(&password, delete_owned_campaigns)
        .await
        .map_err(String::from)
        .inspect_err(|_| {
            // Nothing was deleted: keep synchronizing as before.
        })?;
    let (server, account_id) = (
        current.server.clone().unwrap_or_default(),
        session.account_id,
    );
    db.run(move |c| engine::forget_account(c, &server, &account_id))
        .await?;
    let mut account = current;
    account.session = None;
    sync::write_account(&db.root()?, &account)?;
    auto.reload().await;
    Ok(AccountView::from(&account))
}
