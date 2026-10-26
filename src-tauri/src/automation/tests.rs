use super::{domain, tools, transport, Config, Policy, Server};
use crate::{backup, db, journal, knowledge, player};
use serde_json::{json, Value};
use std::{
    io::{Read, Write},
    net::TcpStream,
    sync::{Arc, Mutex},
};
fn policy(campaign: &str) -> Policy {
    Policy {
        campaign: Some(campaign.into()),
        write: true,
    }
}
fn execute(c: &rusqlite::Connection, p: &Policy, name: &str, args: Value) -> Value {
    domain::call(c, p, &format!("chronexus_{name}"), &args)
        .unwrap()
        .0
}
#[test]
fn append_preserves_blocks_and_rejects_stale_revision_and_other_campaign() {
    let d = tempfile::tempdir().unwrap();
    let path = d.path().join("test.sqlite3");
    let c = db::open(&path).unwrap();
    let campaign = journal::create_campaign(&c, "Test automation").unwrap();
    let p = policy(&campaign.id);
    let s = journal::create_session(&c, &campaign.id, 1, "Session", None).unwrap();
    let old = s.document["blocks"][0].clone();
    let args = json!({"campaignId":campaign.id,"target":"session","id":s.id,"revision":0,"text":"Oran claims: [[NOT a factual relationship]] 日本語"});
    let saved = execute(&c, &p, "append_note", args.clone());
    assert_eq!(saved["document"]["blocks"][0], old);
    assert_eq!(saved["revision"], 1);
    assert!(domain::call(&c, &p, "chronexus_append_note", &args).is_err());
    let other = journal::create_campaign(&c, "Altra").unwrap();
    let forbidden = journal::create_session(&c, &other.id, 1, "Privata", None).unwrap();
    assert!(domain::call(
        &c,
        &p,
        "chronexus_session",
        &json!({"campaignId":other.id,"id":forbidden.id})
    )
    .is_err());
    drop(c);
    let c = db::open(&path).unwrap();
    assert_eq!(
        journal::get_session(&c, &campaign.id, &s.id)
            .unwrap()
            .document["blocks"]
            .as_array()
            .unwrap()
            .len(),
        2
    );
}
#[test]
fn read_only_tools_and_unknown_commands_cannot_write_or_call_integrated_ai() {
    let d = tempfile::tempdir().unwrap();
    let c = db::open(&d.path().join("test.sqlite3")).unwrap();
    let campaign = journal::create_campaign(&c, "Test").unwrap();
    let p = Policy {
        campaign: Some(campaign.id.clone()),
        write: false,
    };
    let catalog = tools(&p).unwrap();
    assert!(catalog["tools"]
        .as_array()
        .unwrap()
        .iter()
        .all(|t| t["annotations"]["readOnlyHint"] == true));
    for name in [
        "ask_local_ai",
        "chronexus_delete_campaign",
        "chronexus_create_session",
    ] {
        assert!(domain::call(
            &c,
            &p,
            name,
            &json!({"campaignId":campaign.id,"title":"No","sequence":1})
        )
        .is_err());
    }
    assert!(journal::list_sessions(&c, &campaign.id).unwrap().is_empty());
}
#[test]
fn metadata_etag_detects_changes_even_without_document_revision_change() {
    let d = tempfile::tempdir().unwrap();
    let c = db::open(&d.path().join("test.sqlite3")).unwrap();
    let camp = journal::create_campaign(&c, "Test").unwrap();
    let p = policy(&camp.id);
    let page = knowledge::create_page(&c, &camp.id, "Varek", "npc", "active", &[]).unwrap();
    let read = execute(&c, &p, "page", json!({"campaignId":camp.id,"id":page.id}));
    knowledge::update_page(&c, &camp.id, &page.id, "New Varek", "npc", "active", &[]).unwrap();
    assert!(domain::call(&c,&p,"chronexus_update_page",&json!({"campaignId":camp.id,"id":page.id,"etag":read["etag"],"patch":{"status":"archived"}})).is_err());
    assert_eq!(
        knowledge::get_page(&c, &camp.id, &page.id).unwrap().title,
        "New Varek"
    );
}
#[test]
fn character_patch_preserves_fields_and_party_uses_membership_revisions() {
    let d = tempfile::tempdir().unwrap();
    let c = db::open(&d.path().join("test.sqlite3")).unwrap();
    let camp = journal::create_campaign(&c, "Test").unwrap();
    let p = policy(&camp.id);
    let character = execute(
        &c,
        &p,
        "create_character",
        json!({"campaignId":camp.id,"name":"Oran"}),
    );
    let args = json!({"campaignId":camp.id,"id":character["id"],"revision":0,"patch":{"notes":"External note","hpMaximum":10,"hpCurrent":7}});
    execute(&c, &p, "update_character", args.clone());
    assert_eq!(
        player::get_character(&c, &camp.id)
            .unwrap()
            .unwrap()
            .data
            .name,
        "Oran"
    );
    assert!(domain::call(&c, &p, "chronexus_update_character", &args).is_err());
    let member = execute(
        &c,
        &p,
        "save_party_member",
        json!({"campaignId":camp.id,"input":{"name":"Alleato","playerName":"Giocatore","role":"Guida","status":"active"}}),
    );
    let update = json!({"campaignId":camp.id,"input":{"pageId":member["page"]["id"],"revision":0,"name":"Alleato","playerName":"Giocatore","role":"Compagno","status":"active"}});
    execute(&c, &p, "save_party_member", update.clone());
    assert!(domain::call(&c, &p, "chronexus_save_party_member", &update).is_err());
}
#[test]
fn config_is_explicit_and_write_requires_one_campaign() {
    assert!(Config::parse(Vec::<String>::new()).unwrap().is_none());
    for args in [
        vec!["--automation-write"],
        vec!["--automation", "--automation-write"],
        vec!["--automation-unknown"],
    ] {
        assert!(Config::parse(args.into_iter().map(str::to_owned)).is_err());
    }
    assert!(
        Config::parse(["--automation"].into_iter().map(str::to_owned))
            .unwrap()
            .is_some()
    );
}
fn post(endpoint: &str, token: &str, body: &str, extra: &str) -> String {
    let host = endpoint
        .strip_prefix("http://")
        .unwrap()
        .strip_suffix("/automation")
        .unwrap();
    let mut stream = TcpStream::connect(host).unwrap();
    stream
        .set_read_timeout(Some(std::time::Duration::from_secs(3)))
        .unwrap();
    write!(stream,"POST /automation HTTP/1.1\r\nHost: {host}\r\nAuthorization: Bearer {token}\r\nContent-Type: application/json\r\n{extra}Content-Length: {}\r\n\r\n{body}",body.len()).unwrap();
    let mut raw = String::new();
    let _ = stream.read_to_string(&mut raw);
    raw
}
#[test]
fn transport_auth_origin_scoping_cleanup_and_live_store() {
    let root = tempfile::tempdir().unwrap();
    let store = backup::Store::open(root.path()).unwrap();
    let camp = journal::create_campaign(&store.connection, "Test").unwrap();
    let store = Arc::new(Mutex::new(store));
    let server = Server::start(
        root.path(),
        Config {
            policy: policy(&camp.id),
        },
        Arc::clone(&store),
        Arc::new(|_| {}),
    )
    .unwrap();
    let discovery: Value =
        serde_json::from_slice(&std::fs::read(root.path().join(transport::DISCOVERY)).unwrap())
            .unwrap();
    let endpoint = discovery["endpoint"].as_str().unwrap();
    let token = discovery["token"].as_str().unwrap();
    assert!(post(
        endpoint,
        "wrong",
        r#"{"tool":"describe","arguments":{}}"#,
        ""
    )
    .starts_with("HTTP/1.1 401"));
    assert!(post(
        endpoint,
        token,
        r#"{"tool":"describe","arguments":{}}"#,
        "Origin: https://example.org\r\n"
    )
    .starts_with("HTTP/1.1 403"));
    let raw=post(endpoint,token,&json!({"tool":"chronexus_create_session","arguments":{"campaignId":camp.id,"sequence":1,"title":"From MCP"}}).to_string(),"");
    assert!(raw.contains("From MCP"));
    assert_eq!(
        journal::list_sessions(&store.lock().unwrap().connection, &camp.id)
            .unwrap()
            .len(),
        1
    );
    drop(server);
    assert!(!root.path().join(transport::DISCOVERY).exists());
}

