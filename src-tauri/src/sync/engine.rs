//! Local side of replication: which items are replicated (privately for this account's
//! own devices, or shared with the members), what the server last accepted, the operation
//! currently on the wire, items received from other members, and conflicts. Network calls
//! happen between short archive transactions, never while holding the archive.
//!
//! Pending work is *derived*: an item is pending when its current payload or visibility
//! differs from what the server last accepted. That difference lives in the same archive,
//! and commits in the same transaction, as the content itself, so an autosave and its
//! outbound change can never be separated by a crash. Only the operation actually sent
//! is stored separately (`sync_outbox`) so a lost response is retried under the same ID.
use super::{
    api::{self, ApiResult, Failure},
    kind, projection, remote_id,
};
use crate::{
    graph, journal,
    journal::{identifier, storage, title, AppResult},
    knowledge, party, Database,
};
use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;
use serde_json::{json, Map, Value};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Link {
    pub campaign_id: String,
    pub server: String,
    pub remote_id: String,
    pub account_id: String,
    pub role: String,
    pub cursor: String,
    pub synced_at: Option<String>,
    /// Continuous synchronization was explicitly activated for this campaign.
    pub auto: bool,
    pub paused: bool,
    pub last_error: Option<String>,
    /// The server says this account no longer has access to the campaign.
    pub access_lost: bool,
}
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Item {
    pub kind: String,
    pub item_id: String,
    pub title: String,
    /// Visible to the other members.
    pub shared: bool,
    /// none | private | shared
    pub scope: String,
    /// private | new | pending | synced | conflict | blocked | revoking
    pub status: String,
}
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteItem {
    pub kind: String,
    pub item_id: String,
    pub author_id: String,
    pub author_name: String,
    pub revision: i64,
    pub payload: Value,
    pub updated_at: String,
    /// This account's own item that has not been created on this device yet.
    pub mine: bool,
}
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Conflict {
    pub kind: String,
    pub item_id: String,
    pub title: String,
    pub remote_revision: i64,
    pub local: Option<Value>,
    /// `null` when the item was removed from the server meanwhile.
    pub remote: Value,
}
#[derive(Debug, Clone, Default, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Report {
    pub received: usize,
    pub removed: usize,
    pub updated: usize,
    /// Items of this account created locally from another device's copy.
    pub materialized: usize,
    pub pushed: usize,
    pub deleted: usize,
    pub conflicts: usize,
    pub blocked: usize,
    /// The server asked this device to list the campaign again.
    pub resynchronized: bool,
}
/// What still separates this device from the server, for the visible save state.
#[derive(Debug, Clone, Default, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Counts {
    pub pending: usize,
    pub blocked: usize,
    pub conflicts: usize,
    pub in_flight: usize,
}

fn now() -> String {
    chrono::DateTime::<chrono::Utc>::from(std::time::SystemTime::now()).to_rfc3339()
}
fn invalid() -> String {
    "Invalid shared item: it was not stored.".into()
}
pub fn hash(value: &Value) -> String {
    // serde_json maps are ordered by key, so equal content hashes equally.
    format!("{:x}", Sha256::digest(value.to_string()))
}
/// Sheet sections and images are shared as read-only projections: another computer cannot
/// rebuild a sheet or re-attach an image from them, so they are never created locally.
fn is_projection(kind_name: &str) -> bool {
    matches!(kind_name, "sheetSection" | "image")
}
/// Pages and sessions first, then the items that refer to them.
fn rank(kind_name: &str) -> u8 {
    match kind_name {
        "page" => 0,
        "session" => 1,
        "party" => 2,
        _ => 3,
    }
}

pub fn link(c: &Connection, campaign: &str) -> AppResult<Option<Link>> {
    identifier(campaign)?;
    c.query_row(
        "SELECT campaign_id,server,remote_id,account_id,role,cursor,synced_at,auto,paused,last_error,access_lost FROM sync_links WHERE campaign_id=?1",
        [campaign],
        |r| {
            Ok(Link {
                campaign_id: r.get(0)?,
                server: r.get(1)?,
                remote_id: r.get(2)?,
                account_id: r.get(3)?,
                role: r.get(4)?,
                cursor: r.get(5)?,
                synced_at: r.get(6)?,
                auto: r.get(7)?,
                paused: r.get(8)?,
                last_error: r.get(9)?,
                access_lost: r.get(10)?,
            })
        },
    )
    .optional()
    .map_err(storage)
}
pub fn all_links(c: &Connection) -> AppResult<Vec<Link>> {
    let mut q = c
        .prepare("SELECT campaign_id FROM sync_links ORDER BY campaign_id")
        .map_err(storage)?;
    let ids = q
        .query_map([], |r| r.get::<_, String>(0))
        .map_err(storage)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(storage)?;
    ids.iter()
        .filter_map(|id| link(c, id).transpose())
        .collect()
}
pub fn require_link(c: &Connection, campaign: &str) -> AppResult<Link> {
    link(c, campaign)?.ok_or_else(|| "This campaign is not linked to a sharing server.".into())
}
pub fn save_link(c: &Connection, link: &Link) -> AppResult<()> {
    journal::require_campaign(c, &link.campaign_id)?;
    remote_id(&link.remote_id)?;
    remote_id(&link.account_id)?;
    if !["owner", "player", "reader"].contains(&link.role.as_str()) {
        return Err("Unsupported role in the shared campaign.".into());
    }
    if self::link(c, &link.campaign_id)?.is_some() {
        return Err("This campaign is already linked. Unlink it first.".into());
    }
    c.execute(
        "INSERT INTO sync_links(campaign_id,server,remote_id,account_id,role) VALUES(?1,?2,?3,?4,?5)",
        params![link.campaign_id, link.server, link.remote_id, link.account_id, link.role],
    )
    .map_err(storage)?;
    Ok(())
}
/// Creates the local copy of a campaign that lives on the server (for example for a second
/// computer of the same account) and links it. The first synchronization fills it.
pub fn attach_campaign(
    c: &Connection,
    server: &str,
    account_id: &str,
    remote: &api::RemoteCampaign,
) -> AppResult<journal::Campaign> {
    if all_links(c)?
        .iter()
        .any(|l| l.server == server && l.remote_id == remote.id)
    {
        return Err("This campaign is already on this device.".into());
    }
    let created = journal::create_campaign(c, &remote.name)?;
    let attached = Link {
        campaign_id: created.id.clone(),
        server: server.into(),
        remote_id: remote.id.clone(),
        account_id: account_id.into(),
        role: remote.role.clone(),
        cursor: String::new(),
        synced_at: None,
        auto: false,
        paused: false,
        last_error: None,
        access_lost: false,
    };
    save_link(c, &attached)?;
    Ok(created)
}
/// Local only: forgets the link, choices and received copies; campaign data stays.
pub fn unlink(c: &Connection, campaign: &str) -> AppResult<()> {
    require_link(c, campaign)?;
    let tx = c.unchecked_transaction().map_err(storage)?;
    for table in [
        "sync_outbox",
        "sync_conflicts",
        "sync_remote_items",
        "sync_shares",
        "sync_links",
    ] {
        tx.execute(
            &format!("DELETE FROM {table} WHERE campaign_id=?1"),
            [campaign],
        )
        .map_err(storage)?;
    }
    tx.commit().map_err(storage)
}
/// Explicit activation of continuous synchronization (and its pause) for one campaign.
pub fn set_auto(c: &Connection, campaign: &str, auto: bool, paused: bool) -> AppResult<Link> {
    require_link(c, campaign)?;
    // Switching it on again is a new attempt: the next pass finds out whether access is back.
    c.execute(
        "UPDATE sync_links SET auto=?2,paused=?3,access_lost=CASE WHEN ?2=1 THEN 0 ELSE access_lost END,last_error=CASE WHEN ?2=1 THEN NULL ELSE last_error END WHERE campaign_id=?1",
        params![campaign, auto, paused && auto],
    )
    .map_err(storage)?;
    require_link(c, campaign)
}
/// The server no longer lets this account into the campaign (removed, or the campaign was
/// deleted). Copies received from other players are cleared; this account's own items, its
/// replication choices and pending changes stay, so access can resume if it comes back.
pub fn access_lost(c: &Connection, campaign: &str, message: &str) -> AppResult<()> {
    let link = require_link(c, campaign)?;
    let tx = c.unchecked_transaction().map_err(storage)?;
    tx.execute(
        "DELETE FROM sync_remote_items WHERE campaign_id=?1 AND author_id<>?2",
        params![campaign, link.account_id],
    )
    .map_err(storage)?;
    tx.execute(
        // The cursor restarts too: if access returns, everything is read again.
        "UPDATE sync_links SET access_lost=1,auto=0,paused=0,cursor='',last_error=?2 WHERE campaign_id=?1",
        params![campaign, message.chars().take(300).collect::<String>()],
    )
    .map_err(storage)?;
    tx.commit().map_err(storage)
}
/// Forgets every link of a signed-out or deleted account on one server. Campaign data stays.
pub fn forget_account(c: &Connection, server: &str, account: &str) -> AppResult<usize> {
    let mut forgotten = 0;
    for link in all_links(c)? {
        if link.server == server && link.account_id == account {
            unlink(c, &link.campaign_id)?;
            forgotten += 1;
        }
    }
    Ok(forgotten)
}
/// Stops replicating every item of a campaign after its server copy was erased. Local items
/// stay; nothing is sent until the user chooses items again.
pub fn forget_replication(c: &Connection, campaign: &str) -> AppResult<()> {
    require_link(c, campaign)?;
    let tx = c.unchecked_transaction().map_err(storage)?;
    for table in ["sync_outbox", "sync_shares", "sync_conflicts"] {
        tx.execute(
            &format!("DELETE FROM {table} WHERE campaign_id=?1"),
            [campaign],
        )
        .map_err(storage)?;
    }
    tx.commit().map_err(storage)
}
/// Short, content-free note for the status line; `None` clears it.
pub fn set_error(c: &Connection, campaign: &str, message: Option<&str>) -> AppResult<()> {
    let text = message.map(|m| m.chars().take(300).collect::<String>());
    c.execute(
        "UPDATE sync_links SET last_error=?2 WHERE campaign_id=?1",
        params![campaign, text],
    )
    .map_err(storage)?;
    Ok(())
}

