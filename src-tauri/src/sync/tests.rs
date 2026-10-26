//! Acceptance of the sharing and replication client against an in-process fake of the
//! server contract (docs/SYNC_API.md and the server's OpenAPI). The fake mirrors the rules
//! the real server enforces: per-item visibility, revisions with 409 conflicts, idempotent
//! request IDs, a change log read through the caller's visibility, and fail-closed cursors.
//! `live_tests.rs` runs the same client against the real server binary when it is available.
use super::{
    api::{self, Failure},
    auto, engine, server_url,
};
use crate::{backup, graph, journal, knowledge, party, Database};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    io::{Read, Write},
    net::{TcpListener, TcpStream},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::{Duration, Instant},
};

#[derive(Clone)]
struct Stored {
    author: String,
    revision: i64,
    visibility: String,
    payload: Option<Value>,
}
#[derive(Default)]
struct Campaign {
    name: String,
    members: HashMap<String, String>,
    items: HashMap<(String, String), Stored>,
    /// (seq, kind, id, author, state)
    log: Vec<(i64, String, String, String, String)>,
    seq: i64,
    floor: i64,
}
/// (operation, kind, item, request digest, accepted revision)
type Receipt = (String, String, String, String, i64);
#[derive(Default)]
struct State {
    accounts: HashMap<String, (String, String, String)>, // id -> (username, display, password)
    tokens: HashMap<String, String>,
    invites: HashMap<String, (Option<String>, String)>, // code -> (campaign, role)
    campaigns: HashMap<String, Campaign>,
    receipts: HashMap<(String, String, String), Receipt>,
    next: u64,
    requests: Vec<String>,
    /// Refuse every connection without an answer, as an unreachable server does.
    offline: bool,
    /// Apply this many writes but lose their responses.
    lose_responses: usize,
    /// Items per `/sync` page; 0 keeps the server default.
    page: usize,
    applied_writes: usize,
}
struct Fake {
    base: String,
    state: Arc<Mutex<State>>,
    stop: Arc<AtomicBool>,
}
impl Fake {
    fn start() -> Self {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        listener.set_nonblocking(true).unwrap();
        let base = format!("http://{}", listener.local_addr().unwrap());
        let state = Arc::new(Mutex::new(State::default()));
        // Server administrator invitation, as the real server would print it.
        state
            .lock()
            .unwrap()
            .invites
            .insert("ADMIN-INVITE".into(), (None, "owner".into()));
        let stop = Arc::new(AtomicBool::new(false));
        let (s, st) = (Arc::clone(&state), Arc::clone(&stop));
        std::thread::spawn(move || {
            while !st.load(Ordering::Relaxed) {
                match listener.accept() {
                    Ok((stream, _)) => {
                        let s = Arc::clone(&s);
                        std::thread::spawn(move || handle(stream, &s));
                    }
                    Err(_) => std::thread::sleep(Duration::from_millis(2)),
                }
            }
        });
        Self { base, state, stop }
    }
    fn invite(&self, code: &str) {
        self.state
            .lock()
            .unwrap()
            .invites
            .insert(code.into(), (None, "owner".into()));
    }
    fn set(&self, change: impl FnOnce(&mut State)) {
        change(&mut self.state.lock().unwrap());
    }
    /// Any live (not deleted) copy of the item, whatever its visibility.
    fn stored(&self, id: &str) -> bool {
        self.state.lock().unwrap().campaigns.values().any(|c| {
            c.items
                .iter()
                .any(|((_, i), v)| i == id && v.payload.is_some())
        })
    }
    fn visibility(&self, id: &str) -> Option<String> {
        self.state.lock().unwrap().campaigns.values().find_map(|c| {
            c.items
                .iter()
                .find(|((_, i), v)| i == id && v.payload.is_some())
                .map(|(_, v)| v.visibility.clone())
        })
    }
    fn revision(&self, id: &str) -> Option<i64> {
        self.state.lock().unwrap().campaigns.values().find_map(|c| {
            c.items
                .iter()
                .find(|((_, i), _)| i == id)
                .map(|(_, v)| v.revision)
        })
    }
    fn applied_writes(&self) -> usize {
        self.state.lock().unwrap().applied_writes
    }
}
impl Drop for Fake {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::Relaxed);
    }
}
fn handle(mut stream: TcpStream, state: &Arc<Mutex<State>>) {
    stream.set_nonblocking(false).unwrap();
    stream
        .set_read_timeout(Some(Duration::from_secs(5)))
        .unwrap();
    let mut head = vec![];
    let mut byte = [0];
    while !head.ends_with(b"\r\n\r\n") && stream.read_exact(&mut byte).is_ok() {
        head.push(byte[0]);
    }
    let head = String::from_utf8_lossy(&head).to_string();
    let mut lines = head.lines();
    let mut first = lines.next().unwrap_or("").split(' ');
    let (method, target) = (
        first.next().unwrap_or("").to_string(),
        first.next().unwrap_or("").to_string(),
    );
    let mut length = 0;
    let mut token = None;
    for line in lines {
        let lower = line.to_lowercase();
        if let Some(v) = lower.strip_prefix("content-length:") {
            length = v.trim().parse().unwrap_or(0);
        }
        if lower.starts_with("authorization: bearer ") {
            token = Some(line["authorization: bearer ".len()..].trim().to_string());
        }
    }
    let mut body = vec![0; length];
    let _ = stream.read_exact(&mut body);
    let body: Value = serde_json::from_slice(&body).unwrap_or(Value::Null);
    let answer = route(&mut state.lock().unwrap(), &method, &target, token, body);
    // No answer: the connection just closes, like a dead or unreachable server.
    let Some((status, reply)) = answer else {
        return;
    };
    let text = reply.to_string();
    let _ = write!(stream, "HTTP/1.1 {status} X\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{text}", text.len());
}
fn log_change(c: &mut Campaign, kind: &str, id: &str, author: &str, state: &str) {
    c.seq += 1;
    let seq = c.seq;
    c.log
        .push((seq, kind.into(), id.into(), author.into(), state.into()));
}
/// Current state of an item as `me` may see it.
fn visible(s: &State, campaign: &str, me: &str, kind: &str, id: &str) -> Option<Value> {
    let c = &s.campaigns[campaign];
    let item = c.items.get(&(kind.to_string(), id.to_string()))?;
    let own = item.author == me;
    let live = item.payload.is_some() && (own || item.visibility == "members");
    Some(json!({
        "kind": kind, "id": id, "authorId": item.author, "authorName": s.accounts[&item.author].1,
        "revision": item.revision, "deleted": !live,
        "payload": if live { item.payload.clone() } else { None },
        "updatedAt": "2026-10-26T12:00:00Z",
        "visibility": if own { item.visibility.clone() } else { "members".into() },
    }))
}
fn route(
    s: &mut State,
    method: &str,
    target: &str,
    token: Option<String>,
    body: Value,
) -> Option<(u16, Value)> {
    if s.offline {
        return None;
    }
    s.requests.push(format!("{method} {target} {body}"));
    let (path, query) = target.split_once('?').unwrap_or((target, ""));
    let param = |name: &str| {
        query
            .split('&')
            .find_map(|p| p.strip_prefix(&format!("{name}=")).map(String::from))
            .unwrap_or_default()
    };
    let parts: Vec<&str> = path.trim_start_matches('/').split('/').collect();
    let me = token.as_ref().and_then(|t| s.tokens.get(t).cloned());
    let issue = |s: &mut State, account: String| {
        s.next += 1;
        let token = format!("token-{:032}", s.next);
        s.tokens.insert(token.clone(), account.clone());
        let (username, display, _) = s.accounts[&account].clone();
        (
            200,
            json!({"token":token,"accountId":account,"username":username,"displayName":display}),
        )
    };
    Some(match (method, parts.as_slice()) {
        ("GET", ["api", "v1", "meta"]) => (
            200,
            json!({"api":"chronexus-sync","version":1,"serverVersion":"fake","capabilities":["accounts","sessions","campaigns","sharing","private-content","attachments","idempotent-content-saves","idempotent-mutations","incremental-sync","change-notifications"]}),
        ),
        ("POST", ["api", "v1", "auth", "redeem"]) => {
            let code = body["inviteCode"].as_str().unwrap_or("").to_string();
            let Some((campaign, role)) = s.invites.remove(&code) else {
                return Some((410, json!({})));
            };
            s.next += 1;
            let id = format!("acc-{}", s.next);
            s.accounts.insert(
                id.clone(),
                (
                    body["username"].as_str().unwrap().into(),
                    body["displayName"].as_str().unwrap().into(),
                    body["password"].as_str().unwrap().into(),
                ),
            );
            if let Some(c) = campaign {
                s.campaigns
                    .get_mut(&c)
                    .unwrap()
                    .members
                    .insert(id.clone(), role);
            }
            issue(s, id)
        }
        ("POST", ["api", "v1", "auth", "login"]) => {
            let found = s
                .accounts
                .iter()
                .find(|(_, (u, _, p))| {
                    Some(u.as_str()) == body["username"].as_str()
                        && Some(p.as_str()) == body["password"].as_str()
                })
                .map(|(id, _)| id.clone());
            match found {
                Some(id) => issue(s, id),
                None => (401, json!({})),
            }
        }
        _ if me.is_none() => (401, json!({})),
        ("POST", ["api", "v1", "auth", "logout"]) => {
            s.tokens.remove(token.as_ref().unwrap());
            (204, Value::Null)
        }
        ("POST", ["api", "v1", "campaigns"]) => {
            s.next += 1;
            let id = format!("camp-{}", s.next);
            s.campaigns.insert(
                id.clone(),
                Campaign {
                    name: body["name"].as_str().unwrap().into(),
                    members: HashMap::from([(me.unwrap(), "owner".to_string())]),
                    ..Campaign::default()
                },
            );
            (201, json!({"id":id,"name":body["name"],"role":"owner"}))
        }
        ("GET", ["api", "v1", "campaigns"]) => {
            let me = me.unwrap();
            let mut list: Vec<_> = s
                .campaigns
                .iter()
                .filter_map(|(id, c)| {
                    c.members
                        .get(&me)
                        .map(|role| json!({"id":id,"name":c.name,"role":role}))
                })
                .collect();
            list.sort_by_key(|v| v["id"].as_str().unwrap().to_string());
            (200, Value::Array(list))
        }
        ("POST", ["api", "v1", "campaigns", "join"]) => {
            let code = body["inviteCode"].as_str().unwrap_or("").to_string();
            match s.invites.get(&code).cloned() {
                Some((Some(c), role)) => {
                    s.invites.remove(&code);
                    let entry = s.campaigns.get_mut(&c).unwrap();
                    entry.members.insert(me.unwrap(), role.clone());
                    (200, json!({"id":c,"name":entry.name,"role":role}))
                }
                _ => (410, json!({})),
            }
        }
        (_, ["api", "v1", "campaigns", campaign, rest @ ..]) => {
            let campaign = campaign.to_string();
            let me = me.unwrap();
            let Some(role) = s
                .campaigns
                .get(&campaign)
                .and_then(|c| c.members.get(&me))
                .cloned()
            else {
                return Some((403, json!({})));
            };
            match (method, rest) {
                ("POST", ["invites"]) if role == "owner" => {
                    s.next += 1;
                    let code = format!("JOIN-{}", s.next);
                    s.invites.insert(
                        code.clone(),
                        (Some(campaign), body["role"].as_str().unwrap().into()),
                    );
                    (
                        201,
                        json!({"code":code,"role":body["role"],"expiresAt":"2026-11-02T00:00:00Z"}),
                    )
                }
                ("GET", ["sync"]) => {
                    let cursor = if param("cursor").is_empty() {
                        0
                    } else {
                        param("cursor").parse::<i64>().unwrap_or(-1)
                    };
                    let (head, floor) = {
                        let c = &s.campaigns[&campaign];
                        (c.seq, c.floor)
                    };
                    if cursor < floor || cursor > head {
                        return Some((410, json!({"error":"cursor"})));
                    }
                    let limit = if s.page == 0 { 500 } else { s.page };
                    let rows: Vec<_> = s.campaigns[&campaign]
                        .log
                        .iter()
                        .filter(|(seq, _, _, author, state)| {
                            *seq > cursor
                                && (author == &me
                                    || ["members", "deleted", "withdrawn"]
                                        .contains(&state.as_str()))
                        })
                        .cloned()
                        .collect();
                    let mut items = vec![];
                    let mut seen = std::collections::HashSet::new();
                    let (mut next, mut more) = (cursor, false);
                    for (index, (seq, kind, id, _, _)) in rows.iter().enumerate() {
                        if index >= limit {
                            more = true;
                            break;
                        }
                        if seen.insert((kind.clone(), id.clone())) {
                            if let Some(v) = visible(s, &campaign, &me, kind, id) {
                                items.push(v);
                            }
                        }
                        next = *seq;
                    }
                    if !more {
                        next = head;
                    }
                    (
                        200,
                        json!({"items":items,"cursor":next.to_string(),"more":more}),
                    )
                }
                ("GET", ["content"]) => {
                    let after = param("after");
                    let c = &s.campaigns[&campaign];
                    let mut keys: Vec<_> = c
                        .items
                        .iter()
                        .filter(|((k, i), v)| {
                            v.payload.is_some()
                                && (v.author == me || v.visibility == "members")
                                && format!("{k}:{i}") > after
                        })
                        .map(|((k, i), _)| (k.clone(), i.clone()))
                        .collect();
                    keys.sort();
                    let more = keys.len() > 50;
                    keys.truncate(50);
                    let cursor = keys
                        .last()
                        .map(|(k, i)| format!("{k}:{i}"))
                        .unwrap_or(after);
                    let items: Vec<Value> = keys
                        .iter()
                        .filter_map(|(k, i)| visible(s, &campaign, &me, k, i))
                        .collect();
                    (
                        200,
                        json!({"items":items,"cursor":cursor,"more":more,"head":s.campaigns[&campaign].seq.to_string()}),
                    )
                }
                (_, ["content", kind, id]) if role != "reader" => {
                    let key = (kind.to_string(), id.to_string());
                    let request = if method == "PUT" {
                        body["requestId"].as_str().map(String::from)
                    } else {
                        Some(param("requestId")).filter(|r| !r.is_empty())
                    };
                    let base = if method == "PUT" {
                        body["baseRevision"].as_i64().unwrap()
                    } else {
                        param("baseRevision").parse().unwrap()
                    };
                    let visibility = body["visibility"].as_str().unwrap_or("private").to_string();
                    let digest = format!(
                        "{method}:{kind}:{id}:{base}:{visibility}:{}",
                        body["payload"]
                    );
                    if let Some(request) = &request {
                        if let Some((op, k, i, d, revision)) = s
                            .receipts
                            .get(&(campaign.clone(), me.clone(), request.clone()))
                            .cloned()
                        {
                            return Some(
                                if op == method && k == *kind && i == *id && d == digest {
                                    (200, json!({"revision":revision}))
                                } else {
                                    (
                                        409,
                                        json!({"error":"Request ID already used for a different save."}),
                                    )
                                },
                            );
                        }
                    }
                    let current = s.campaigns[&campaign].items.get(&key).cloned();
                    if current.as_ref().is_some_and(|c| c.author != me) {
                        return Some((403, json!({})));
                    }
                    let live = current.as_ref().filter(|c| c.payload.is_some());
                    let outcome = match (method, live) {
                        ("DELETE", None) => (404, json!({})),
                        ("PUT", None) if base > 0 && current.is_none() => (404, json!({})),
                        (_, Some(c)) if c.revision != base => {
                            (409, json!({"revision":c.revision,"payload":c.payload}))
                        }
                        _ => {
                            // Pages a relationship or member refers to must exist and be visible enough.
                            if method == "PUT" {
                                for key in ["fromPageId", "toPageId", "pageId"] {
                                    if let Some(page) = body["payload"][key].as_str() {
                                        let ok = s.campaigns[&campaign]
                                            .items
                                            .get(&("page".into(), page.into()))
                                            .filter(|p| p.payload.is_some() && p.author == me)
                                            .is_some_and(|p| {
                                                visibility != "members" || p.visibility == "members"
                                            });
                                        if !ok && *kind != "page" {
                                            return Some((400, json!({"error":"pages"})));
                                        }
                                    }
                                }
                            }
                            let revision = current.as_ref().map_or(1, |c| c.revision + 1);
                            let was_public = live.is_some_and(|c| c.visibility == "members");
                            let (state, payload, stored_visibility) = if method == "PUT" {
                                let state = match (visibility.as_str(), was_public) {
                                    ("members", _) => "members",
                                    (_, true) => "withdrawn",
                                    _ => "private",
                                };
                                (state, Some(body["payload"].clone()), visibility.clone())
                            } else {
                                (
                                    if was_public {
                                        "deleted"
                                    } else {
                                        "deleted-private"
                                    },
                                    None,
                                    "private".into(),
                                )
                            };
                            let c = s.campaigns.get_mut(&campaign).unwrap();
                            c.items.insert(
                                key,
                                Stored {
                                    author: me.clone(),
                                    revision,
                                    visibility: stored_visibility,
                                    payload,
                                },
                            );
                            log_change(c, kind, id, &me, state);
                            if let Some(request) = request {
                                s.receipts.insert(
                                    (campaign.clone(), me.clone(), request),
                                    (
                                        method.into(),
                                        kind.to_string(),
                                        id.to_string(),
                                        digest,
                                        revision,
                                    ),
                                );
                            }
                            s.applied_writes += 1;
                            if s.lose_responses > 0 {
                                s.lose_responses -= 1;
                                return None;
                            }
                            (200, json!({"revision":revision}))
                        }
                    };
                    outcome
                }
                _ => (403, json!({})),
            }
        }
        _ => (404, json!({})),
    })
}

