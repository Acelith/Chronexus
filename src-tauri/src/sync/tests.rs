//! M24 acceptance against an in-process fake of the server contract v1
//! (docs/SYNC_API.md). The fake is the executable reference for the server
//! repository: same routes, status codes, revisions and change feed.
use super::{api, engine, server_url};
use crate::{backup, graph, journal, knowledge, Database};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    io::{Read, Write},
    net::{TcpListener, TcpStream},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::Duration,
};

#[derive(Clone)]
struct StoredItem {
    author: String,
    revision: i64,
    payload: Option<Value>,
    seq: u64,
}
#[derive(Default)]
struct State {
    accounts: HashMap<String, (String, String, String)>, // id -> (username, display, password)
    tokens: HashMap<String, String>,
    invites: HashMap<String, (Option<String>, String)>, // code -> (campaign, role)
    campaigns: HashMap<String, (String, HashMap<String, String>)>, // id -> (name, members)
    items: HashMap<(String, String, String), StoredItem>,
    seq: u64,
    next: u64,
    requests: Vec<String>,
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
                    Ok((stream, _)) => handle(stream, &s),
                    Err(_) => std::thread::sleep(Duration::from_millis(5)),
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
    fn stored(&self, id: &str) -> bool {
        self.state
            .lock()
            .unwrap()
            .items
            .keys()
            .any(|(_, _, i)| i == id)
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
    let (status, reply) = route(&mut state.lock().unwrap(), &method, &target, token, body);
    let text = reply.to_string();
    let _ = write!(stream, "HTTP/1.1 {status} X\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{text}", text.len());
}
fn route(
    s: &mut State,
    method: &str,
    target: &str,
    token: Option<String>,
    body: Value,
) -> (u16, Value) {
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
    match (method, parts.as_slice()) {
        ("GET", ["api", "v1", "meta"]) => (
            200,
            json!({"api":"chronexus-sync","version":1,"serverVersion":"fake"}),
        ),
        ("POST", ["api", "v1", "auth", "redeem"]) => {
            let code = body["inviteCode"].as_str().unwrap_or("").to_string();
            let Some((campaign, role)) = s.invites.remove(&code) else {
                return (410, json!({}));
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
                s.campaigns.get_mut(&c).unwrap().1.insert(id.clone(), role);
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
                (
                    body["name"].as_str().unwrap().into(),
                    HashMap::from([(me.unwrap(), "owner".to_string())]),
                ),
            );
            (201, json!({"id":id,"name":body["name"],"role":"owner"}))
        }
        ("POST", ["api", "v1", "campaigns", "join"]) => {
            let code = body["inviteCode"].as_str().unwrap_or("").to_string();
            match s.invites.get(&code).cloned() {
                Some((Some(c), role)) => {
                    s.invites.remove(&code);
                    let entry = s.campaigns.get_mut(&c).unwrap();
                    entry.1.insert(me.unwrap(), role.clone());
                    (200, json!({"id":c,"name":entry.0,"role":role}))
                }
                _ => (410, json!({})),
            }
        }
        (_, ["api", "v1", "campaigns", campaign, rest @ ..]) => {
            let campaign = campaign.to_string();
            let Some(role) = s
                .campaigns
                .get(&campaign)
                .and_then(|c| c.1.get(me.as_ref().unwrap()))
                .cloned()
            else {
                return (403, json!({}));
            };
            let me = me.unwrap();
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
                ("GET", ["changes"]) => {
                    let since: u64 = param("since").parse().unwrap_or(0);
                    let mut items: Vec<_> = s
                        .items
                        .iter()
                        .filter(|((c, _, _), i)| c == &campaign && i.seq > since)
                        .collect();
                    items.sort_by_key(|(_, i)| i.seq);
                    let out: Vec<Value> = items.iter().map(|((_, k, id), i)| json!({"kind":k,"id":id,"authorId":i.author,"authorName":s.accounts[&i.author].1,"revision":i.revision,"deleted":i.payload.is_none(),"payload":i.payload,"updatedAt":"2026-10-26T12:00:00Z"})).collect();
                    (
                        200,
                        json!({"items":out,"cursor":s.seq.to_string(),"more":false}),
                    )
                }
                (_, ["items", kind, id]) if role != "reader" => {
                    let key = (campaign, kind.to_string(), id.to_string());
                    let current = s.items.get(&key).cloned();
                    if current.as_ref().is_some_and(|c| c.author != me) {
                        return (403, json!({}));
                    }
                    let base = if method == "PUT" {
                        body["baseRevision"].as_i64().unwrap()
                    } else {
                        param("baseRevision").parse().unwrap()
                    };
                    let live = current.as_ref().filter(|c| c.payload.is_some());
                    match (method, live) {
                        ("DELETE", None) => (404, json!({})),
                        ("PUT", None) if base > 0 && current.is_none() => (404, json!({})),
                        (_, Some(c)) if c.revision != base => {
                            (409, json!({"revision":c.revision,"payload":c.payload}))
                        }
                        _ => {
                            s.seq += 1;
                            let revision = current.map_or(1, |c| c.revision + 1);
                            let payload = (method == "PUT").then(|| body["payload"].clone());
                            s.items.insert(
                                key,
                                StoredItem {
                                    author: me,
                                    revision,
                                    payload,
                                    seq: s.seq,
                                },
                            );
                            (200, json!({"revision":revision}))
                        }
                    }
                }
                _ => (403, json!({})),
            }
        }
        _ => (404, json!({})),
    }
}