#[test]
fn slow_clients_are_served_and_refused_bodies_do_not_truncate_replies() {
    let root = tempfile::tempdir().unwrap();
    let store = backup::Store::open(root.path()).unwrap();
    let camp = journal::create_campaign(&store.connection, "Test").unwrap();
    let server = Server::start(
        root.path(),
        Config {
            policy: policy(&camp.id),
        },
        Arc::new(Mutex::new(store)),
        Arc::new(|_| {}),
    )
    .unwrap();
    let discovery: Value =
        serde_json::from_slice(&std::fs::read(root.path().join(transport::DISCOVERY)).unwrap())
            .unwrap();
    let endpoint = discovery["endpoint"].as_str().unwrap();
    let token = discovery["token"].as_str().unwrap();
    let host = endpoint
        .strip_prefix("http://")
        .unwrap()
        .strip_suffix("/automation")
        .unwrap();
    // The listener polls in non-blocking mode; an accepted connection whose
    // header has not arrived yet must still be read in blocking mode.
    let mut stream = TcpStream::connect(host).unwrap();
    stream
        .set_read_timeout(Some(std::time::Duration::from_secs(3)))
        .unwrap();
    std::thread::sleep(std::time::Duration::from_millis(150));
    let body = r#"{"tool":"describe","arguments":{}}"#;
    write!(stream,"POST /automation HTTP/1.1\r\nHost: {host}\r\nAuthorization: Bearer {token}\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{body}",body.len()).unwrap();
    let mut raw = String::new();
    let _ = stream.read_to_string(&mut raw);
    assert!(raw.starts_with("HTTP/1.1 200"), "{raw}");
    // Refused before the body is read: the complete reply must still arrive.
    for _ in 0..20 {
        let raw = post(endpoint, "wrong", &"x".repeat(64 * 1024), "");
        assert!(raw.starts_with("HTTP/1.1 401"), "{raw}");
        assert!(
            raw.ends_with(r#"{"error":"Automation request refused."}"#),
            "{raw}"
        );
    }
    drop(server);
}
#[test]
fn reference_templates_create_real_assets_and_stale_gui_metadata_cannot_overwrite() {
    let d = tempfile::tempdir().unwrap();
    let c = db::open(&d.path().join("test.sqlite3")).unwrap();
    let camp = journal::create_campaign(&c, "Test").unwrap();
    let p = policy(&camp.id);
    let reference = execute(&c, &p, "reference", json!({}));
    let character = execute(
        &c,
        &p,
        "create_character",
        json!({"campaignId":camp.id,"name":"Oran"}),
    );
    for kind in ["item", "spell", "ability"] {
        let saved = execute(
            &c,
            &p,
            "save_asset",
            json!({"campaignId":camp.id,"characterId":character["id"],"input":reference["assetTemplates"][kind]}),
        );
        assert_eq!(saved["input"]["details"]["kind"], kind);
    }
    let page = knowledge::create_page(&c, &camp.id, "Originale", "note", "active", &[]).unwrap();
    let snapshot = knowledge::Metadata {
        title: page.title.clone(),
        kind: page.kind.clone(),
        status: page.status.clone(),
        aliases: page.aliases.clone(),
    };
    knowledge::update_page(
        &c,
        &camp.id,
        &page.id,
        "Edited by AI",
        "note",
        "active",
        &[],
    )
    .unwrap();
    assert!(knowledge::update_page_checked(
        &c,
        &camp.id,
        &page.id,
        knowledge::Metadata {
            title: "Old UI draft".into(),
            kind: "note".into(),
            status: "active".into(),
            aliases: vec![]
        },
        snapshot
    )
    .is_err());
    assert_eq!(
        knowledge::get_page(&c, &camp.id, &page.id).unwrap().title,
        "Edited by AI"
    );
}
#[test]
fn malformed_arguments_and_unknown_discovery_files_are_rejected() {
    let d = tempfile::tempdir().unwrap();
    let store = backup::Store::open(d.path()).unwrap();
    let camp = journal::create_campaign(&store.connection, "Test").unwrap();
    let p = policy(&camp.id);
    for args in [
        json!({"campaignId":camp.id,"sequence":"1","title":"No"}),
        json!({"campaignId":camp.id,"sequence":1,"title":"No","sql":"DROP TABLE campaigns"}),
    ] {
        assert!(domain::call(&store.connection, &p, "chronexus_create_session", &args).is_err());
    }
    let path = d.path().join(transport::DISCOVERY);
    std::fs::write(&path, "not our file").unwrap();
    assert!(Server::start(
        d.path(),
        Config { policy: p },
        Arc::new(Mutex::new(store)),
        Arc::new(|_| {})
    )
    .is_err());
    assert_eq!(std::fs::read_to_string(path).unwrap(), "not our file");
}
#[test]
fn running_bridge_follows_real_backup_restore_and_never_backs_up_its_token() {
    let root = tempfile::tempdir().unwrap();
    let store = backup::Store::open(root.path()).unwrap();
    let campaign = journal::create_campaign(&store.connection, "Test").unwrap();
    let store = Arc::new(Mutex::new(store));
    let _server = Server::start(
        root.path(),
        Config {
            policy: policy(&campaign.id),
        },
        Arc::clone(&store),
        Arc::new(|_| {}),
    )
    .unwrap();
    let destination = root.path().join("test.nodex");
    {
        let mut current = store.lock().unwrap();
        backup::write_backup(&current.connection, &current.directory, &destination).unwrap();
        journal::create_session(
            &current.connection,
            &campaign.id,
            9,
            "To discard on restore",
            None,
        )
        .unwrap();
        let preview = current.prepare(&destination).unwrap();
        current.restore(&preview.token).unwrap();
    }
    let discovery: Value =
        serde_json::from_slice(&std::fs::read(root.path().join(transport::DISCOVERY)).unwrap())
            .unwrap();
    let raw=post(discovery["endpoint"].as_str().unwrap(),discovery["token"].as_str().unwrap(),&json!({"tool":"chronexus_create_session","arguments":{"campaignId":campaign.id,"sequence":1,"title":"After restore"}}).to_string(),"");
    assert!(raw.contains("After restore"));
    let current = store.lock().unwrap();
    assert_eq!(
        journal::list_sessions(&current.connection, &campaign.id)
            .unwrap()
            .len(),
        1
    );
    let archive = zip::ZipArchive::new(std::fs::File::open(destination).unwrap()).unwrap();
    assert!(!archive
        .file_names()
        .any(|name| name.unwrap().contains("automation-connection")));
}