/// Replicated pages and the visibility they must have on the server.
fn page_shares(c: &Connection, campaign: &str) -> AppResult<HashMap<String, String>> {
    let mut q = c
        .prepare("SELECT item_id,visibility FROM sync_shares WHERE campaign_id=?1 AND kind='page' AND state='shared'")
        .map_err(storage)?;
    let rows = q
        .query_map([campaign], |r| Ok((r.get(0)?, r.get(1)?)))
        .map_err(storage)?
        .collect::<rusqlite::Result<HashMap<String, String>>>()
        .map_err(storage);
    rows
}

/// The shared form of a local item, or None when it no longer exists.
pub fn payload(
    c: &Connection,
    campaign: &str,
    kind_name: &str,
    id: &str,
) -> AppResult<Option<Value>> {
    kind(kind_name)?;
    identifier(id)?;
    Ok(match kind_name {
        "page" => knowledge::get_page(c, campaign, id).ok().map(|p| {
            json!({"title":p.title,"kind":p.kind,"status":p.status,"aliases":p.aliases,"document":p.document})
        }),
        "session" => journal::get_session(c, campaign, id).ok().map(|s| {
            json!({"sequence":s.sequence,"title":s.title,"playedOn":s.played_on,"document":s.document})
        }),
        // Source references may point to private notes: only the assertion travels.
        "relationship" => graph::get_relationship(c, campaign, id).ok().map(|r| {
            json!({"fromPageId":r.input.from_page_id,"toPageId":r.input.to_page_id,"label":r.input.label,"certainty":r.input.certainty,"evidence":r.input.evidence,"notes":r.input.notes})
        }),
        "sheetSection" => projection::section_payload(c, campaign, id)?,
        "image" => projection::image_payload(c, campaign, id)?,
        _ => party::list(c, campaign)?
            .into_iter()
            .find(|m| m.page.id == id)
            .map(|m| json!({"pageId":m.page.id,"name":m.page.title,"playerName":m.player_name,"role":m.role,"status":m.status})),
    })
}

fn item_title(kind_name: &str, payload: &Value) -> String {
    let text = |key: &str| payload[key].as_str().unwrap_or("").to_string();
    match kind_name {
        "session" => format!("Session {}: {}", payload["sequence"], text("title")),
        "relationship" => text("label"),
        "party" | "sheetSection" => text("name"),
        "image" => text("caption"),
        _ => text("title"),
    }
}

/// Pages an item points to; they must exist on the server first.
fn endpoints(kind_name: &str, value: &Value) -> Vec<String> {
    let id = |key: &str| value[key].as_str().map(String::from);
    match kind_name {
        "relationship" => ["fromPageId", "toPageId"]
            .iter()
            .filter_map(|k| id(k))
            .collect(),
        "party" => id("pageId").into_iter().collect(),
        _ => vec![],
    }
}
/// An item cannot be sent while a page it refers to is not replicated, nor shared with
/// the members while a page it refers to is private.
fn blocked(
    kind_name: &str,
    value: &Value,
    visibility: &str,
    pages: &HashMap<String, String>,
) -> bool {
    // An image the server would refuse is reported as waiting, not retried forever.
    if kind_name == "image" && projection::image_too_large(value) {
        return true;
    }
    endpoints(kind_name, value)
        .iter()
        .any(|page| match pages.get(page) {
            None => true,
            Some(v) => visibility == "members" && v != "members",
        })
}

type ShareRow = (String, String, i64, String, String);
const SHARE_COLUMNS: &str = "state,pushed_hash,remote_revision,visibility,pushed_visibility";
fn share(c: &Connection, campaign: &str, kind_name: &str, id: &str) -> AppResult<Option<ShareRow>> {
    c.query_row(
        &format!("SELECT {SHARE_COLUMNS} FROM sync_shares WHERE campaign_id=?1 AND kind=?2 AND item_id=?3"),
        params![campaign, kind_name, id],
        |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?)),
    )
    .optional()
    .map_err(storage)
}
fn has_conflict(c: &Connection, campaign: &str, kind_name: &str, id: &str) -> AppResult<bool> {
    c.query_row(
        "SELECT EXISTS(SELECT 1 FROM sync_conflicts WHERE campaign_id=?1 AND kind=?2 AND item_id=?3)",
        params![campaign, kind_name, id],
        |r| r.get(0),
    )
    .map_err(storage)
}

/// Every local item with its replication state, for the selection list.
pub fn items(c: &Connection, campaign: &str) -> AppResult<Vec<Item>> {
    require_link(c, campaign)?;
    let mut ids: Vec<(String, String)> = vec![];
    for page in knowledge::list_pages(c, campaign)? {
        ids.push(("page".into(), page.id));
    }
    for session in journal::list_sessions(c, campaign)? {
        ids.push(("session".into(), session.id));
    }
    let mut q = c
        .prepare("SELECT id FROM relationships WHERE campaign_id=?1 ORDER BY id")
        .map_err(storage)?;
    for id in q
        .query_map([campaign], |r| r.get::<_, String>(0))
        .map_err(storage)?
    {
        ids.push(("relationship".into(), id.map_err(storage)?));
    }
    for member in party::list(c, campaign)? {
        ids.push(("party".into(), member.page.id));
    }
    for (id, _, _) in projection::sections(c, campaign)? {
        ids.push(("sheetSection".into(), id));
    }
    for (id, _) in projection::image_items(c, campaign)? {
        ids.push(("image".into(), id));
    }
    let pages = page_shares(c, campaign)?;
    let mut out = vec![];
    for (kind_name, id) in ids {
        let Some(value) = payload(c, campaign, &kind_name, &id)? else {
            continue;
        };
        let row = share(c, campaign, &kind_name, &id)?;
        let conflict = has_conflict(c, campaign, &kind_name, &id)?;
        let active = row.as_ref().filter(|(state, ..)| state == "shared");
        let status = match &row {
            None => "private",
            Some(_) if conflict => "conflict",
            Some((state, ..)) if state == "revoked" => "revoking",
            Some((_, _, _, visibility, _)) if blocked(&kind_name, &value, visibility, &pages) => {
                "blocked"
            }
            Some((_, _, 0, ..)) => "new",
            Some((_, pushed, _, visibility, pushed_visibility))
                if *pushed != hash(&value) || visibility != pushed_visibility =>
            {
                "pending"
            }
            Some(_) => "synced",
        };
        out.push(Item {
            title: item_title(&kind_name, &value),
            scope: match active {
                None => "none",
                Some((.., visibility, _)) if visibility == "members" => "shared",
                Some(_) => "private",
            }
            .into(),
            shared: active.is_some_and(|(.., visibility, _)| visibility == "members"),
            kind: kind_name,
            item_id: id,
            status: status.into(),
        });
    }
    Ok(out)
}

