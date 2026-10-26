//! Local side of sharing: which items are shared, what was last accepted by
//! the server, items received from other members, and conflicts. Network
//! calls happen between short archive transactions, never while holding it.
use super::{api, kind, remote_id};
use crate::{
    graph, journal,
    journal::{identifier, storage, title, AppResult},
    knowledge, party, Database,
};
use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;
use serde_json::{json, Map, Value};
use sha2::{Digest, Sha256};
use std::collections::HashSet;

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
}
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Item {
    pub kind: String,
    pub item_id: String,
    pub title: String,
    pub shared: bool,
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
    /// Shared by this account from another device.
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
    pub pushed: usize,
    pub deleted: usize,
    pub conflicts: usize,
    pub blocked: usize,
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

pub fn link(c: &Connection, campaign: &str) -> AppResult<Option<Link>> {
    identifier(campaign)?;
    c.query_row(
        "SELECT campaign_id,server,remote_id,account_id,role,cursor,synced_at FROM sync_links WHERE campaign_id=?1",
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
            })
        },
    )
    .optional()
    .map_err(storage)
}
fn require_link(c: &Connection, campaign: &str) -> AppResult<Link> {
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
/// Local only: forgets the link, choices and received copies; campaign data stays.
pub fn unlink(c: &Connection, campaign: &str) -> AppResult<()> {
    require_link(c, campaign)?;
    let tx = c.unchecked_transaction().map_err(storage)?;
    for table in [
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

fn page_ids_shared(c: &Connection, campaign: &str) -> AppResult<HashSet<String>> {
    let mut q = c
        .prepare("SELECT item_id FROM sync_shares WHERE campaign_id=?1 AND kind='page' AND state='shared'")
        .map_err(storage)?;
    let ids = q
        .query_map([campaign], |r| r.get(0))
        .map_err(storage)?
        .collect::<rusqlite::Result<HashSet<String>>>()
        .map_err(storage);
    ids
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
        "party" => text("name"),
        _ => text("title"),
    }
}

/// Every local item with its sharing state, for the selection list.
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
    let pages = page_ids_shared(c, campaign)?;
    let mut out = vec![];
    for (kind_name, id) in ids {
        let Some(value) = payload(c, campaign, &kind_name, &id)? else {
            continue;
        };
        let share = share(c, campaign, &kind_name, &id)?;
        let conflict = has_conflict(c, campaign, &kind_name, &id)?;
        let status = match &share {
            None => "private",
            Some(_) if conflict => "conflict",
            Some((state, _, _)) if state == "revoked" => "revoking",
            Some(_) if kind_name == "relationship" && !endpoints_shared(&value, &pages) => {
                "blocked"
            }
            Some((_, _, 0)) => "new",
            Some((_, pushed, _)) if *pushed != hash(&value) => "pending",
            Some(_) => "synced",
        };
        out.push(Item {
            title: item_title(&kind_name, &value),
            shared: share.as_ref().is_some_and(|(s, _, _)| s == "shared"),
            kind: kind_name,
            item_id: id,
            status: status.into(),
        });
    }
    Ok(out)
}
fn endpoints_shared(value: &Value, pages: &HashSet<String>) -> bool {
    ["fromPageId", "toPageId"]
        .iter()
        .all(|k| value[k].as_str().is_some_and(|id| pages.contains(id)))
}
type ShareRow = (String, String, i64);
fn share(c: &Connection, campaign: &str, kind_name: &str, id: &str) -> AppResult<Option<ShareRow>> {
    c.query_row(
        "SELECT state,pushed_hash,remote_revision FROM sync_shares WHERE campaign_id=?1 AND kind=?2 AND item_id=?3",
        params![campaign, kind_name, id],
        |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
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

/// Marks an item as shared or private. Unsharing an item already on the
/// server keeps a revocation to send at the next synchronization.
pub fn set_share(
    c: &Connection,
    campaign: &str,
    kind_name: &str,
    id: &str,
    shared: bool,
) -> AppResult<()> {
    let link = require_link(c, campaign)?;
    if link.role == "reader" {
        return Err("Readers can consult the shared campaign but not share items.".into());
    }
    let value = payload(c, campaign, kind_name, id)?.ok_or("Item not found in this campaign.")?;
    let tx = c.unchecked_transaction().map_err(storage)?;
    if shared {
        if kind_name == "relationship"
            && !endpoints_shared(&value, &page_ids_shared(&tx, campaign)?)
        {
            return Err("Share both pages of the relationship first.".into());
        }
        tx.execute(
            "INSERT INTO sync_shares(campaign_id,kind,item_id,state) VALUES(?1,?2,?3,'shared') ON CONFLICT(campaign_id,kind,item_id) DO UPDATE SET state='shared'",
            params![campaign, kind_name, id],
        )
        .map_err(storage)?;
    } else {
        unshare(&tx, campaign, kind_name, id)?;
        if kind_name == "page" {
            // A shared relationship must not point to a page that became private.
            let mut q = tx
                .prepare("SELECT item_id FROM sync_shares WHERE campaign_id=?1 AND kind='relationship' AND state='shared'")
                .map_err(storage)?;
            let rows = q
                .query_map([campaign], |r| r.get::<_, String>(0))
                .map_err(storage)?
                .collect::<rusqlite::Result<Vec<_>>>()
                .map_err(storage)?;
            drop(q);
            for relationship in rows {
                if payload(&tx, campaign, "relationship", &relationship)?.is_some_and(|v| {
                    v["fromPageId"].as_str() == Some(id) || v["toPageId"].as_str() == Some(id)
                }) {
                    unshare(&tx, campaign, "relationship", &relationship)?;
                }
            }
        }
    }
    tx.commit().map_err(storage)
}
fn unshare(c: &Connection, campaign: &str, kind_name: &str, id: &str) -> AppResult<()> {
    // Never sent: forget it. Already on the server: revoke at the next sync.
    c.execute(
        "DELETE FROM sync_shares WHERE campaign_id=?1 AND kind=?2 AND item_id=?3 AND remote_revision=0",
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

#[derive(Debug, Clone, PartialEq)]
pub enum Job {
    Put {
        kind: String,
        id: String,
        base: i64,
        payload: Value,
        hash: String,
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
        .prepare("SELECT kind,item_id,state,pushed_hash,remote_revision FROM sync_shares s WHERE campaign_id=?1 AND NOT EXISTS(SELECT 1 FROM sync_conflicts k WHERE k.campaign_id=s.campaign_id AND k.kind=s.kind AND k.item_id=s.item_id) ORDER BY kind,item_id")
        .map_err(storage)?;
    let rows = q
        .query_map([campaign], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, String>(3)?,
                r.get::<_, i64>(4)?,
            ))
        })
        .map_err(storage)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(storage)?;
    let pages = page_ids_shared(c, campaign)?;
    let (mut jobs, mut blocked) = (vec![], 0);
    for (kind_name, id, state, pushed, base) in rows {
        let current = payload(c, campaign, &kind_name, &id)?;
        match (state.as_str(), current) {
            ("shared", Some(value)) => {
                if kind_name == "relationship" && !endpoints_shared(&value, &pages) {
                    blocked += 1;
                    continue;
                }
                let h = hash(&value);
                if h != pushed || base == 0 {
                    jobs.push(Job::Put {
                        kind: kind_name,
                        id,
                        base,
                        payload: value,
                        hash: h,
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
    Ok((jobs, blocked))
}
pub fn record_put(
    c: &Connection,
    campaign: &str,
    kind_name: &str,
    id: &str,
    hash: &str,
    revision: i64,
) -> AppResult<()> {
    c.execute(
        "UPDATE sync_shares SET pushed_hash=?4,remote_revision=?5 WHERE campaign_id=?1 AND kind=?2 AND item_id=?3",
        params![campaign, kind_name, id, hash, revision],
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

/// Applies one page of server changes. Own items changed on another device
/// are applied first through the domain functions (each in its own
/// transaction); received copies, conflicts and the cursor then commit
/// together. On any error the cursor stays put and the page is read again;
/// already applied items are skipped then because their revision is recorded.
pub fn apply_changes(
    c: &Connection,
    campaign: &str,
    changes: &[api::Change],
    cursor: &str,
) -> AppResult<Report> {
    let link = require_link(c, campaign)?;
    for change in changes.iter().filter(|c| !c.deleted) {
        validate_payload(&change.kind, change.payload.as_ref().ok_or_else(invalid)?)?;
    }
    let mut report = Report::default();
    let mut later = vec![];
    for change in changes {
        let own = if change.author_id == link.account_id {
            share(c, campaign, &change.kind, &change.id)?
        } else {
            None
        };
        match (own, change.deleted) {
            (Some((_, pushed, base)), false) if change.revision > base => {
                let remote = change.payload.as_ref().ok_or_else(invalid)?;
                match payload(c, campaign, &change.kind, &change.id)? {
                    Some(local) if hash(&local) == pushed => {
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
                        )?;
                        report.updated += 1;
                    }
                    _ => later.push(change),
                }
            }
            (Some(_), false) => {}
            _ => later.push(change),
        }
    }
    let tx = c.unchecked_transaction().map_err(storage)?;
    for change in later {
        let own = if change.author_id == link.account_id {
            share(&tx, campaign, &change.kind, &change.id)?
        } else {
            None
        };
        match own {
            // Revoked from another device: stop sharing, keep the local item.
            Some(_) if change.deleted => {
                record_deleted(&tx, campaign, &change.kind, &change.id)?;
                report.removed += 1;
            }
            Some(_) => {
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
            None if change.deleted => {
                report.removed += tx
                    .execute(
                        "DELETE FROM sync_remote_items WHERE campaign_id=?1 AND kind=?2 AND item_id=?3",
                        params![campaign, change.kind, change.id],
                    )
                    .map_err(storage)?;
            }
            None => {
                let value = change.payload.as_ref().ok_or_else(invalid)?;
                tx.execute(
                    "INSERT INTO sync_remote_items(campaign_id,kind,item_id,author_id,author_name,revision,payload,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8) ON CONFLICT(campaign_id,kind,item_id) DO UPDATE SET author_id=excluded.author_id,author_name=excluded.author_name,revision=excluded.revision,payload=excluded.payload,updated_at=excluded.updated_at WHERE excluded.revision>=sync_remote_items.revision",
                    params![campaign, change.kind, change.id, change.author_id, change.author_name.trim(), change.revision, value.to_string(), change.updated_at],
                )
                .map_err(storage)?;
                report.received += 1;
            }
        }
    }
    tx.execute(
        "UPDATE sync_links SET cursor=?2 WHERE campaign_id=?1",
        params![campaign, cursor],
    )
    .map_err(storage)?;
    tx.commit().map_err(storage)?;
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
    if keep == "remote" && !remote.is_null() {
        // Domain functions run their own transactions: apply before recording.
        apply_local(c, campaign, kind_name, id, &remote)?;
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
            record_put(&tx, campaign, kind_name, id, &hash(&applied), revision)?;
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
    for table in ["sync_remote_items", "sync_conflicts"] {
        let column = if table == "sync_conflicts" {
            "remote_payload"
        } else {
            "payload"
        };
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
            if !(table == "sync_conflicts" && value.is_null()) {
                validate_payload(&kind_name, &value)?;
            }
        }
    }
    Ok(())
}

/// Pull, then push, for one campaign. Reports counts; never overwrites a
/// local change that the server did not see: those become conflicts.
pub async fn sync_now(db: &Database, client: &api::Client, campaign: String) -> AppResult<Report> {
    let id = campaign.clone();
    let link = db.run(move |c| require_link(c, &id)).await?;
    let mut report = Report::default();
    let mut cursor = link.cursor.clone();
    for _ in 0..100 {
        let page = client.changes(&link.remote_id, &cursor).await?;
        let (id, changes, next) = (campaign.clone(), page.items, page.cursor.clone());
        let pulled = db
            .run(move |c| apply_changes(c, &id, &changes, &next))
            .await?;
        report.received += pulled.received;
        report.removed += pulled.removed;
        report.updated += pulled.updated;
        report.conflicts += pulled.conflicts;
        cursor = page.cursor;
        if !page.more {
            break;
        }
    }
    let id = campaign.clone();
    let (jobs, blocked) = db.run(move |c| pending(c, &id)).await?;
    report.blocked = blocked;
    for job in jobs {
        let id = campaign.clone();
        match job {
            Job::Put {
                kind,
                id: item,
                base,
                payload,
                hash,
            } => {
                match client
                    .put_item(&link.remote_id, &kind, &item, base, &payload)
                    .await?
                {
                    api::Write::Accepted { revision } => {
                        db.run(move |c| record_put(c, &id, &kind, &item, &hash, revision))
                            .await?;
                        report.pushed += 1;
                    }
                    api::Write::Conflict { revision, payload } => {
                        db.run(move |c| {
                            record_conflict(c, &id, &kind, &item, revision, payload.as_ref())
                        })
                        .await?;
                        report.conflicts += 1;
                    }
                    // Removed on the server meanwhile: the user decides.
                    api::Write::Missing => {
                        db.run(move |c| record_conflict(c, &id, &kind, &item, base.max(1), None))
                            .await?;
                        report.conflicts += 1;
                    }
                }
            }
            Job::Delete {
                kind,
                id: item,
                base,
            } => {
                let mut outcome = client
                    .delete_item(&link.remote_id, &kind, &item, base)
                    .await?;
                // Revocation wins over a newer copy from another device:
                // the content stays on this device anyway.
                if let api::Write::Conflict { revision, .. } = outcome {
                    outcome = client
                        .delete_item(&link.remote_id, &kind, &item, revision)
                        .await?;
                }
                if matches!(outcome, api::Write::Accepted { .. } | api::Write::Missing) {
                    db.run(move |c| record_deleted(c, &id, &kind, &item))
                        .await?;
                    report.deleted += 1;
                } else {
                    report.conflicts += 1;
                }
            }
        }
    }
    let id = campaign.clone();
    db.run(move |c| {
        c.execute(
            "UPDATE sync_links SET synced_at=?2 WHERE campaign_id=?1",
            params![id, now()],
        )
        .map_err(storage)?;
        Ok(())
    })
    .await?;
    Ok(report)
}