struct Device {
    _dir: tempfile::TempDir,
    db: Database,
    campaign: String,
    client: Option<api::Client>,
    account: String,
}
impl Device {
    fn new(name: &str) -> Self {
        let dir = tempfile::tempdir().unwrap();
        let store = backup::Store::open(dir.path()).unwrap();
        let campaign = journal::create_campaign(&store.connection, name)
            .unwrap()
            .id;
        Self {
            db: Database::new(Ok(Arc::new(Mutex::new(store)))),
            _dir: dir,
            campaign,
            client: None,
            account: String::new(),
        }
    }
    async fn sign(&mut self, base: &str, code: Option<&str>, user: &str) -> String {
        let anonymous = api::Client::new(server_url(base, true).unwrap(), None, true).unwrap();
        anonymous.meta().await.unwrap();
        let signed = match code {
            Some(code) => anonymous
                .redeem(
                    code,
                    user,
                    &user.to_uppercase(),
                    "correct horse battery",
                    "test",
                )
                .await
                .unwrap(),
            None => anonymous
                .login(user, "correct horse battery", "test")
                .await
                .unwrap(),
        };
        self.client = Some(
            api::Client::new(server_url(base, true).unwrap(), Some(signed.token), true).unwrap(),
        );
        self.account = signed.account_id.clone();
        signed.account_id
    }
    fn client(&self) -> &api::Client {
        self.client.as_ref().unwrap()
    }
    fn with<T>(&self, f: impl FnOnce(&rusqlite::Connection) -> T) -> T {
        self.db.with(|c| Ok(f(c))).unwrap()
    }
    fn link(&self, base: &str, account: &str, remote: &api::RemoteCampaign) {
        let link = engine::Link {
            campaign_id: self.campaign.clone(),
            server: server_url(base, true)
                .unwrap()
                .origin()
                .ascii_serialization(),
            remote_id: remote.id.clone(),
            account_id: account.into(),
            role: remote.role.clone(),
            cursor: String::new(),
            synced_at: None,
            auto: false,
            paused: false,
            last_error: None,
        };
        self.with(|c| engine::save_link(c, &link)).unwrap();
    }
    async fn sync(&self) -> engine::Report {
        engine::sync_now(&self.db, self.client(), self.campaign.clone())
            .await
            .unwrap()
    }
    async fn try_sync(&self) -> Result<engine::Report, Failure> {
        engine::sync_now(&self.db, self.client(), self.campaign.clone()).await
    }
    fn scope(&self, kind: &str, id: &str, scope: &str) -> crate::journal::AppResult<()> {
        self.with(|c| engine::set_scope(c, &self.campaign, kind, id, scope))
    }
    fn remote(&self) -> Vec<engine::RemoteItem> {
        self.with(|c| engine::remote_items(c, &self.campaign))
            .unwrap()
    }
    fn page(&self, name: &str, kind: &str) -> String {
        self.with(|c| {
            knowledge::create_page(c, &self.campaign, name, kind, "active", &[])
                .unwrap()
                .id
        })
    }
    fn edit(&self, page: &str, text: &str) {
        self.with(|c| {
            let p = knowledge::get_page(c, &self.campaign, page).unwrap();
            knowledge::save_page_document(c, &self.campaign, page, p.revision, doc(text)).unwrap();
        });
    }
    fn text_of(&self, page: &str) -> String {
        self.with(|c| knowledge::get_page(c, &self.campaign, page))
            .unwrap()
            .document
            .to_string()
    }
}
fn doc(text: &str) -> Value {
    json!({"version":1,"blocks":[{"id":"b1","type":"paragraph","props":{},"content":[{"type":"text","text":text,"styles":{}}],"children":[]}]})
}
fn relationship(from: &str, to: &str, label: &str) -> graph::RelationshipInput {
    graph::RelationshipInput {
        from_page_id: from.into(),
        to_page_id: to.into(),
        label: label.into(),
        certainty: "suspected".into(),
        source_kind: None,
        source_id: None,
        source_block_id: None,
        evidence: String::new(),
        notes: String::new(),
    }
}
/// A second computer of the same account: signs in and downloads the campaign.
async fn second_device(base: &str, user: &str, remote: &api::RemoteCampaign) -> Device {
    let mut device = Device::new("Placeholder");
    let account = device.sign(base, None, user).await;
    let server = server_url(base, true)
        .unwrap()
        .origin()
        .ascii_serialization();
    let listed = device.client().campaigns().await.unwrap();
    let found = listed.iter().find(|r| r.id == remote.id).unwrap().clone();
    device.campaign = device
        .with(|c| engine::attach_campaign(c, &server, &account, &found))
        .unwrap()
        .id;
    device
}