struct Device {
    _dir: tempfile::TempDir,
    db: Database,
    campaign: String,
    client: Option<api::Client>,
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
        }
    }
    async fn sign(&mut self, fake: &Fake, code: Option<&str>, user: &str) -> String {
        let anonymous =
            api::Client::new(server_url(&fake.base, true).unwrap(), None, true).unwrap();
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
            api::Client::new(
                server_url(&fake.base, true).unwrap(),
                Some(signed.token),
                true,
            )
            .unwrap(),
        );
        signed.account_id
    }
    fn client(&self) -> &api::Client {
        self.client.as_ref().unwrap()
    }
    fn with<T>(&self, f: impl FnOnce(&rusqlite::Connection) -> T) -> T {
        self.db.with(|c| Ok(f(c))).unwrap()
    }
    fn link(&self, fake: &Fake, account: &str, remote: &api::RemoteCampaign) {
        let link = engine::Link {
            campaign_id: self.campaign.clone(),
            server: server_url(&fake.base, true)
                .unwrap()
                .origin()
                .ascii_serialization(),
            remote_id: remote.id.clone(),
            account_id: account.into(),
            role: remote.role.clone(),
            cursor: String::new(),
            synced_at: None,
        };
        self.with(|c| engine::save_link(c, &link)).unwrap();
    }
    async fn sync(&self) -> engine::Report {
        engine::sync_now(&self.db, self.client(), self.campaign.clone())
            .await
            .unwrap()
    }
    fn share(&self, kind: &str, id: &str, shared: bool) -> crate::journal::AppResult<()> {
        self.with(|c| engine::set_share(c, &self.campaign, kind, id, shared))
    }
    fn remote(&self) -> Vec<engine::RemoteItem> {
        self.with(|c| engine::remote_items(c, &self.campaign))
            .unwrap()
    }
}
fn doc(text: &str) -> Value {
    json!({"version":1,"blocks":[{"id":"b1","type":"paragraph","props":{},"content":[{"type":"text","text":text,"styles":{}}],"children":[]}]})
}