/// Chooses what happens to an item: `none` (stays on this device), `private` (replicated
/// to this account's other devices, invisible to the members) or `shared` (visible to
/// the members). Choosing `none` for an item already on the server removes the server copy
/// at the next synchronization; the local item is never touched.
pub fn set_scope(
    c: &Connection,
    campaign: &str,
    kind_name: &str,
    id: &str,
    scope: &str,
) -> AppResult<()> {
    let link = require_link(c, campaign)?;
    if link.role == "reader" {
        return Err("Readers can consult the shared campaign but not share items.".into());
    }
    if !["none", "private", "shared"].contains(&scope) {
        return Err("Choose none, private or shared.".into());
    }
    if is_projection(kind_name) && scope == "private" {
        return Err(
            "Character sheet sections and images can only be shared, or kept on this device."
                .into(),
        );
    }
    let value = payload(c, campaign, kind_name, id)?.ok_or("Item not found in this campaign.")?;
    if scope != "none" && kind_name == "image" && projection::image_too_large(&value) {
        return Err("This image is too large for the server: at most 8 MiB, 8192 pixels on a side and 16 million pixels.".into());
    }
    let visibility = if scope == "shared" {
        "members"
    } else {
        "private"
    };
    let tx = c.unchecked_transaction().map_err(storage)?;
    if scope != "none" {
        let pages = page_shares(&tx, campaign)?;
        if blocked(kind_name, &value, visibility, &pages) {
            return Err(if visibility == "members" {
                "Share the pages this item refers to first.".into()
            } else {
                "Replicate the pages this item refers to first.".to_string()
            });
        }
        tx.execute(
            "INSERT INTO sync_shares(campaign_id,kind,item_id,state,visibility) VALUES(?1,?2,?3,'shared',?4) ON CONFLICT(campaign_id,kind,item_id) DO UPDATE SET state='shared',visibility=excluded.visibility",
            params![campaign, kind_name, id, visibility],
        )
        .map_err(storage)?;
    } else {
        stop_replicating(&tx, campaign, kind_name, id)?;
    }
    if kind_name == "page" && scope != "shared" {
        // Dependent items must not outlive the visibility of the pages they refer to.
        let mut q = tx
            .prepare("SELECT kind,item_id,visibility FROM sync_shares WHERE campaign_id=?1 AND kind IN ('relationship','party') AND state='shared'")
            .map_err(storage)?;
        let rows = q
            .query_map([campaign], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, String>(2)?,
                ))
            })
            .map_err(storage)?
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(storage)?;
        drop(q);
        for (dependent_kind, dependent, current) in rows {
            let refers = payload(&tx, campaign, &dependent_kind, &dependent)?
                .is_some_and(|v| endpoints(&dependent_kind, &v).iter().any(|p| p == id));
            if !refers {
                continue;
            }
            if scope == "none" {
                stop_replicating(&tx, campaign, &dependent_kind, &dependent)?;
            } else if current == "members" {
                tx.execute(
                    "UPDATE sync_shares SET visibility='private' WHERE campaign_id=?1 AND kind=?2 AND item_id=?3",
                    params![campaign, dependent_kind, dependent],
                )
                .map_err(storage)?;
            }
        }
    }
    tx.commit().map_err(storage)
}
/// Never sent: forget it. Already on the server: remove the server copy at the next sync.
fn stop_replicating(c: &Connection, campaign: &str, kind_name: &str, id: &str) -> AppResult<()> {
    c.execute(
        "DELETE FROM sync_shares WHERE campaign_id=?1 AND kind=?2 AND item_id=?3 AND remote_revision=0 AND NOT EXISTS(SELECT 1 FROM sync_outbox o WHERE o.campaign_id=sync_shares.campaign_id AND o.kind=sync_shares.kind AND o.item_id=sync_shares.item_id)",
        params![campaign, kind_name, id],
    )
    .map_err(storage)?;
    c.execute(
        "UPDATE sync_shares SET state='revoked' WHERE campaign_id=?1 AND kind=?2 AND item_id=?3",
        params![campaign, kind_name, id],
    )
    .map_err(storage)?;
    Ok(())
}
/// Replicates every local item privately, except the ones already chosen, in dependency order.
pub fn replicate_all_privately(c: &Connection, campaign: &str) -> AppResult<usize> {
    require_link(c, campaign)?;
    let mut chosen = 0;
    let mut list = items(c, campaign)?;
    list.sort_by_key(|i| rank(&i.kind));
    for item in list {
        // Sheet sections and images are never part of a private copy: they can only be shared.
        if is_projection(&item.kind) {
            continue;
        }
        if item.scope == "none" && item.status == "private" {
            set_scope(c, campaign, &item.kind, &item.item_id, "private")?;
            chosen += 1;
        }
    }
    Ok(chosen)
}

#[derive(Debug, Clone, PartialEq)]
pub enum Job {
    Put {
        kind: String,
        id: String,
        base: i64,
        payload: Value,
        hash: String,
        visibility: String,
    },
    Delete {
        kind: String,
        id: String,
        base: i64,
    },
}
/// Changes to send, computed from one consistent snapshot of the archive.
pub fn pending(c: &Connection, campaign: &str) -> AppResult<(Vec<Job>, usize)> {
    let link = require_link(c, campaign)?;
    if link.role == "reader" {
        return Ok((vec![], 0));
    }
    let mut q = c
        .prepare("SELECT kind,item_id,state,pushed_hash,remote_revision,visibility,pushed_visibility FROM sync_shares s WHERE campaign_id=?1 AND NOT EXISTS(SELECT 1 FROM sync_conflicts k WHERE k.campaign_id=s.campaign_id AND k.kind=s.kind AND k.item_id=s.item_id) AND NOT EXISTS(SELECT 1 FROM sync_outbox o WHERE o.campaign_id=s.campaign_id AND o.kind=s.kind AND o.item_id=s.item_id) ORDER BY kind,item_id")
        .map_err(storage)?;
    let rows = q
        .query_map([campaign], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, String>(3)?,
                r.get::<_, i64>(4)?,
                r.get::<_, String>(5)?,
                r.get::<_, String>(6)?,
            ))
        })
        .map_err(storage)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(storage)?;
    drop(q);
    let pages = page_shares(c, campaign)?;
    let (mut jobs, mut blocked_count) = (vec![], 0);
    for (kind_name, id, state, pushed, base, visibility, pushed_visibility) in rows {
        let current = payload(c, campaign, &kind_name, &id)?;
        match (state.as_str(), current) {
            ("shared", Some(value)) => {
                if blocked(&kind_name, &value, &visibility, &pages) {
                    blocked_count += 1;
                    continue;
                }
                let h = hash(&value);
                if h != pushed || base == 0 || visibility != pushed_visibility {
                    jobs.push(Job::Put {
                        kind: kind_name,
                        id,
                        base,
                        payload: value,
                        hash: h,
                        visibility,
                    });
                }
            }
            // Revoked, or deleted locally: remove it from the server.
            _ if base > 0 => jobs.push(Job::Delete {
                kind: kind_name,
                id,
                base,
            }),
            _ => {
                c.execute(
                    "DELETE FROM sync_shares WHERE campaign_id=?1 AND kind=?2 AND item_id=?3",
                    params![campaign, kind_name, id],
                )
                .map_err(storage)?;
            }
        }
    }
    jobs.sort_by_key(|job| match job {
        Job::Put { kind, .. } => (0, rank(kind)),
        // Deletions go last and dependents first: a page is removed after its relationships.
        Job::Delete { kind, .. } => (1, 4 - rank(kind)),
    });
    Ok((jobs, blocked_count))
}
/// Changes whenever something replicable (or the replication choices) changed locally.
/// Cheap by design: counts, revision sums and newest timestamps, no payloads.
pub fn fingerprint(c: &Connection, campaign: &str) -> AppResult<String> {
    c.query_row(
        "SELECT (SELECT count(*)||':'||coalesce(sum(revision),0)||':'||coalesce(max(updated_at),'') FROM pages WHERE campaign_id=?1)||'|'||(SELECT count(*)||':'||coalesce(sum(revision),0)||':'||coalesce(max(updated_at),'') FROM sessions WHERE campaign_id=?1)||'|'||(SELECT count(*)||':'||coalesce(sum(revision),0)||':'||coalesce(max(updated_at),'') FROM relationships WHERE campaign_id=?1)||'|'||(SELECT count(*)||':'||coalesce(sum(revision),0) FROM party_members WHERE campaign_id=?1)||'|'||(SELECT count(*)||':'||coalesce(sum(length(visibility)+length(state)),0) FROM sync_shares WHERE campaign_id=?1)||'|'||(SELECT count(*) FROM sync_conflicts WHERE campaign_id=?1)||'|'||(SELECT count(*)||':'||coalesce(sum(revision),0) FROM characters WHERE campaign_id=?1)||'|'||(SELECT count(*)||':'||coalesce(max(caption),'') FROM image_attachments WHERE campaign_id=?1)",
        [campaign],
        |r| r.get(0),
    )
    .map_err(storage)
}
pub fn counts(c: &Connection, campaign: &str) -> AppResult<Counts> {
    let (jobs, blocked) = pending(c, campaign)?;
    let number = |sql: &str| -> AppResult<usize> {
        c.query_row(sql, [campaign], |r| r.get::<_, i64>(0))
            .map(|n| n as usize)
            .map_err(storage)
    };
    Ok(Counts {
        pending: jobs.len(),
        blocked,
        conflicts: number("SELECT count(*) FROM sync_conflicts WHERE campaign_id=?1")?,
        in_flight: number("SELECT count(*) FROM sync_outbox WHERE campaign_id=?1")?,
    })
}