#[tokio::test]
async fn three_members_share_selectively_update_revoke_and_stay_attributed() {
    let fake = Fake::start();
    let mut alice = Device::new("Alice's campaign");
    let alice_id = alice.sign(&fake.base, Some("ADMIN-INVITE"), "alice").await;
    let remote = alice.client().create_campaign("Shared").await.unwrap();
    alice.link(&fake.base, &alice_id, &remote);
    let (public, private, session) = alice.with(|c| {
        let p = knowledge::create_page(c, &alice.campaign, "Neral", "npc", "active", &[]).unwrap();
        let q = knowledge::create_page(c, &alice.campaign, "Secret plan", "note", "active", &[])
            .unwrap();
        let s = journal::create_session(c, &alice.campaign, 1, "Arrival", None).unwrap();
        knowledge::save_page_document(
            c,
            &alice.campaign,
            &p.id,
            0,
            doc("Neral says he guards the bridge."),
        )
        .unwrap();
        (p.id, q.id, s.id)
    });
    // Default private: nothing is replicated until chosen.
    assert!(alice
        .with(|c| engine::items(c, &alice.campaign))
        .unwrap()
        .iter()
        .all(|i| i.status == "private" && i.scope == "none"));
    alice.scope("page", &public, "shared").unwrap();
    alice.scope("session", &session, "shared").unwrap();
    assert_eq!(alice.sync().await.pushed, 2);
    assert!(
        fake.stored(&public) && !fake.stored(&private),
        "unchosen items never reach the server"
    );
    // A privately replicated item reaches the server but not the members.
    alice.scope("page", &private, "private").unwrap();
    assert_eq!(alice.sync().await.pushed, 1);
    assert_eq!(fake.visibility(&private).as_deref(), Some("private"));

    let bob_invite = alice.client().invite(&remote.id, "player").await.unwrap();
    let carol_invite = alice.client().invite(&remote.id, "reader").await.unwrap();
    let mut bob = Device::new("Bob's campaign");
    fake.invite("BOB-ACCOUNT");
    let bob_id = bob.sign(&fake.base, Some("BOB-ACCOUNT"), "bob").await;
    let joined = bob.client().join(&bob_invite.code).await.unwrap();
    assert_eq!(joined.role, "player");
    bob.link(&fake.base, &bob_id, &joined);
    assert_eq!(bob.sync().await.received, 2, "only the shared items");
    let seen = bob.remote();
    assert!(seen.iter().all(|i| i.author_name == "ALICE" && !i.mine));
    assert!(seen.iter().all(|i| i.item_id != private));
    // Received copies are attributed and never become Bob's Codex pages.
    assert!(bob
        .with(|c| knowledge::list_pages(c, &bob.campaign))
        .unwrap()
        .is_empty());

    // A reader consults but cannot share.
    let mut carol = Device::new("Carol's campaign");
    fake.invite("CAROL-ACCOUNT");
    let carol_id = carol.sign(&fake.base, Some("CAROL-ACCOUNT"), "carol").await;
    let as_reader = carol.client().join(&carol_invite.code).await.unwrap();
    carol.link(&fake.base, &carol_id, &as_reader);
    let own = carol.page("Mine", "note");
    assert!(carol
        .scope("page", &own, "shared")
        .unwrap_err()
        .contains("Readers"));
    assert_eq!(carol.sync().await.received, 2);

    // Bob shares his own claim; Alice sees it attributed to Bob.
    let claim = bob.page("Bridge rumour", "lore");
    bob.scope("page", &claim, "shared").unwrap();
    assert_eq!(bob.sync().await.pushed, 1);
    assert_eq!(alice.sync().await.received, 1);
    assert!(alice
        .remote()
        .iter()
        .any(|i| i.item_id == claim && i.author_name == "BOB"));

    // An update reaches the others; making an item private withdraws it at their next sync.
    alice.edit(&public, "Neral left the bridge.");
    assert_eq!(alice.sync().await.pushed, 1);
    bob.sync().await;
    let updated = bob
        .remote()
        .into_iter()
        .find(|i| i.item_id == public)
        .unwrap();
    assert_eq!(updated.revision, 2);
    assert!(updated.payload.to_string().contains("left the bridge"));
    alice.scope("session", &session, "private").unwrap();
    assert_eq!(alice.sync().await.pushed, 1);
    assert_eq!(bob.sync().await.removed, 1);
    assert!(bob.remote().iter().all(|i| i.item_id != session));
    // Removing it from the server entirely is a separate choice; the local item stays.
    alice.scope("session", &session, "none").unwrap();
    assert_eq!(alice.sync().await.deleted, 1);
    assert!(!fake.stored(&session));
    assert!(alice
        .with(|c| journal::get_session(c, &alice.campaign, &session))
        .is_ok());
}