#[tokio::test]
async fn three_members_share_selectively_update_revoke_and_stay_attributed() {
    let fake = Fake::start();
    let mut alice = Device::new("Alice's campaign");
    let alice_id = alice.sign(&fake, Some("ADMIN-INVITE"), "alice").await;
    let remote = alice.client().create_campaign("Shared").await.unwrap();
    alice.link(&fake, &alice_id, &remote);
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
    // Default private: nothing is listed as shared until chosen.
    assert!(alice
        .with(|c| engine::items(c, &alice.campaign))
        .unwrap()
        .iter()
        .all(|i| i.status == "private"));
    alice.share("page", &public, true).unwrap();
    alice.share("session", &session, true).unwrap();
    let report = alice.sync().await;
    assert_eq!(report.pushed, 2);
    assert!(
        fake.stored(&public) && !fake.stored(&private),
        "private items never reach the server"
    );

    let bob_invite = alice.client().invite(&remote.id, "player").await.unwrap();
    let carol_invite = alice.client().invite(&remote.id, "reader").await.unwrap();
    let mut bob = Device::new("Bob's campaign");
    fake.invite("BOB-ACCOUNT");
    let bob_id = bob.sign(&fake, Some("BOB-ACCOUNT"), "bob").await;
    let joined = bob.client().join(&bob_invite.code).await.unwrap();
    assert_eq!(joined.role, "player");
    bob.link(&fake, &bob_id, &joined);
    assert_eq!(bob.sync().await.received, 2);
    let seen = bob.remote();
    assert!(seen.iter().all(|i| i.author_name == "ALICE" && !i.mine));
    // Received copies are attributed and never become Bob's Codex pages.
    assert!(bob
        .with(|c| knowledge::list_pages(c, &bob.campaign))
        .unwrap()
        .is_empty());

    // A reader consults but cannot share.
    let mut carol = Device::new("Carol's campaign");
    fake.invite("CAROL-ACCOUNT");
    let carol_id = carol.sign(&fake, Some("CAROL-ACCOUNT"), "carol").await;
    let as_reader = carol.client().join(&carol_invite.code).await.unwrap();
    carol.link(&fake, &carol_id, &as_reader);
    let own = carol.with(|c| {
        knowledge::create_page(c, &carol.campaign, "Mine", "note", "active", &[])
            .unwrap()
            .id
    });
    assert!(carol
        .share("page", &own, true)
        .unwrap_err()
        .contains("Readers"));
    assert_eq!(carol.sync().await.received, 2);

    // Bob shares his own claim; Alice sees it attributed to Bob.
    let claim = bob.with(|c| {
        knowledge::create_page(c, &bob.campaign, "Bridge rumour", "lore", "stub", &[])
            .unwrap()
            .id
    });
    bob.share("page", &claim, true).unwrap();
    assert_eq!(bob.sync().await.pushed, 1);
    assert_eq!(alice.sync().await.received, 1);
    assert!(alice
        .remote()
        .iter()
        .any(|i| i.item_id == claim && i.author_name == "BOB"));

    // An update reaches the others; a revocation removes it at their next sync.
    alice.with(|c| {
        let page = knowledge::get_page(c, &alice.campaign, &public).unwrap();
        knowledge::save_page_document(
            c,
            &alice.campaign,
            &public,
            page.revision,
            doc("Neral left the bridge."),
        )
        .unwrap();
    });
    assert_eq!(alice.sync().await.pushed, 1);
    bob.sync().await;
    let updated = bob
        .remote()
        .into_iter()
        .find(|i| i.item_id == public)
        .unwrap();
    assert_eq!(updated.revision, 2);
    assert!(updated.payload.to_string().contains("left the bridge"));
    alice.share("session", &session, false).unwrap();
    assert_eq!(alice.sync().await.deleted, 1);
    assert_eq!(bob.sync().await.removed, 1);
    assert!(bob.remote().iter().all(|i| i.item_id != session));
    // The revoked session stays on Alice's device.
    assert!(alice
        .with(|c| journal::get_session(c, &alice.campaign, &session))
        .is_ok());
}

#[tokio::test]
async fn concurrent_edits_on_two_devices_become_a_conflict_the_user_resolves() {
    let fake = Fake::start();
    let mut first = Device::new("Two devices");
    let account = first.sign(&fake, Some("ADMIN-INVITE"), "dana").await;
    let remote = first.client().create_campaign("Two devices").await.unwrap();
    first.link(&fake, &account, &remote);
    let page = first.with(|c| {
        knowledge::create_page(c, &first.campaign, "Oran", "npc", "active", &[])
            .unwrap()
            .id
    });
    first.share("page", &page, true).unwrap();
    first.sync().await;
    // The second device starts from a verified backup of the first one.
    let file = first._dir.path().join("copy.nodex");
    first
        .db
        .with_store(|s| backup::write_backup(&s.connection, &s.directory, &file))
        .unwrap();
    let mut second = Device::new("placeholder");
    second
        .db
        .with_store(|s| {
            let preview = s.prepare(&file)?;
            s.restore(&preview.token).map(|_| ())
        })
        .unwrap();
    second.campaign = first.campaign.clone();
    second.sign(&fake, None, "dana").await;
    let edit = |device: &Device, text: &str| {
        device.with(|c| {
            let p = knowledge::get_page(c, &device.campaign, &page).unwrap();
            knowledge::save_page_document(c, &device.campaign, &page, p.revision, doc(text))
                .unwrap();
        })
    };
    edit(&second, "Edited on the laptop.");
    assert_eq!(second.sync().await.pushed, 1);
    edit(&first, "Edited on the desktop, offline.");
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
    assert!(first
        .with(|c| knowledge::get_page(c, &first.campaign, &page))
        .unwrap()
        .document
        .to_string()
        .contains("desktop"));
    first
        .with(|c| engine::resolve(c, &first.campaign, "page", &page, "local"))
        .unwrap();
    assert_eq!(first.sync().await.pushed, 1);
    // The other device had no local change: it takes the chosen version.
    assert_eq!(second.sync().await.updated, 1);
    assert!(second
        .with(|c| knowledge::get_page(c, &second.campaign, &page))
        .unwrap()
        .document
        .to_string()
        .contains("desktop"));
    // Keeping the remote version applies it through the normal save path.
    edit(&first, "Desktop again.");
    edit(&second, "Laptop again.");
    second.sync().await;
    assert_eq!(first.sync().await.conflicts, 1);
    first
        .with(|c| engine::resolve(c, &first.campaign, "page", &page, "remote"))
        .unwrap();
    assert!(first
        .with(|c| knowledge::get_page(c, &first.campaign, &page))
        .unwrap()
        .document
        .to_string()
        .contains("Laptop again"));
    assert_eq!(first.sync().await, engine::Report::default());
}