/// The operation on the wire: stored with its request ID before the request is sent.
#[derive(Debug, Clone)]
pub struct Outbound {
    pub kind: String,
    pub id: String,
    pub op: String,
    pub request_id: String,
    pub base: i64,
    pub visibility: String,
    pub payload: Option<Value>,
    pub hash: String,
}
/// UUIDv7: the server verifies the age of operation IDs to bound its receipts.
fn request_id() -> String {
    uuid::Uuid::now_v7().to_string()
}
pub fn begin(c: &Connection, campaign: &str, job: &Job) -> AppResult<Outbound> {
    let out = match job {
        Job::Put {
            kind,
            id,
            base,
            payload,
            hash,
            visibility,
        } => Outbound {
            kind: kind.clone(),
            id: id.clone(),
            op: "save".into(),
            request_id: request_id(),
            base: *base,
            visibility: visibility.clone(),
            payload: Some(payload.clone()),
            hash: hash.clone(),
        },
        Job::Delete { kind, id, base } => Outbound {
            kind: kind.clone(),
            id: id.clone(),
            op: "delete".into(),
            request_id: request_id(),
            base: *base,
            visibility: "private".into(),
            payload: None,
            hash: String::new(),
        },
    };
    c.execute(
        "INSERT INTO sync_outbox(campaign_id,kind,item_id,op,request_id,base_revision,visibility,payload,payload_hash,created_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10) ON CONFLICT(campaign_id,kind,item_id) DO UPDATE SET op=excluded.op,request_id=excluded.request_id,base_revision=excluded.base_revision,visibility=excluded.visibility,payload=excluded.payload,payload_hash=excluded.payload_hash,created_at=excluded.created_at",
        params![campaign, out.kind, out.id, out.op, out.request_id, out.base, out.visibility, out.payload.as_ref().map(Value::to_string), out.hash, now()],
    )
    .map_err(storage)?;
    Ok(out)
}
pub fn outbox(c: &Connection, campaign: &str) -> AppResult<Vec<Outbound>> {
    let mut q = c
        .prepare("SELECT kind,item_id,op,request_id,base_revision,visibility,payload,payload_hash FROM sync_outbox WHERE campaign_id=?1 ORDER BY created_at,kind,item_id")
        .map_err(storage)?;
    let rows = q
        .query_map([campaign], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, String>(3)?,
                r.get::<_, i64>(4)?,
                r.get::<_, String>(5)?,
                r.get::<_, Option<String>>(6)?,
                r.get::<_, String>(7)?,
            ))
        })
        .map_err(storage)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(storage)?;
    rows.into_iter()
        .map(|(kind, id, op, request_id, base, visibility, raw, hash)| {
            Ok(Outbound {
                payload: raw
                    .map(|text| serde_json::from_str(&text).map_err(|_| invalid()))
                    .transpose()?,
                kind,
                id,
                op,
                request_id,
                base,
                visibility,
                hash,
            })
        })
        .collect()
}
fn finish(c: &Connection, campaign: &str, out: &Outbound) -> AppResult<()> {
    c.execute(
        "DELETE FROM sync_outbox WHERE campaign_id=?1 AND kind=?2 AND item_id=?3 AND request_id=?4",
        params![campaign, out.kind, out.id, out.request_id],
    )
    .map_err(storage)?;
    Ok(())
}

pub fn record_put(
    c: &Connection,
    campaign: &str,
    kind_name: &str,
    id: &str,
    hash: &str,
    revision: i64,
    visibility: &str,
) -> AppResult<()> {
    c.execute(
        "UPDATE sync_shares SET pushed_hash=?4,remote_revision=?5,pushed_visibility=?6 WHERE campaign_id=?1 AND kind=?2 AND item_id=?3",
        params![campaign, kind_name, id, hash, revision, visibility],
    )
    .map_err(storage)?;
    Ok(())
}
pub fn record_deleted(c: &Connection, campaign: &str, kind_name: &str, id: &str) -> AppResult<()> {
    c.execute(
        "DELETE FROM sync_shares WHERE campaign_id=?1 AND kind=?2 AND item_id=?3",
        params![campaign, kind_name, id],
    )
    .map_err(storage)?;
    Ok(())
}
pub fn record_conflict(
    c: &Connection,
    campaign: &str,
    kind_name: &str,
    id: &str,
    revision: i64,
    remote: Option<&Value>,
) -> AppResult<()> {
    if let Some(value) = remote {
        validate_payload(kind_name, value)?;
    }
    c.execute(
        "INSERT INTO sync_conflicts(campaign_id,kind,item_id,remote_revision,remote_payload,detected_at) VALUES(?1,?2,?3,?4,?5,?6) ON CONFLICT(campaign_id,kind,item_id) DO UPDATE SET remote_revision=excluded.remote_revision,remote_payload=excluded.remote_payload,detected_at=excluded.detected_at",
        params![campaign, kind_name, id, revision, remote.unwrap_or(&Value::Null).to_string(), now()],
    )
    .map_err(storage)?;
    Ok(())
}

/// Applies one page of server changes. Items of this account that exist on another device
/// are applied or created first through the domain functions (each in its own transaction);
/// received copies, conflicts and the cursor then commit together. On any error the cursor
/// stays put and the page is read again; already applied items are skipped then because
/// their revision is recorded.
pub fn apply_changes(
    c: &Connection,
    campaign: &str,
    changes: &[api::Change],
    cursor: &str,
) -> AppResult<Report> {
    apply_items(c, campaign, changes, Some(cursor))
}
fn apply_items(
    c: &Connection,
    campaign: &str,
    changes: &[api::Change],
    cursor: Option<&str>,
) -> AppResult<Report> {
    let link = require_link(c, campaign)?;
    for change in changes.iter().filter(|c| !c.deleted) {
        validate_payload(&change.kind, change.payload.as_ref().ok_or_else(invalid)?)?;
    }
    let mut report = Report::default();
    let mut later = vec![];
    let mut ordered: Vec<&api::Change> = changes.iter().collect();
    ordered.sort_by_key(|change| rank(&change.kind));
    for change in ordered {
        if change.author_id != link.account_id {
            later.push(change);
            continue;
        }
        let row = share(c, campaign, &change.kind, &change.id)?;
        if is_projection(&change.kind) {
            // Adopt the server's revision (another computer of this account may have shared
            // the same projection); the local content is not replaced and never deleted.
            match (row, change.deleted) {
                (Some((_, _, base, _, _)), false) if change.revision > base => {
                    c.execute(
                        "UPDATE sync_shares SET remote_revision=?4 WHERE campaign_id=?1 AND kind=?2 AND item_id=?3",
                        params![campaign, change.kind, change.id, change.revision],
                    )
                    .map_err(storage)?;
                }
                (Some(_), true) => later.push(change),
                (Some(_), false) => {}
                (None, false) => later.push(change),
                (None, true) => {}
            }
            continue;
        }
        match (row, change.deleted) {
            (Some((_, pushed, base, visibility, pushed_visibility)), false)
                if change.revision > base =>
            {
                let remote = change.payload.as_ref().ok_or_else(invalid)?;
                match payload(c, campaign, &change.kind, &change.id)? {
                    Some(local) if hash(&local) == pushed && visibility == pushed_visibility => {
                        apply_local(c, campaign, &change.kind, &change.id, remote)?;
                        let applied =
                            payload(c, campaign, &change.kind, &change.id)?.ok_or_else(invalid)?;
                        record_put(
                            c,
                            campaign,
                            &change.kind,
                            &change.id,
                            &hash(&applied),
                            change.revision,
                            change.visibility(),
                        )?;
                        c.execute(
                            "UPDATE sync_shares SET visibility=?4 WHERE campaign_id=?1 AND kind=?2 AND item_id=?3",
                            params![campaign, change.kind, change.id, change.visibility()],
                        )
                        .map_err(storage)?;
                        report.updated += 1;
                    }
                    _ => later.push(change),
                }
            }
            // An echo of this device's own write, or an older revision.
            (Some(_), false) => {}
            (Some(_), true) => later.push(change),
            (None, false) => match materialize(c, campaign, change) {
                Ok(true) => report.materialized += 1,
                Ok(false) => report.conflicts += 1,
                // A dependency (its page) may arrive later: keep a copy and retry.
                Err(_) => later.push(change),
            },
            (None, true) => {
                c.execute(
                    "DELETE FROM sync_remote_items WHERE campaign_id=?1 AND kind=?2 AND item_id=?3 AND author_id=?4",
                    params![campaign, change.kind, change.id, link.account_id],
                )
                .map_err(storage)?;
            }
        }
    }
    let tx = c.unchecked_transaction().map_err(storage)?;
    for change in later {
        let own = change.author_id == link.account_id;
        let row = if own {
            share(&tx, campaign, &change.kind, &change.id)?
        } else {
            None
        };
        match (own, row, change.deleted) {
            // Removed from the server on another device: stop replicating, keep the local item.
            (true, Some(_), true) => {
                record_deleted(&tx, campaign, &change.kind, &change.id)?;
                report.removed += 1;
            }
            (true, Some(_), false) => {
                record_conflict(
                    &tx,
                    campaign,
                    &change.kind,
                    &change.id,
                    change.revision,
                    change.payload.as_ref(),
                )?;
                report.conflicts += 1;
            }
            (_, _, true) => {
                report.removed += tx
                    .execute(
                        "DELETE FROM sync_remote_items WHERE campaign_id=?1 AND kind=?2 AND item_id=?3",
                        params![campaign, change.kind, change.id],
                    )
                    .map_err(storage)?;
            }
            (_, _, false) => {
                let value = change.payload.as_ref().ok_or_else(invalid)?;
                tx.execute(
                    "INSERT INTO sync_remote_items(campaign_id,kind,item_id,author_id,author_name,revision,payload,updated_at,visibility) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9) ON CONFLICT(campaign_id,kind,item_id) DO UPDATE SET author_id=excluded.author_id,author_name=excluded.author_name,revision=excluded.revision,payload=excluded.payload,updated_at=excluded.updated_at,visibility=excluded.visibility WHERE excluded.revision>=sync_remote_items.revision",
                    params![campaign, change.kind, change.id, change.author_id, change.author_name.trim(), change.revision, value.to_string(), change.updated_at, change.visibility()],
                )
                .map_err(storage)?;
                report.received += 1;
            }
        }
    }
    if let Some(cursor) = cursor {
        tx.execute(
            "UPDATE sync_links SET cursor=?2 WHERE campaign_id=?1",
            params![campaign, cursor],
        )
        .map_err(storage)?;
    }
    tx.commit().map_err(storage)?;
    report.materialized += retry_deferred(c, campaign, &link.account_id)?;
    Ok(report)
}