#[tokio::test]
async fn private_replicas_reach_the_second_device_complete_and_stay_hidden_from_members() {
    let fake = Fake::start();
    let mut laptop = Device::new("Campaign");
    let account = laptop.sign(&fake.base, Some("ADMIN-INVITE"), "dana").await;
    let remote = laptop.client().create_campaign("Campaign").await.unwrap();
    laptop.link(&fake.base, &account, &remote);
    let (tower, keep) = (laptop.page("Tower", "place"), laptop.page("Keep", "place"));
    let hero = laptop.page("Hero", "npc");
    laptop.edit(&tower, "Stands over the keep.");
    let rel = laptop.with(|c| {
        graph::save_relationship(
            c,
            &laptop.campaign,
            None,
            None,
            relationship(&tower, &keep, "overlooks"),
        )
        .unwrap()
        .id
    });
    let session = laptop.with(|c| {
        let s = journal::create_session(
            c,
            &laptop.campaign,
            3,
            "The bridge",
            Some("2026-10-01".into()),
        )
        .unwrap();
        journal::save_document(c, &laptop.campaign, &s.id, s.revision, doc("They crossed."))
            .unwrap();
        s.id
    });
    laptop.with(|c| {
        party::save(
            c,
            &laptop.campaign,
            &party::MemberInput {
                page_id: Some(hero.clone()),
                name: "Hero".into(),
                player_name: "Dana".into(),
                role: "Rogue".into(),
                status: "active".into(),
                revision: None,
            },
        )
        .unwrap();
    });
    // A relationship cannot go before its pages; the bulk action keeps dependency order.
    assert!(laptop.scope("relationship", &rel, "private").is_err());
    let chosen = laptop
        .with(|c| engine::replicate_all_privately(c, &laptop.campaign))
        .unwrap();
    assert_eq!(chosen, 6);
    assert_eq!(laptop.sync().await.pushed, 6);
    for id in [&tower, &keep, &hero, &rel, &session] {
        assert_eq!(fake.visibility(id).as_deref(), Some("private"));
    }

    // A member of the campaign sees none of it.
    let invite = laptop.client().invite(&remote.id, "player").await.unwrap();
    let mut guest = Device::new("Guest");
    fake.invite("GUEST");
    let guest_id = guest.sign(&fake.base, Some("GUEST"), "gus").await;
    let joined = guest.client().join(&invite.code).await.unwrap();
    guest.link(&fake.base, &guest_id, &joined);
    assert_eq!(guest.sync().await, engine::Report::default());
    assert!(guest.remote().is_empty());

    // The second computer of the same account downloads complete, editable copies.
    let desktop = second_device(&fake.base, "dana", &remote).await;
    let report = desktop.sync().await;
    assert_eq!(report.materialized, 6, "{report:?}");
    assert_eq!(desktop.text_of(&tower), laptop.text_of(&tower));
    assert!(desktop
        .with(|c| graph::get_relationship(c, &desktop.campaign, &rel))
        .is_ok());
    assert_eq!(
        desktop
            .with(|c| journal::get_session(c, &desktop.campaign, &session))
            .unwrap()
            .sequence,
        3
    );
    assert_eq!(
        desktop.with(|c| party::list(c, &desktop.campaign)).unwrap()[0].player_name,
        "Dana"
    );
    assert!(
        desktop.remote().is_empty(),
        "own items are real items, not received copies"
    );
    // Nothing is pending after a download and a second pass changes nothing.
    assert_eq!(
        desktop
            .with(|c| engine::counts(c, &desktop.campaign))
            .unwrap(),
        engine::Counts::default()
    );
    assert_eq!(desktop.sync().await, engine::Report::default());

    // Edits flow both ways without conflicts when the devices alternate.
    desktop.edit(&tower, "Rebuilt by the desktop.");
    assert_eq!(desktop.sync().await.pushed, 1);
    assert_eq!(laptop.sync().await.updated, 1);
    assert!(laptop.text_of(&tower).contains("Rebuilt by the desktop"));
}