#[tokio::test]
async fn offline_work_realigns_and_hostile_server_data_is_rejected_atomically() {
    let fake = Fake::start();
    let mut device = Device::new("Offline");
    let account = device.sign(&fake, Some("ADMIN-INVITE"), "erin").await;
    let remote = device.client().create_campaign("Offline").await.unwrap();
    device.link(&fake, &account, &remote);
    let (a, b) = device.with(|c| {
        let a = knowledge::create_page(c, &device.campaign, "Tower", "place", "active", &[])
            .unwrap()
            .id;
        let b = knowledge::create_page(c, &device.campaign, "Keep", "place", "active", &[])
            .unwrap()
            .id;
        (a, b)
    });
    let relation = device.with(|c| {
        graph::save_relationship(
            c,
            &device.campaign,
            None,
            None,
            graph::RelationshipInput {
                from_page_id: a.clone(),
                to_page_id: b.clone(),
                label: "overlooks".into(),
                certainty: "suspected".into(),
                source_kind: None,
                source_id: None,
                source_block_id: None,
                evidence: String::new(),
                notes: String::new(),
            },
        )
        .unwrap()
        .id
    });
    assert!(device
        .share("relationship", &relation, true)
        .unwrap_err()
        .contains("both pages"));
    device.share("page", &a, true).unwrap();
    device.share("page", &b, true).unwrap();
    device.share("relationship", &relation, true).unwrap();
    // Server unreachable: the error is explicit and local choices stay pending.
    let offline = api::Client::new(
        server_url(&crate::test_support::closed_port(), true).unwrap(),
        None,
        true,
    )
    .unwrap();
    assert!(
        engine::sync_now(&device.db, &offline, device.campaign.clone())
            .await
            .is_err()
    );
    assert!(device
        .with(|c| engine::items(c, &device.campaign))
        .unwrap()
        .iter()
        .filter(|i| i.shared)
        .all(|i| i.status == "new"));
    assert_eq!(device.sync().await.pushed, 3);
    // Making an endpoint private also withdraws the relationship.
    device.share("page", &b, false).unwrap();
    let report = device.sync().await;
    assert_eq!(report.deleted, 2);
    assert!(!fake.stored_live(&relation));

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
    device.sign(&fake, Some("ADMIN-INVITE"), "frank").await;
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
        .contains("expired"));
    assert!(anonymous
        .login("frank", "wrong", "t")
        .await
        .unwrap_err()
        .contains("sign in"));
    device.client().logout().await.unwrap();
    assert!(device
        .client()
        .create_campaign("x")
        .await
        .unwrap_err()
        .contains("sign in"));
    let requests = fake.state.lock().unwrap().requests.clone();
    assert!(requests.iter().all(|r| !r.contains("Secret")));
}

impl Fake {
    fn stored_live(&self, id: &str) -> bool {
        self.state
            .lock()
            .unwrap()
            .items
            .iter()
            .any(|((_, _, i), v)| i == id && v.payload.is_some())
    }
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