/// Creates this account's item locally from its server copy, then records it as replicated.
/// Returns false when a different local item already uses the id: both versions are then
/// kept as a conflict for the user. Errors leave nothing half-created.
fn materialize(c: &Connection, campaign: &str, change: &api::Change) -> AppResult<bool> {
    if is_projection(&change.kind) {
        return Err("Sheet sections and images are not created from the server.".into());
    }
    let remote = change.payload.as_ref().ok_or_else(invalid)?;
    let text = |key: &str| remote[key].as_str().unwrap_or_default().to_string();
    let exists = payload(c, campaign, &change.kind, &change.id)?;
    if let Some(local) = exists {
        let same = hash(&local) == hash(remote);
        c.execute(
            "INSERT INTO sync_shares(campaign_id,kind,item_id,state,visibility,pushed_visibility) VALUES(?1,?2,?3,'shared',?4,?4) ON CONFLICT(campaign_id,kind,item_id) DO NOTHING",
            params![campaign, change.kind, change.id, change.visibility()],
        )
        .map_err(storage)?;
        if same {
            record_put(
                c,
                campaign,
                &change.kind,
                &change.id,
                &hash(&local),
                change.revision,
                change.visibility(),
            )?;
            return Ok(true);
        }
        record_conflict(
            c,
            campaign,
            &change.kind,
            &change.id,
            change.revision,
            Some(remote),
        )?;
        return Ok(false);
    }
    match change.kind.as_str() {
        "page" => {
            let aliases: Vec<String> = remote["aliases"]
                .as_array()
                .ok_or_else(invalid)?
                .iter()
                .filter_map(|a| a.as_str().map(String::from))
                .collect();
            let tx = c.unchecked_transaction().map_err(storage)?;
            let page = knowledge::create_page_with_id(
                &tx,
                campaign,
                &change.id,
                &text("title"),
                &text("kind"),
                &text("status"),
                &aliases,
            )?;
            tx.commit().map_err(storage)?;
            knowledge::save_page_document(
                c,
                campaign,
                &change.id,
                page.revision,
                remote["document"].clone(),
            )?;
        }
        "session" => {
            let played_on = remote["playedOn"].as_str().map(String::from);
            let sequence = remote["sequence"].as_i64().ok_or_else(invalid)?;
            let session = journal::create_session_with_id(
                c,
                campaign,
                &change.id,
                sequence,
                &text("title"),
                played_on,
            )?;
            journal::save_document(
                c,
                campaign,
                &change.id,
                session.revision,
                remote["document"].clone(),
            )?;
        }
        "relationship" => {
            graph::create_relationship_with_id(
                c,
                campaign,
                &change.id,
                graph::RelationshipInput {
                    from_page_id: text("fromPageId"),
                    to_page_id: text("toPageId"),
                    label: text("label"),
                    certainty: text("certainty"),
                    source_kind: None,
                    source_id: None,
                    source_block_id: None,
                    evidence: text("evidence"),
                    notes: text("notes"),
                },
            )?;
        }
        _ => {
            party::save(
                c,
                campaign,
                &party::MemberInput {
                    page_id: Some(text("pageId")),
                    name: text("name"),
                    player_name: text("playerName"),
                    role: text("role"),
                    status: text("status"),
                    revision: None,
                },
            )?;
        }
    }
    let applied = payload(c, campaign, &change.kind, &change.id)?.ok_or_else(invalid)?;
    c.execute(
        "INSERT INTO sync_shares(campaign_id,kind,item_id,state,visibility,pushed_visibility,pushed_hash,remote_revision) VALUES(?1,?2,?3,'shared',?4,?4,?5,?6) ON CONFLICT(campaign_id,kind,item_id) DO UPDATE SET state='shared',visibility=excluded.visibility,pushed_visibility=excluded.pushed_visibility,pushed_hash=excluded.pushed_hash,remote_revision=excluded.remote_revision",
        params![campaign, change.kind, change.id, change.visibility(), hash(&applied), change.revision],
    )
    .map_err(storage)?;
    Ok(true)
}
/// Own items that could not be created before (their page had not arrived) are tried again.
fn retry_deferred(c: &Connection, campaign: &str, account: &str) -> AppResult<usize> {
    let mut q = c
        .prepare("SELECT kind,item_id,author_id,author_name,revision,payload,updated_at,visibility FROM sync_remote_items WHERE campaign_id=?1 AND author_id=?2")
        .map_err(storage)?;
    let rows = q
        .query_map(params![campaign, account], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, String>(3)?,
                r.get::<_, i64>(4)?,
                r.get::<_, String>(5)?,
                r.get::<_, String>(6)?,
                r.get::<_, String>(7)?,
            ))
        })
        .map_err(storage)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(storage)?;
    drop(q);
    let mut created = 0;
    let mut waiting: Vec<_> = rows;
    waiting.sort_by_key(|row| rank(&row.0));
    for (kind_name, id, author_id, author_name, revision, raw, updated_at, visibility) in waiting {
        // Projections of this account's other computers are only displayed.
        if is_projection(&kind_name) {
            continue;
        }
        let change = api::Change {
            kind: kind_name.clone(),
            id: id.clone(),
            author_id,
            author_name,
            revision,
            deleted: false,
            payload: serde_json::from_str(&raw).ok(),
            updated_at,
            visibility: Some(visibility),
        };
        if materialize(c, campaign, &change).is_ok() {
            c.execute(
                "DELETE FROM sync_remote_items WHERE campaign_id=?1 AND kind=?2 AND item_id=?3",
                params![campaign, kind_name, id],
            )
            .map_err(storage)?;
            created += 1;
        }
    }
    Ok(created)
}
/// Reconciles this device with a full listing: everything absent from it is gone from the
/// server for this account. Own items that vanished stop being replicated (never deleted).
pub fn apply_snapshot(
    c: &Connection,
    campaign: &str,
    listed: &[api::Change],
    head: &str,
) -> AppResult<Report> {
    let link = require_link(c, campaign)?;
    let mut report = apply_items(c, campaign, listed, None)?;
    let present: HashSet<(String, String)> = listed
        .iter()
        .map(|change| (change.kind.clone(), change.id.clone()))
        .collect();
    let tx = c.unchecked_transaction().map_err(storage)?;
    let mut q = tx
        .prepare("SELECT kind,item_id FROM sync_remote_items WHERE campaign_id=?1")
        .map_err(storage)?;
    let held = q
        .query_map([campaign], |r| {
            Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?))
        })
        .map_err(storage)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(storage)?;
    drop(q);
    for (kind_name, id) in held {
        if !present.contains(&(kind_name.clone(), id.clone())) {
            tx.execute(
                "DELETE FROM sync_remote_items WHERE campaign_id=?1 AND kind=?2 AND item_id=?3",
                params![campaign, kind_name, id],
            )
            .map_err(storage)?;
            report.removed += 1;
        }
    }
    let mut q = tx
        .prepare("SELECT kind,item_id FROM sync_shares WHERE campaign_id=?1 AND state='shared' AND remote_revision>0")
        .map_err(storage)?;
    let replicated = q
        .query_map([campaign], |r| {
            Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?))
        })
        .map_err(storage)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(storage)?;
    drop(q);
    for (kind_name, id) in replicated {
        let pushing: bool = tx
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM sync_outbox WHERE campaign_id=?1 AND kind=?2 AND item_id=?3)",
                params![campaign, kind_name, id],
                |r| r.get(0),
            )
            .map_err(storage)?;
        if !present.contains(&(kind_name.clone(), id.clone())) && !pushing {
            record_deleted(&tx, campaign, &kind_name, &id)?;
            report.removed += 1;
        }
    }
    tx.execute(
        "UPDATE sync_links SET cursor=?2 WHERE campaign_id=?1",
        params![link.campaign_id, head],
    )
    .map_err(storage)?;
    tx.commit().map_err(storage)?;
    report.resynchronized = true;
    Ok(report)
}