#[tokio::test]
async fn items_wait_for_their_pages_that_arrive_later_instead_of_being_lost() {
    let fake = Fake::start();
    let mut laptop = Device::new("Ordering");
    let account = laptop.sign(&fake.base, Some("ADMIN-INVITE"), "ivy").await;
    let remote = laptop.client().create_campaign("Ordering").await.unwrap();
    laptop.link(&fake.base, &account, &remote);
    let (a, b) = (laptop.page("Alpha", "place"), laptop.page("Beta", "place"));
    let rel = laptop.with(|c| {
        graph::save_relationship(
            c,
            &laptop.campaign,
            None,
            None,
            relationship(&a, &b, "near"),
        )
        .unwrap()
        .id
    });
    laptop
        .with(|c| engine::replicate_all_privately(c, &laptop.campaign))
        .unwrap();
    laptop.sync().await;
    // Tiny pages force the relationship to be read before one of its pages.
    fake.set(|s| s.page = 1);
    laptop.edit(&b, "Beta changed, so it is last in the log.");
    laptop.sync().await;
    let desktop = second_device(&fake.base, "ivy", &remote).await;
    let mut created = 0;
    for _ in 0..6 {
        created += desktop.sync().await.materialized;
    }
    assert_eq!(created, 3);
    assert!(desktop
        .with(|c| graph::get_relationship(c, &desktop.campaign, &rel))
        .is_ok());
    assert!(desktop.remote().is_empty());
}

#[tokio::test]
async fn concurrent_edits_on_two_devices_become_a_conflict_the_user_resolves() {
    let fake = Fake::start();
    let mut first = Device::new("Two devices");
    let account = first.sign(&fake.base, Some("ADMIN-INVITE"), "dana").await;
    let remote = first.client().create_campaign("Two devices").await.unwrap();
    first.link(&fake.base, &account, &remote);
    let page = first.page("Oran", "npc");
    first.scope("page", &page, "private").unwrap();
    first.sync().await;
    let second = second_device(&fake.base, "dana", &remote).await;
    assert_eq!(second.sync().await.materialized, 1);

    second.edit(&page, "Edited on the laptop.");
    assert_eq!(second.sync().await.pushed, 1);
    first.edit(&page, "Edited on the desktop, offline.");
    let report = first.sync().await;
    assert_eq!((report.conflicts, report.pushed), (1, 0));
    let conflicts = first
        .with(|c| engine::conflicts(c, &first.campaign))
        .unwrap();
    assert!(conflicts[0]
        .local
        .as_ref()
        .unwrap()
        .to_string()
        .contains("desktop"));
    assert!(conflicts[0].remote.to_string().contains("laptop"));
    // Nothing was overwritten while the conflict is open.
    assert!(first.text_of(&page).contains("desktop"));
    first
        .with(|c| engine::resolve(c, &first.campaign, "page", &page, "local"))
        .unwrap();
    assert_eq!(first.sync().await.pushed, 1);
    // The other device had no local change: it takes the chosen version.
    assert_eq!(second.sync().await.updated, 1);
    assert!(second.text_of(&page).contains("desktop"));
    // Keeping the remote version applies it through the normal save path.
    first.edit(&page, "Desktop again.");
    second.edit(&page, "Laptop again.");
    second.sync().await;
    assert_eq!(first.sync().await.conflicts, 1);
    first
        .with(|c| engine::resolve(c, &first.campaign, "page", &page, "remote"))
        .unwrap();
    assert!(first.text_of(&page).contains("Laptop again"));
    assert_eq!(first.sync().await, engine::Report::default());
}

#[tokio::test]
async fn a_lost_response_is_retried_under_the_same_operation_and_applied_once() {
    let fake = Fake::start();
    let mut device = Device::new("Lost answers");
    let account = device.sign(&fake.base, Some("ADMIN-INVITE"), "kim").await;
    let remote = device
        .client()
        .create_campaign("Lost answers")
        .await
        .unwrap();
    device.link(&fake.base, &account, &remote);
    let page = device.page("Ledger", "note");
    device.edit(&page, "First line.");
    device.scope("page", &page, "private").unwrap();

    // The server applies the write but the answer never arrives.
    fake.set(|s| s.lose_responses = 1);
    let error = device.try_sync().await.unwrap_err();
    assert!(error.transient(), "{error:?}");
    assert_eq!(fake.applied_writes(), 1);
    let waiting = device
        .with(|c| engine::outbox(c, &device.campaign))
        .unwrap();
    assert_eq!(
        waiting.len(),
        1,
        "the operation stays stored under its request ID"
    );
    let counts = device
        .with(|c| engine::counts(c, &device.campaign))
        .unwrap();
    assert_eq!((counts.pending, counts.in_flight), (0, 1));

    // The user keeps typing while the server is silent.
    device.edit(&page, "Second line, typed afterwards.");
    let report = device.sync().await;
    // The retry is acknowledged by the receipt (not applied twice), then the new text follows.
    assert_eq!(fake.applied_writes(), 2, "one apply per distinct operation");
    assert_eq!((report.pushed, report.conflicts), (2, 0));
    assert_eq!(fake.revision(&page), Some(2));
    assert!(device
        .with(|c| engine::outbox(c, &device.campaign))
        .unwrap()
        .is_empty());
    assert_eq!(device.sync().await, engine::Report::default());
}

#[tokio::test]
async fn an_expired_cursor_resynchronizes_without_losing_or_resurrecting_anything() {
    let fake = Fake::start();
    let mut laptop = Device::new("Expiry");
    let account = laptop.sign(&fake.base, Some("ADMIN-INVITE"), "lee").await;
    let remote = laptop.client().create_campaign("Expiry").await.unwrap();
    laptop.link(&fake.base, &account, &remote);
    let (keep, drop_me) = (
        laptop.page("Keeper", "note"),
        laptop.page("Dropped", "note"),
    );
    laptop.scope("page", &keep, "shared").unwrap();
    laptop.scope("page", &drop_me, "shared").unwrap();
    laptop.sync().await;
    let invite = laptop.client().invite(&remote.id, "player").await.unwrap();
    let mut member = Device::new("Member");
    fake.invite("MEMBER");
    let member_id = member.sign(&fake.base, Some("MEMBER"), "max").await;
    let joined = member.client().join(&invite.code).await.unwrap();
    member.link(&fake.base, &member_id, &joined);
    assert_eq!(member.sync().await.received, 2);

    // While the member is away the owner stops sharing one page and the server drops its history.
    laptop.scope("page", &drop_me, "none").unwrap();
    laptop.edit(&keep, "Updated while away.");
    laptop.sync().await;
    fake.set(|s| {
        for c in s.campaigns.values_mut() {
            c.floor = c.seq;
            c.log.clear();
        }
    });
    let report = member.sync().await;
    assert!(report.resynchronized);
    let held = member.remote();
    assert_eq!(held.len(), 1);
    assert!(held[0].payload.to_string().contains("Updated while away"));
    assert!(
        held.iter().all(|i| i.item_id != drop_me),
        "a revoked item is never resurrected"
    );
    // The device resumes from the server's head and reads nothing twice.
    assert_eq!(member.sync().await, engine::Report::default());

    // A cursor from the future (server restored from an older backup) also forces a listing.
    fake.set(|s| {
        for c in s.campaigns.values_mut() {
            c.seq -= 1;
            c.floor = c.floor.min(c.seq);
        }
    });
    assert!(member.sync().await.resynchronized);
}

#[tokio::test]
async fn offline_work_realigns_and_hostile_server_data_is_rejected_atomically() {
    let fake = Fake::start();
    let mut device = Device::new("Offline");
    let account = device.sign(&fake.base, Some("ADMIN-INVITE"), "erin").await;
    let remote = device.client().create_campaign("Offline").await.unwrap();
    device.link(&fake.base, &account, &remote);
    let (a, b) = (device.page("Tower", "place"), device.page("Keep", "place"));
    let relation = device.with(|c| {
        graph::save_relationship(
            c,
            &device.campaign,
            None,
            None,
            relationship(&a, &b, "overlooks"),
        )
        .unwrap()
        .id
    });
    assert!(device.scope("relationship", &relation, "shared").is_err());
    device.scope("page", &a, "shared").unwrap();
    device.scope("page", &b, "shared").unwrap();
    device.scope("relationship", &relation, "shared").unwrap();
    // Server unreachable: the error is explicit, local choices stay pending, nothing is lost.
    let offline = api::Client::new(
        server_url(&crate::test_support::closed_port(), true).unwrap(),
        None,
        true,
    )
    .unwrap();
    let down = engine::sync_now(&device.db, &offline, device.campaign.clone()).await;
    assert!(down.unwrap_err().transient());
    assert!(device
        .with(|c| engine::items(c, &device.campaign))
        .unwrap()
        .iter()
        .filter(|i| i.shared)
        .all(|i| i.status == "new"));
    assert_eq!(device.sync().await.pushed, 3);
    // Making a page private also takes the relationship that depends on it out of the members' sight.
    device.scope("page", &b, "private").unwrap();
    let report = device.sync().await;
    assert_eq!(report.pushed, 2);
    assert_eq!(fake.visibility(&relation).as_deref(), Some("private"));
    // Stopping replication of the page also stops its relationship; both are removed remotely.
    device.scope("page", &b, "none").unwrap();
    let report = device.sync().await;
    assert_eq!(report.deleted, 2);
    assert!(!fake.stored(&relation));

    let link = device
        .with(|c| engine::link(c, &device.campaign))
        .unwrap()
        .unwrap();
    let hostile = vec![api::Change {
        kind: "page".into(),
        id: uuid::Uuid::new_v4().to_string(),
        author_id: "intruder".into(),
        author_name: "X".into(),
        revision: 1,
        deleted: false,
        payload: Some(
            json!({"title":"T","kind":"npc","status":"active","aliases":[],"document":doc("x"),"script":"run()"}),
        ),
        updated_at: "2026-10-26T00:00:00Z".into(),
        visibility: Some("members".into()),
    }];
    assert!(device
        .with(|c| engine::apply_changes(c, &device.campaign, &hostile, "999"))
        .is_err());
    assert_eq!(
        device
            .with(|c| engine::link(c, &device.campaign))
            .unwrap()
            .unwrap()
            .cursor,
        link.cursor
    );
    assert!(device.remote().is_empty());
}

#[tokio::test]
async fn sessions_need_explicit_server_setup_and_reject_incompatible_servers() {
    for bad in [
        "http://example.org",
        "https://user:pw@example.org",
        "https://example.org/path",
        "https://example.org?x=1",
        "ftp://example.org",
    ] {
        assert!(server_url(bad, false).is_err(), "{bad}");
    }
    assert_eq!(
        server_url("https://sync.example.org/", false)
            .unwrap()
            .as_str(),
        "https://sync.example.org/"
    );
    assert!(server_url("http://127.0.0.1:9", false).is_err());
    let fake = Fake::start();
    let mut device = Device::new("Setup");
    device.sign(&fake.base, Some("ADMIN-INVITE"), "frank").await;
    let anonymous = api::Client::new(server_url(&fake.base, true).unwrap(), None, true).unwrap();
    assert!(anonymous
        .redeem(
            "ADMIN-INVITE",
            "again",
            "Again",
            "correct horse battery",
            "t"
        )
        .await
        .unwrap_err()
        .message()
        .contains("expired"));
    let wrong = anonymous.login("frank", "wrong", "t").await.unwrap_err();
    assert!(matches!(wrong, Failure::Unauthorized(_)));
    device.client().logout().await.unwrap();
    assert!(matches!(
        device.client().create_campaign("x").await.unwrap_err(),
        Failure::Unauthorized(_)
    ));
    // The server learns nothing it was not given: no private item text ever left the device.
    let requests = fake.state.lock().unwrap().requests.clone();
    assert!(requests.iter().all(|r| !r.contains("Secret")));
}

#[test]
fn account_file_keeps_the_token_private_and_out_of_the_interface() {
    let dir = tempfile::tempdir().unwrap();
    assert_eq!(super::read_account(dir.path()).unwrap().session, None);
    let account = super::Account {
        version: 1,
        server: Some("https://sync.example.org".into()),
        session: Some(super::Session {
            account_id: "acc-1".into(),
            username: "gina".into(),
            display_name: "Gina".into(),
            token: "t".repeat(40),
            device: "desk".into(),
        }),
    };
    super::write_account(dir.path(), &account).unwrap();
    assert_eq!(super::read_account(dir.path()).unwrap(), account);
    let view = serde_json::to_string(&super::AccountView::from(&account)).unwrap();
    assert!(view.contains("gina") && !view.contains(&"t".repeat(40)));
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mode = std::fs::metadata(dir.path().join(super::ACCOUNT_FILE))
            .unwrap()
            .permissions()
            .mode();
        assert_eq!(mode & 0o777, 0o600);
    }
    std::fs::write(
        dir.path().join(super::ACCOUNT_FILE),
        b"{\"version\":1,\"extra\":true}",
    )
    .unwrap();
    assert!(super::read_account(dir.path()).is_err());
}

/// Continuous synchronization: no button, no network for a campaign that was not switched on.
mod continuous {
    use super::*;