/// Replaces a local item with a shared version through the normal domain
/// functions, so validation, revisions and derived indexes stay consistent.
fn apply_local(
    c: &Connection,
    campaign: &str,
    kind_name: &str,
    id: &str,
    remote: &Value,
) -> AppResult<()> {
    let text = |key: &str| remote[key].as_str().unwrap_or_default().to_string();
    if is_projection(kind_name) {
        return Err("Sheet sections and images are never replaced from the server.".into());
    }
    match kind_name {
        "page" => {
            let aliases: Vec<String> = remote["aliases"]
                .as_array()
                .ok_or_else(invalid)?
                .iter()
                .filter_map(|a| a.as_str().map(String::from))
                .collect();
            knowledge::update_page(
                c,
                campaign,
                id,
                &text("title"),
                &text("kind"),
                &text("status"),
                &aliases,
            )?;
            let page = knowledge::get_page(c, campaign, id)?;
            if page.document != remote["document"] {
                knowledge::save_page_document(
                    c,
                    campaign,
                    id,
                    page.revision,
                    remote["document"].clone(),
                )?;
            }
        }
        "session" => {
            let session = journal::get_session(c, campaign, id)?;
            let played_on = remote["playedOn"].as_str().map(String::from);
            journal::update_session_details(c, campaign, id, &text("title"), played_on)?;
            if session.document != remote["document"] {
                journal::save_document(
                    c,
                    campaign,
                    id,
                    session.revision,
                    remote["document"].clone(),
                )?;
            }
        }
        "relationship" => {
            let local = graph::get_relationship(c, campaign, id)?;
            let mut input = local.input.clone();
            input.from_page_id = text("fromPageId");
            input.to_page_id = text("toPageId");
            input.label = text("label");
            input.certainty = text("certainty");
            input.evidence = text("evidence");
            input.notes = text("notes");
            graph::save_relationship(c, campaign, Some(id), Some(local.revision), input)?;
        }
        _ => {
            let member = party::list(c, campaign)?
                .into_iter()
                .find(|m| m.page.id == id)
                .ok_or("Local party member not found.")?;
            party::save(
                c,
                campaign,
                &party::MemberInput {
                    page_id: Some(id.into()),
                    name: member.page.title,
                    player_name: text("playerName"),
                    role: text("role"),
                    status: text("status"),
                    revision: Some(member.revision),
                },
            )?;
        }
    }
    Ok(())
}

pub fn conflicts(c: &Connection, campaign: &str) -> AppResult<Vec<Conflict>> {
    require_link(c, campaign)?;
    let mut q = c
        .prepare("SELECT kind,item_id,remote_revision,remote_payload FROM sync_conflicts WHERE campaign_id=?1 ORDER BY detected_at,kind,item_id")
        .map_err(storage)?;
    let rows = q
        .query_map([campaign], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, i64>(2)?,
                r.get::<_, String>(3)?,
            ))
        })
        .map_err(storage)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(storage)?;
    rows.into_iter()
        .map(|(kind_name, id, revision, raw)| {
            let remote: Value = serde_json::from_str(&raw).map_err(|_| invalid())?;
            let local = payload(c, campaign, &kind_name, &id)?;
            let title = local
                .as_ref()
                .or(Some(&remote).filter(|v| !v.is_null()))
                .map(|v| item_title(&kind_name, v))
                .unwrap_or_default();
            Ok(Conflict {
                kind: kind_name,
                item_id: id,
                title,
                remote_revision: revision,
                local,
                remote,
            })
        })
        .collect()
}
/// The user's choice for one conflict; both versions were shown first.
pub fn resolve(
    c: &Connection,
    campaign: &str,
    kind_name: &str,
    id: &str,
    keep: &str,
) -> AppResult<()> {
    kind(kind_name)?;
    identifier(id)?;
    let (revision, raw): (i64, String) = c
        .query_row(
            "SELECT remote_revision,remote_payload FROM sync_conflicts WHERE campaign_id=?1 AND kind=?2 AND item_id=?3",
            params![campaign, kind_name, id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()
        .map_err(storage)?
        .ok_or("Conflict already resolved. Reload the list.")?;
    let remote: Value = serde_json::from_str(&raw).map_err(|_| invalid())?;
    if keep == "remote" && is_projection(kind_name) {
        // The server's version cannot replace the local sheet or image: accepting it means
        // this device stops sharing that item.
        record_deleted(c, campaign, kind_name, id)?;
        c.execute(
            "DELETE FROM sync_conflicts WHERE campaign_id=?1 AND kind=?2 AND item_id=?3",
            params![campaign, kind_name, id],
        )
        .map_err(storage)?;
        return Ok(());
    }
    if keep == "remote" && !remote.is_null() {
        // Domain functions run their own transactions: apply before recording.
        if payload(c, campaign, kind_name, id)?.is_some() {
            apply_local(c, campaign, kind_name, id, &remote)?;
        } else {
            materialize(
                c,
                campaign,
                &api::Change {
                    kind: kind_name.into(),
                    id: id.into(),
                    author_id: String::new(),
                    author_name: String::new(),
                    revision,
                    deleted: false,
                    payload: Some(remote.clone()),
                    updated_at: String::new(),
                    visibility: None,
                },
            )?;
        }
    }
    let tx = c.unchecked_transaction().map_err(storage)?;
    match keep {
        // The local version is sent next time, on top of the server revision.
        "local" => {
            tx.execute(
                "UPDATE sync_shares SET pushed_hash='',remote_revision=?4 WHERE campaign_id=?1 AND kind=?2 AND item_id=?3",
                params![campaign, kind_name, id, if remote.is_null() { 0 } else { revision }],
            )
            .map_err(storage)?;
        }
        "remote" if remote.is_null() => record_deleted(&tx, campaign, kind_name, id)?,
        "remote" => {
            let applied = payload(&tx, campaign, kind_name, id)?.ok_or_else(invalid)?;
            let visibility = share(&tx, campaign, kind_name, id)?
                .map(|row| row.3)
                .unwrap_or_else(|| "members".into());
            record_put(
                &tx,
                campaign,
                kind_name,
                id,
                &hash(&applied),
                revision,
                &visibility,
            )?;
        }
        _ => return Err("Choose which version to keep.".into()),
    }
    tx.execute(
        "DELETE FROM sync_conflicts WHERE campaign_id=?1 AND kind=?2 AND item_id=?3",
        params![campaign, kind_name, id],
    )
    .map_err(storage)?;
    tx.commit().map_err(storage)
}

pub fn remote_items(c: &Connection, campaign: &str) -> AppResult<Vec<RemoteItem>> {
    let link = require_link(c, campaign)?;
    let mut q = c
        .prepare("SELECT kind,item_id,author_id,author_name,revision,payload,updated_at FROM sync_remote_items WHERE campaign_id=?1 ORDER BY author_name,kind,item_id")
        .map_err(storage)?;
    let rows = q
        .query_map([campaign], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, String>(3)?,
                r.get::<_, i64>(4)?,
                r.get::<_, String>(5)?,
                r.get::<_, String>(6)?,
            ))
        })
        .map_err(storage)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(storage)?;
    rows.into_iter()
        .map(
            |(kind_name, item_id, author_id, author_name, revision, raw, updated_at)| {
                Ok(RemoteItem {
                    mine: author_id == link.account_id,
                    payload: serde_json::from_str(&raw).map_err(|_| invalid())?,
                    kind: kind_name,
                    item_id,
                    author_id,
                    author_name,
                    revision,
                    updated_at,
                })
            },
        )
        .collect()
}