    pub(super) fn fast() -> auto::Timing {
        auto::Timing {
            debounce: Duration::from_millis(40),
            max_debounce: Duration::from_millis(400),
            poll: Duration::from_millis(150),
            backoff_first: Duration::from_millis(60),
            backoff_max: Duration::from_millis(300),
            reconnect: Duration::from_millis(100),
            watch: Duration::from_millis(20),
        }
    }
    pub(super) fn controller(
        device: &Device,
        base: &str,
        timing: auto::Timing,
    ) -> (auto::Auto, Arc<Mutex<Vec<auto::Status>>>) {
        let base = base.to_string();
        let token = device.client().token().unwrap().to_string();
        let account = device.account.clone();
        let server = server_url(&base, true)
            .unwrap()
            .origin()
            .ascii_serialization();
        let seen: Arc<Mutex<Vec<auto::Status>>> = Arc::default();
        let log = Arc::clone(&seen);
        let controller = auto::Auto::new(
            device.db.clone(),
            Arc::new(move || {
                Ok(auto::Backend {
                    client: api::Client::new(
                        server_url(&base, true).unwrap(),
                        Some(token.clone()),
                        true,
                    )?,
                    account_id: account.clone(),
                    server: server.clone(),
                })
            }),
            Arc::new(move |status| log.lock().unwrap().push(status.clone())),
            timing,
        );
        (controller, seen)
    }
    pub(super) async fn until(what: &str, mut ready: impl FnMut() -> bool) -> Duration {
        let start = Instant::now();
        while !ready() {
            assert!(
                start.elapsed() < Duration::from_secs(10),
                "timed out: {what}"
            );
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
        start.elapsed()
    }

    #[tokio::test]
    async fn autosave_reaches_the_server_without_a_sync_button_and_survives_an_outage() {
        let fake = Fake::start();
        let mut device = Device::new("Continuous");
        let account = device.sign(&fake.base, Some("ADMIN-INVITE"), "noa").await;
        let remote = device.client().create_campaign("Continuous").await.unwrap();
        device.link(&fake.base, &account, &remote);
        let page = device.page("Journal", "note");
        device.scope("page", &page, "private").unwrap();
        let (auto, seen) = controller(&device, &fake.base, fast());

        // Not activated: nothing talks to the server.
        auto.reload().await;
        tokio::time::sleep(Duration::from_millis(300)).await;
        assert!(!fake.stored(&page), "an inactive campaign stays local");

        device
            .with(|c| engine::set_auto(c, &device.campaign, true, false))
            .unwrap();
        auto.reload().await;
        until("first replication", || fake.revision(&page) == Some(1)).await;
        until("saved state", || {
            seen.lock()
                .unwrap()
                .last()
                .is_some_and(|s| s.state == "saved")
        })
        .await;

        // An autosave is replicated on its own, and the latency is measured.
        device.edit(&page, "Typed while connected.");
        let latency = until("autosave replicated", || fake.revision(&page) == Some(2)).await;
        assert!(
            latency < Duration::from_secs(2),
            "autosave took {latency:?}"
        );

        // Outage: local editing continues, the state says so, nothing is lost.
        fake.set(|s| s.offline = true);
        device.edit(&page, "Typed during the outage.");
        until("offline state", || {
            seen.lock()
                .unwrap()
                .last()
                .is_some_and(|s| s.state == "offline" && s.pending > 0)
        })
        .await;
        assert!(device.text_of(&page).contains("during the outage"));
        assert_eq!(fake.revision(&page), Some(2));

        // Back online: the recoverable change appears on the server by itself.
        fake.set(|s| s.offline = false);
        until("recovery", || fake.revision(&page) == Some(3)).await;
        until("saved again", || {
            seen.lock()
                .unwrap()
                .last()
                .is_some_and(|s| s.state == "saved" && s.pending == 0)
        })
        .await;

        // Pausing keeps the local copy and sends nothing.
        device
            .with(|c| engine::set_auto(c, &device.campaign, true, true))
            .unwrap();
        auto.reload().await;
        device.edit(&page, "Typed while paused.");
        tokio::time::sleep(Duration::from_millis(400)).await;
        assert_eq!(fake.revision(&page), Some(3));
        let status = auto.status(&device.campaign).await.unwrap();
        assert_eq!((status.state.as_str(), status.pending), ("paused", 1));
        auto.stop_all();
    }

    #[tokio::test]
    async fn a_conflict_pauses_only_that_item_and_a_refused_session_stops_the_loop() {
        let fake = Fake::start();
        let mut first = Device::new("Conflicts");
        let account = first.sign(&fake.base, Some("ADMIN-INVITE"), "oli").await;
        let remote = first.client().create_campaign("Conflicts").await.unwrap();
        first.link(&fake.base, &account, &remote);
        let (page, other) = (first.page("Contested", "note"), first.page("Calm", "note"));
        first
            .with(|c| engine::replicate_all_privately(c, &first.campaign))
            .unwrap();
        first.sync().await;
        let second = second_device(&fake.base, "oli", &remote).await;
        second.sync().await;
        second.edit(&page, "Laptop version.");
        second.sync().await;
        first.edit(&page, "Desktop version.");
        first.edit(&other, "Calm edit.");
        first
            .with(|c| engine::set_auto(c, &first.campaign, true, false))
            .unwrap();
        let (auto, seen) = controller(&first, &fake.base, fast());
        auto.reload().await;
        until("conflict surfaced", || {
            seen.lock()
                .unwrap()
                .last()
                .is_some_and(|s| s.state == "conflict" && s.conflicts == 1)
        })
        .await;
        until("calm item still replicated", || {
            fake.revision(&other) == Some(2)
        })
        .await;
        assert!(
            first.text_of(&page).contains("Desktop version"),
            "nothing was overwritten"
        );

        // The session is revoked on the server: the loop stops and asks for a sign-in.
        fake.set(|s| s.tokens.clear());
        first.edit(&other, "After revocation.");
        until("needs attention", || {
            seen.lock()
                .unwrap()
                .last()
                .is_some_and(|s| s.state == "attention")
        })
        .await;
        let before = fake.state.lock().unwrap().requests.len();
        tokio::time::sleep(Duration::from_millis(500)).await;
        // Only the notification probe may still knock; no sync traffic follows a refusal.
        let after = fake.state.lock().unwrap().requests.len();
        assert!(
            after - before <= 6,
            "{} requests after the refusal",
            after - before
        );
        auto.stop_all();
    }
}

/// Acceptance against the **real** Chronexus Server binary (repository
/// `Chronexus-Server`): real HTTP, real SQLite, real change notifications. Ignored by
/// default because it needs that binary: build it there with `cargo build` and run
/// `cargo test live -- --ignored --test-threads=1` here, with `CHRONEXUS_SERVER_BIN` pointing
/// at it (default: the sibling checkout's `target/debug`).
mod live {
    use super::continuous::{controller, fast, until};
    use super::*;
    use std::process::{Child, Command, Stdio};

    struct Real {
        child: Option<Child>,
        port: u16,
        base: String,
        dir: tempfile::TempDir,
        bin: std::path::PathBuf,
    }
    impl Real {
        fn binary() -> std::path::PathBuf {
            std::env::var_os("CHRONEXUS_SERVER_BIN")
                .map(Into::into)
                .unwrap_or_else(|| {
                    std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                        .join("../../Chronexus-Server/target/debug")
                        .join(if cfg!(windows) {
                            "chronexus-server.exe"
                        } else {
                            "chronexus-server"
                        })
                })
        }
        fn command(&self, arg: &str) -> Command {
            let mut command = Command::new(&self.bin);
            command
                .arg(arg)
                .env("CHRONEXUS_LISTEN", format!("127.0.0.1:{}", self.port))
                .env("CHRONEXUS_PUBLIC_ORIGIN", &self.base)
                .env("CHRONEXUS_ALLOW_LOOPBACK_HTTP", "true")
                .env("CHRONEXUS_DATABASE", self.dir.path().join("server.sqlite3"))
                .stdout(Stdio::piped())
                .stderr(Stdio::null());
            command
        }
        fn start() -> Self {
            let bin = Self::binary();
            assert!(
                bin.exists(),
                "set CHRONEXUS_SERVER_BIN to the built server: {}",
                bin.display()
            );
            let probe = TcpListener::bind("127.0.0.1:0").unwrap();
            let port = probe.local_addr().unwrap().port();
            drop(probe);
            let mut server = Self {
                child: None,
                port,
                base: format!("http://127.0.0.1:{port}"),
                dir: tempfile::tempdir().unwrap(),
                bin,
            };
            server.run();
            server
        }
        /// (Re)starts the process on the same port and database: a server restart.
        fn run(&mut self) {
            let mut command = self.command("serve");
            command.stdout(Stdio::null());
            self.child = Some(command.spawn().unwrap());
            let start = Instant::now();
            loop {
                let ready = TcpStream::connect(("127.0.0.1", self.port))
                    .and_then(|mut socket| {
                        socket.write_all(b"GET /health/ready HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n")?;
                        let mut reply = String::new();
                        socket.read_to_string(&mut reply)?;
                        Ok(reply.starts_with("HTTP/1.1 200"))
                    })
                    .unwrap_or(false);
                if ready {
                    return;
                }
                assert!(
                    start.elapsed() < Duration::from_secs(15),
                    "server not ready"
                );
                std::thread::sleep(Duration::from_millis(50));
            }
        }
        /// A network outage: the process dies, nothing answers.
        fn kill(&mut self) {
            if let Some(mut child) = self.child.take() {
                let _ = child.kill();
                let _ = child.wait();
            }
        }
        fn invite(&self) -> String {
            let out = self.command("invite").output().unwrap();
            String::from_utf8(out.stdout).unwrap().trim().to_string()
        }
    }
    impl Drop for Real {
        fn drop(&mut self) {
            self.kill();
        }
    }
    /// What this client builds for production, minus the OS keychain.
    fn production_like() -> auto::Timing {
        auto::Timing {
            // Long polling: any speed below comes from the notification stream alone.
            poll: Duration::from_secs(60),
            ..fast()
        }
    }

    #[tokio::test]
    #[ignore = "needs the Chronexus-Server binary (CHRONEXUS_SERVER_BIN)"]
    async fn two_computers_replicate_each_other_through_the_real_server_and_measure_latency() {
        let mut server = Real::start();
        let mut laptop = Device::new("Live campaign");
        let account = laptop
            .sign(&server.base, Some(&server.invite()), "alice")
            .await;
        let remote = laptop
            .client()
            .create_campaign("Live campaign")
            .await
            .unwrap();
        laptop.link(&server.base, &account, &remote);
        let page = laptop.page("Greywatch", "place");
        let note = laptop.page("Secret ledger", "note");
        laptop.edit(&note, "PRIVATE-MARKER stays on the account.");
        laptop
            .with(|c| engine::replicate_all_privately(c, &laptop.campaign))
            .unwrap();
        assert_eq!(laptop.sync().await.pushed, 2);

        // The second computer downloads the campaign and both keep themselves aligned.
        let desktop = second_device(&server.base, "alice", &remote).await;
        assert_eq!(desktop.sync().await.materialized, 2);
        for device in [&laptop, &desktop] {
            device
                .with(|c| engine::set_auto(c, &device.campaign, true, false))
                .unwrap();
        }
        let (laptop_auto, laptop_status) = controller(&laptop, &server.base, production_like());
        let (desktop_auto, desktop_status) = controller(&desktop, &server.base, production_like());
        laptop_auto.reload().await;
        desktop_auto.reload().await;
        until("both settled", || {
            [&laptop_status, &desktop_status]
                .iter()
                .all(|s| s.lock().unwrap().last().is_some_and(|s| s.state == "saved"))
        })
        .await;

        // Latency from "the user typed" to "visible on the other computer", both directions.
        let mut samples = vec![];
        for round in 0..8 {
            let (from, to) = if round % 2 == 0 {
                (&laptop, &desktop)
            } else {
                (&desktop, &laptop)
            };
            let marker = format!("Edit number {round}.");
            from.edit(&page, &marker);
            let latency = until("edit reached the other computer", || {
                to.text_of(&page).contains(&marker)
            })
            .await;
            samples.push(latency);
        }
        samples.sort();
        let median = samples[samples.len() / 2];
        eprintln!(
            "autosave-to-other-computer latency over {} edits: min {:?}, median {median:?}, max {:?}",
            samples.len(),
            samples[0],
            samples[samples.len() - 1]
        );
        assert!(median < Duration::from_millis(1500), "median {median:?}");
        assert!(
            *samples.last().unwrap() < Duration::from_secs(5),
            "{samples:?}"
        );
        until("saved on server", || {
            [&laptop_status, &desktop_status].iter().all(|s| {
                s.lock()
                    .unwrap()
                    .last()
                    .is_some_and(|s| s.state == "saved" && s.pending == 0)
            })
        })
        .await;

        // The server dies: local editing continues and says so; no change is lost.
        server.kill();
        laptop.edit(&page, "Typed while the server was gone.");
        until("offline shown", || {
            laptop_status
                .lock()
                .unwrap()
                .last()
                .is_some_and(|s| s.state == "offline" && s.pending > 0)
        })
        .await;
        assert!(laptop.text_of(&page).contains("while the server was gone"));
        // It comes back on the same database: the change reaches the other computer by itself.
        server.run();
        until(
            "recovered through the notification stream or the next retry",
            || desktop.text_of(&page).contains("while the server was gone"),
        )
        .await;
        until("saved again", || {
            laptop_status
                .lock()
                .unwrap()
                .last()
                .is_some_and(|s| s.state == "saved" && s.pending == 0)
        })
        .await;

        // A crash after the operation was stored but before it was sent: the retry is applied once.
        let (jobs, _) = laptop
            .with(|c| engine::pending(c, &laptop.campaign))
            .unwrap();
        assert!(jobs.is_empty());
        laptop_auto.stop_all();
        desktop_auto.stop_all();
        laptop.edit(&page, "Written right before the crash.");
        let (jobs, _) = laptop
            .with(|c| engine::pending(c, &laptop.campaign))
            .unwrap();
        assert_eq!(jobs.len(), 1);
        laptop
            .with(|c| engine::begin(c, &laptop.campaign, &jobs[0]))
            .unwrap();
        assert_eq!(
            laptop
                .with(|c| engine::outbox(c, &laptop.campaign))
                .unwrap()
                .len(),
            1
        );
        // "Restart": the stored operation is replayed under its own ID, then nothing is left.
        let report = laptop.sync().await;
        assert_eq!((report.pushed, report.conflicts), (1, 0));
        assert!(laptop
            .with(|c| engine::outbox(c, &laptop.campaign))
            .unwrap()
            .is_empty());
        desktop.sync().await;
        assert!(desktop.text_of(&page).contains("right before the crash"));

        // The private note never reached any other account (checked below with a member).
        let invite = laptop.client().invite(&remote.id, "player").await.unwrap();
        let mut guest = Device::new("Guest");
        let guest_id = guest
            .sign(&server.base, Some(&server.invite()), "bob")
            .await;
        let joined = guest.client().join(&invite.code).await.unwrap();
        guest.link(&server.base, &guest_id, &joined);
        let report = guest.sync().await;
        assert_eq!((report.received, report.materialized), (0, 0));
        assert!(guest.remote().is_empty());
        let _ = note;
    }

    #[tokio::test]
    #[ignore = "needs the Chronexus-Server binary (CHRONEXUS_SERVER_BIN)"]
    async fn concurrent_edits_conflicts_sharing_withdrawal_and_resync_against_the_real_server() {
        let server = Real::start();
        let mut owner = Device::new("Live conflicts");
        let account = owner
            .sign(&server.base, Some(&server.invite()), "carol")
            .await;
        let remote = owner
            .client()
            .create_campaign("Live conflicts")
            .await
            .unwrap();
        owner.link(&server.base, &account, &remote);
        let page = owner.page("Contested", "note");
        owner.scope("page", &page, "shared").unwrap();
        owner.sync().await;
        let other = second_device(&server.base, "carol", &remote).await;
        assert_eq!(other.sync().await.materialized, 1);

        // A member sees the shared page, attributed to its author, never as a Codex page.
        let invite = owner.client().invite(&remote.id, "player").await.unwrap();
        let mut member = Device::new("Member");
        let member_id = member
            .sign(&server.base, Some(&server.invite()), "dave")
            .await;
        let joined = member.client().join(&invite.code).await.unwrap();
        member.link(&server.base, &member_id, &joined);
        assert_eq!(member.sync().await.received, 1);
        assert!(member
            .with(|c| knowledge::list_pages(c, &member.campaign))
            .unwrap()
            .is_empty());

        // Both computers edit the same page: the second push becomes a conflict, nothing is lost.
        other.edit(&page, "Edited on the second computer.");
        assert_eq!(other.sync().await.pushed, 1);
        owner.edit(&page, "Edited on the first computer.");
        let report = owner.sync().await;
        assert_eq!((report.conflicts, report.pushed), (1, 0));
        assert!(owner.text_of(&page).contains("first computer"));
        owner
            .with(|c| engine::resolve(c, &owner.campaign, "page", &page, "local"))
            .unwrap();
        assert_eq!(owner.sync().await.pushed, 1);
        assert_eq!(other.sync().await.updated, 1);
        assert!(other.text_of(&page).contains("first computer"));
        assert_eq!(
            member.sync().await.updated + member.sync().await.received,
            0
        );
        assert!(member.remote()[0]
            .payload
            .to_string()
            .contains("first computer"));

        // Withdrawing the page from the members leaves it on the owner's account.
        owner.scope("page", &page, "private").unwrap();
        assert_eq!(owner.sync().await.pushed, 1);
        assert_eq!(member.sync().await.removed, 1);
        assert!(member.remote().is_empty());
        assert_eq!(
            other.sync().await.updated,
            1,
            "the visibility change is adopted"
        );
        assert!(other.text_of(&page).contains("first computer"));

        // Many items, small pages: nothing is skipped and a second pass reads nothing.
        let ids: Vec<String> = (0..120)
            .map(|n| owner.page(&format!("Bulk {n}"), "note"))
            .collect();
        owner
            .with(|c| engine::replicate_all_privately(c, &owner.campaign))
            .unwrap();
        assert_eq!(owner.sync().await.pushed, 120);
        let report = other.sync().await;
        assert_eq!(report.materialized, 120);
        assert!(ids.iter().all(|id| other
            .with(|c| knowledge::get_page(c, &other.campaign, id))
            .is_ok()));
        assert_eq!(other.sync().await, engine::Report::default());
        assert_eq!(member.sync().await, engine::Report::default());
    }
}