/// Shared content comes from other people: check its shape before storing it.
pub fn validate_payload(kind_name: &str, value: &Value) -> AppResult<()> {
    kind(kind_name)?;
    let object = value.as_object().ok_or_else(invalid)?;
    if value.to_string().len() > 2_000_000 {
        return Err(invalid());
    }
    let only = |keys: &[&str]| -> AppResult<()> {
        if object.keys().all(|k| keys.contains(&k.as_str())) && object.len() == keys.len() {
            Ok(())
        } else {
            Err(invalid())
        }
    };
    let text = |object: &Map<String, Value>, key: &str, max: usize| -> AppResult<()> {
        let value = object
            .get(key)
            .and_then(Value::as_str)
            .ok_or_else(invalid)?;
        if value.chars().count() > max || value.contains('\0') {
            return Err(invalid());
        }
        Ok(())
    };
    match kind_name {
        "page" => {
            only(&["title", "kind", "status", "aliases", "document"])?;
            title(object["title"].as_str().ok_or_else(invalid)?)?;
            if ![
                "npc", "place", "faction", "quest", "item", "event", "lore", "note",
            ]
            .contains(&object["kind"].as_str().unwrap_or(""))
                || !["stub", "active"].contains(&object["status"].as_str().unwrap_or(""))
            {
                return Err(invalid());
            }
            let aliases = object["aliases"].as_array().ok_or_else(invalid)?;
            if aliases.len() > 21
                || aliases
                    .iter()
                    .any(|a| a.as_str().is_none_or(|a| title(a).is_err()))
            {
                return Err(invalid());
            }
            journal::validate_document(&object["document"])?;
        }
        "session" => {
            only(&["sequence", "title", "playedOn", "document"])?;
            title(object["title"].as_str().ok_or_else(invalid)?)?;
            if !object["sequence"]
                .as_i64()
                .is_some_and(|n| (1..=999_999).contains(&n))
            {
                return Err(invalid());
            }
            match &object["playedOn"] {
                Value::Null => {}
                Value::String(d)
                    if d.len() == 10
                        && chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d").is_ok() => {}
                _ => return Err(invalid()),
            }
            journal::validate_document(&object["document"])?;
        }
        "relationship" => {
            only(&[
                "fromPageId",
                "toPageId",
                "label",
                "certainty",
                "evidence",
                "notes",
            ])?;
            identifier(object["fromPageId"].as_str().ok_or_else(invalid)?)?;
            identifier(object["toPageId"].as_str().ok_or_else(invalid)?)?;
            text(object, "label", 100)?;
            if object["label"].as_str().unwrap_or("").trim().is_empty()
                || !["confirmed", "suspected", "disproven", "unknown"]
                    .contains(&object["certainty"].as_str().unwrap_or(""))
            {
                return Err(invalid());
            }
            text(object, "evidence", 4000)?;
            text(object, "notes", 4000)?;
        }
        "sheetSection" => {
            only(&["characterId", "name", "section", "fields"])?;
            identifier(object["characterId"].as_str().ok_or_else(invalid)?)?;
            title(object["name"].as_str().ok_or_else(invalid)?)?;
            if !["identity", "combat", "equipment", "spellcasting", "custom"]
                .contains(&object["section"].as_str().unwrap_or(""))
            {
                return Err(invalid());
            }
            let fields = object["fields"].as_array().ok_or_else(invalid)?;
            if fields.is_empty() || fields.len() > 64 {
                return Err(invalid());
            }
            let mut keys = HashSet::new();
            for field in fields {
                let field = field.as_object().ok_or_else(invalid)?;
                if field.len() != 3 {
                    return Err(invalid());
                }
                text(field, "key", 100)?;
                text(field, "label", 100)?;
                text(field, "value", 4000)?;
                if !keys.insert(field["key"].as_str().unwrap_or("").to_string()) {
                    return Err(invalid());
                }
            }
        }
        "image" => {
            only(&["attachmentId", "caption"])?;
            identifier(object["attachmentId"].as_str().ok_or_else(invalid)?)?;
            text(object, "caption", 4000)?;
        }
        _ => {
            only(&["pageId", "name", "playerName", "role", "status"])?;
            identifier(object["pageId"].as_str().ok_or_else(invalid)?)?;
            title(object["name"].as_str().ok_or_else(invalid)?)?;
            text(object, "playerName", 200)?;
            text(object, "role", 200)?;
            if !["active", "former", "unknown"].contains(&object["status"].as_str().unwrap_or("")) {
                return Err(invalid());
            }
        }
    }
    Ok(())
}

pub fn validate_archive(c: &Connection) -> AppResult<()> {
    let mut q = c
        .prepare("SELECT campaign_id,server,remote_id,account_id FROM sync_links")
        .map_err(storage)?;
    let links = q
        .query_map([], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, String>(3)?,
            ))
        })
        .map_err(storage)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(storage)?;
    for (campaign, server, remote, account) in links {
        identifier(&campaign)?;
        super::server_url(&server, true)?;
        remote_id(&remote)?;
        remote_id(&account)?;
    }
    // Archives written by schema 19 have no outbox; later ones always do.
    let has_outbox: bool = c
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='sync_outbox')",
            [],
            |r| r.get(0),
        )
        .map_err(storage)?;
    let mut tables = vec![
        ("sync_remote_items", "payload"),
        ("sync_conflicts", "remote_payload"),
    ];
    if has_outbox {
        tables.push(("sync_outbox", "coalesce(payload,'null')"));
    }
    for (table, column) in tables {
        let mut q = c
            .prepare(&format!("SELECT kind,item_id,{column} FROM {table}"))
            .map_err(storage)?;
        let rows = q
            .query_map([], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, String>(2)?,
                ))
            })
            .map_err(storage)?
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(storage)?;
        for (kind_name, id, raw) in rows {
            identifier(&id)?;
            let value: Value = serde_json::from_str(&raw).map_err(|_| invalid())?;
            if !(table != "sync_remote_items" && value.is_null()) {
                validate_payload(&kind_name, &value)?;
            }
        }
    }
    Ok(())
}

/// Pull, then push, for one campaign. Reports counts; never overwrites a local change that
/// the server did not see: those become conflicts. Every failure is classified so a caller
/// can retry, ask for a new sign-in, or resynchronize.
pub async fn sync_now(db: &Database, client: &api::Client, campaign: String) -> ApiResult<Report> {
    let id = campaign.clone();
    let link = db.run(move |c| require_link(c, &id)).await?;
    let mut report = Report::default();
    match sync_pass(db, client, &link, &campaign, &mut report).await {
        Ok(()) => {}
        Err(Failure::AccessLost(message)) => {
            let (id, note) = (campaign.clone(), message.clone());
            db.run(move |c| access_lost(c, &id, &note)).await?;
            return Err(Failure::AccessLost(message));
        }
        Err(error) => return Err(error),
    }
    let id = campaign.clone();
    db.run(move |c| {
        c.execute(
            "UPDATE sync_links SET synced_at=?2,last_error=NULL,access_lost=0 WHERE campaign_id=?1",
            params![id, now()],
        )
        .map_err(storage)?;
        Ok(())
    })
    .await?;
    Ok(report)
}
async fn sync_pass(
    db: &Database,
    client: &api::Client,
    link: &Link,
    campaign: &str,
    report: &mut Report,
) -> ApiResult<()> {
    // Operations left on the wire by a crash or a lost response are settled first, under
    // their original IDs: the server acknowledges instead of re-applying them, and the
    // echo of such a write is then not mistaken for a change made elsewhere.
    settle_outbox(db, client, link, campaign, report).await?;
    let pulled = pull(db, client, link, campaign).await?;
    add(report, pulled);
    push_pending(db, client, link, campaign, report).await?;
    Ok(())
}
fn add(total: &mut Report, part: Report) {
    total.received += part.received;
    total.removed += part.removed;
    total.updated += part.updated;
    total.materialized += part.materialized;
    total.conflicts += part.conflicts;
    total.resynchronized |= part.resynchronized;
}
async fn pull(
    db: &Database,
    client: &api::Client,
    link: &Link,
    campaign: &str,
) -> ApiResult<Report> {
    let mut report = Report::default();
    let mut cursor = link.cursor.clone();
    let mut listed_again = false;
    for _ in 0..200 {
        let page = match client.sync(&link.remote_id, &cursor).await {
            Ok(page) => page,
            Err(Failure::CursorExpired) if !listed_again => {
                // The server dropped the history this device was waiting for.
                listed_again = true;
                let (summary, head) = resync(db, client, link, campaign).await?;
                add(&mut report, summary);
                cursor = head;
                continue;
            }
            Err(error) => return Err(error),
        };
        let (id, changes, next) = (campaign.to_string(), page.items, page.cursor.clone());
        let pulled = db
            .run(move |c| apply_changes(c, &id, &changes, &next))
            .await?;
        add(&mut report, pulled);
        cursor = page.cursor;
        if !page.more {
            return Ok(report);
        }
    }
    Err(Failure::Unavailable(
        "Too many changes to read at once: the rest continues at the next synchronization.".into(),
    ))
}
/// Lists the whole campaign and reconciles it; returns the cursor to resume from.
async fn resync(
    db: &Database,
    client: &api::Client,
    link: &Link,
    campaign: &str,
) -> ApiResult<(Report, String)> {
    let mut listed = vec![];
    let mut after = String::new();
    let mut head = None;
    for _ in 0..200 {
        let page = client.list(&link.remote_id, &after).await?;
        if head.is_none() {
            head = page.head.clone();
        }
        listed.extend(page.items);
        after = page.cursor;
        if !page.more {
            let head = head.ok_or_else(|| {
                Failure::Rejected("The sharing server did not report where to resume.".into())
            })?;
            let (id, snapshot, resume) = (campaign.to_string(), listed, head.clone());
            let report = db
                .run(move |c| apply_snapshot(c, &id, &snapshot, &resume))
                .await?;
            return Ok((report, head));
        }
    }
    Err(Failure::Rejected(
        "The campaign is too large to list on the sharing server.".into(),
    ))
}
async fn settle_outbox(
    db: &Database,
    client: &api::Client,
    link: &Link,
    campaign: &str,
    report: &mut Report,
) -> ApiResult<()> {
    let id = campaign.to_string();
    for out in db.run(move |c| outbox(c, &id)).await? {
        settle(db, client, link, campaign, out, report).await?;
    }
    Ok(())
}
async fn push_pending(
    db: &Database,
    client: &api::Client,
    link: &Link,
    campaign: &str,
    report: &mut Report,
) -> ApiResult<()> {
    let id = campaign.to_string();
    let (jobs, blocked) = db.run(move |c| pending(c, &id)).await?;
    report.blocked = blocked;
    for job in jobs {
        let job = match prepare(db, client, link, campaign, job).await {
            Ok(job) => job,
            // The server refused the original itself (size, format): wait, do not retry blindly.
            Err(Failure::Rejected(_)) => {
                report.blocked += 1;
                continue;
            }
            Err(error) => return Err(error),
        };
        let (id, planned) = (campaign.to_string(), job);
        let out = db.run(move |c| begin(c, &id, &planned)).await?;
        settle(db, client, link, campaign, out, report).await?;
    }
    Ok(())
}
/// Turns an image's local form into what the server stores: the original is uploaded first
/// (identical bytes are recognized, so a retry returns the stored copy), then the caption is
/// tied to the returned attachment. Other jobs are sent as they are.
async fn prepare(
    db: &Database,
    client: &api::Client,
    link: &Link,
    campaign: &str,
    job: Job,
) -> ApiResult<Job> {
    let Job::Put {
        kind,
        id,
        base,
        payload,
        hash,
        visibility,
    } = job
    else {
        return Ok(job);
    };
    if kind != "image" {
        return Ok(Job::Put {
            kind,
            id,
            base,
            payload,
            hash,
            visibility,
        });
    }
    let root = db.root()?;
    let (campaign_id, image_id) = (campaign.to_string(), id.clone());
    let (bytes, sha256) = db
        .run(move |c| {
            let attachment = crate::images::get(c, &campaign_id, &image_id)?;
            Ok((crate::images::bytes(&root, &attachment)?, attachment.sha256))
        })
        .await?;
    let mime = payload["mime"].as_str().unwrap_or("image/png").to_string();
    let attachment = client
        .upload_attachment(&link.remote_id, bytes, &mime, &sha256)
        .await?;
    Ok(Job::Put {
        payload: json!({"attachmentId": attachment, "caption": payload["caption"]}),
        kind,
        id,
        base,
        hash,
        visibility,
    })
}
async fn send(client: &api::Client, link: &Link, out: &Outbound) -> ApiResult<api::Write> {
    match (&out.op[..], &out.payload) {
        ("save", Some(payload)) => {
            client
                .put(
                    &link.remote_id,
                    &out.kind,
                    &out.id,
                    &out.request_id,
                    out.base,
                    &out.visibility,
                    payload,
                )
                .await
        }
        _ => {
            client
                .delete(
                    &link.remote_id,
                    &out.kind,
                    &out.id,
                    &out.request_id,
                    out.base,
                )
                .await
        }
    }
}
/// Sends one stored operation and records its definitive outcome. A transport failure keeps
/// the operation stored so the retry reuses its ID.
async fn settle(
    db: &Database,
    client: &api::Client,
    link: &Link,
    campaign: &str,
    out: Outbound,
    report: &mut Report,
) -> ApiResult<()> {
    let outcome = match send(client, link, &out).await {
        Ok(outcome) => outcome,
        // Too old to be acknowledged: forget it; the item is evaluated again from its state.
        Err(Failure::RequestExpired) => {
            let (id, finished) = (campaign.to_string(), out);
            db.run(move |c| finish(c, &id, &finished)).await?;
            return Ok(());
        }
        Err(error) => {
            // Refused for good (not a transport problem): do not retry the same bytes forever.
            if !error.transient() && !matches!(error, Failure::Unauthorized(_)) {
                let (id, finished) = (campaign.to_string(), out);
                db.run(move |c| finish(c, &id, &finished)).await?;
            }
            return Err(error);
        }
    };
    let (id, done) = (campaign.to_string(), out.clone());
    match (&out.op[..], outcome) {
        ("save", api::Write::Accepted { revision }) => {
            db.run(move |c| {
                record_put(
                    c,
                    &id,
                    &done.kind,
                    &done.id,
                    &done.hash,
                    revision,
                    &done.visibility,
                )?;
                finish(c, &id, &done)
            })
            .await?;
            report.pushed += 1;
        }
        ("save", api::Write::Conflict { revision, payload }) => {
            db.run(move |c| {
                record_conflict(c, &id, &done.kind, &done.id, revision, payload.as_ref())?;
                finish(c, &id, &done)
            })
            .await?;
            report.conflicts += 1;
        }
        // Removed on the server meanwhile: the user decides.
        ("save", api::Write::Missing) => {
            db.run(move |c| {
                record_conflict(c, &id, &done.kind, &done.id, done.base.max(1), None)?;
                finish(c, &id, &done)
            })
            .await?;
            report.conflicts += 1;
        }
        (_, api::Write::Accepted { .. }) | (_, api::Write::Missing) => {
            db.run(move |c| {
                record_deleted(c, &id, &done.kind, &done.id)?;
                finish(c, &id, &done)
            })
            .await?;
            report.deleted += 1;
        }
        // Revocation wins over a newer copy from another device: the content stays here anyway.
        (_, api::Write::Conflict { revision, .. }) => {
            let again = Job::Delete {
                kind: out.kind.clone(),
                id: out.id.clone(),
                base: revision,
            };
            let (id2, finished) = (id.clone(), done.clone());
            let next = db
                .run(move |c| {
                    finish(c, &id2, &finished)?;
                    begin(c, &id2, &again)
                })
                .await?;
            match send(client, link, &next).await? {
                api::Write::Accepted { .. } | api::Write::Missing => {
                    db.run(move |c| {
                        record_deleted(c, &id, &next.kind, &next.id)?;
                        finish(c, &id, &next)
                    })
                    .await?;
                    report.deleted += 1;
                }
                api::Write::Conflict { .. } => {
                    db.run(move |c| finish(c, &id, &next)).await?;
                    report.conflicts += 1;
                }
            }
        }
    }
    Ok(())
}
