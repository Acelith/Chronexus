use crate::{db, journal::*};
use serde_json::json;

fn document() -> serde_json::Value {
    json!({"version":1,"blocks":[
        {"id":"one","type":"paragraph","props":{},"content":[{"type":"text","text":"Varek sostiene di conoscere la gilda.","styles":{}}],"children":[]},
        {"id":"two","type":"paragraph","props":{},"content":[{"type":"text","text":"È soltanto un sospetto.","styles":{"bold":true}}],"children":[]}
    ]})
}

#[test]
fn campaign_session_two_paragraphs_survive_restart_in_order() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("journal.sqlite3");
    let (campaign_id, session_id) = {
        let connection = db::open(&path).unwrap();
        let campaign = create_campaign(&connection, "Campagna di prova").unwrap();
        create_session(&connection, &campaign.id, 12, "Il ritorno", None).unwrap();
        let session = create_session(
            &connection,
            &campaign.id,
            2,
            "L'incontro",
            Some("2026-10-23".into()),
        )
        .unwrap();
        let saved = save_document(&connection, &campaign.id, &session.id, 0, document()).unwrap();
        assert_eq!(saved.revision, 1);
        rename_campaign(&connection, &campaign.id, "Nuovo nome").unwrap();
        (campaign.id, session.id)
    };
    let connection = db::open(&path).unwrap();
    assert_eq!(list_campaigns(&connection).unwrap()[0].name, "Nuovo nome");
    let sessions = list_sessions(&connection, &campaign_id).unwrap();
    assert_eq!(
        sessions.iter().map(|s| s.sequence).collect::<Vec<_>>(),
        vec![2, 12]
    );
    let reopened = get_session(&connection, &campaign_id, &session_id).unwrap();
    assert_eq!(reopened.document, document());
    assert_eq!(reopened.played_on.as_deref(), Some("2026-10-23"));
    assert_eq!(
        connection
            .query_row("PRAGMA integrity_check", [], |r| r.get::<_, String>(0))
            .unwrap(),
        "ok"
    );
}

#[test]
fn campaign_boundaries_and_stale_writes_are_enforced() {
    let connection = db::open(std::path::Path::new(":memory:")).unwrap();
    let a = create_campaign(&connection, "A").unwrap();
    let b = create_campaign(&connection, "B").unwrap();
    let session = create_session(&connection, &a.id, 1, "Prima", None).unwrap();
    assert!(get_session(&connection, &b.id, &session.id).is_err());
    assert!(save_document(&connection, &b.id, &session.id, 0, document()).is_err());
    assert!(list_sessions(&connection, &b.id).unwrap().is_empty());
    save_document(&connection, &a.id, &session.id, 0, document()).unwrap();
    assert!(save_document(
        &connection,
        &a.id,
        &session.id,
        0,
        json!({"version":1,"blocks":[]})
    )
    .is_err());
    assert!(save_document(&connection, &a.id, &session.id, 0, document()).is_err());
    assert_eq!(
        get_session(&connection, &a.id, &session.id)
            .unwrap()
            .document,
        document()
    );
}

#[test]
fn invalid_inputs_duplicates_and_write_failures_do_not_replace_notes() {
    let connection = db::open(std::path::Path::new(":memory:")).unwrap();
    assert!(create_campaign(&connection, "  ").is_err());
    assert!(create_campaign(&connection, &"a".repeat(201)).is_err());
    let campaign = create_campaign(&connection, "A").unwrap();
    assert!(create_session(&connection, &campaign.id, 0, "Titolo", None).is_err());
    assert!(create_session(
        &connection,
        &campaign.id,
        1,
        "Titolo",
        Some("2026-02-30".into())
    )
    .is_err());
    let session = create_session(&connection, &campaign.id, 1, "Titolo", None).unwrap();
    assert!(create_session(&connection, &campaign.id, 1, "Duplicata", None).is_err());
    let mut invalid = document();
    invalid["blocks"][0]["type"] = json!("video");
    assert!(save_document(&connection, &campaign.id, &session.id, 0, invalid).is_err());
    connection.pragma_update(None, "query_only", true).unwrap();
    let error = save_document(&connection, &campaign.id, &session.id, 0, document()).unwrap_err();
    assert!(error.contains("permissions"));
    assert_eq!(
        get_session(&connection, &campaign.id, &session.id)
            .unwrap()
            .revision,
        0
    );
}

#[test]
fn migration_upgrades_existing_m0_without_losing_data() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("old.sqlite3");
    {
        let connection = rusqlite::Connection::open(&path).unwrap();
        connection
            .execute_batch(include_str!("../migrations/001_foundation.sql"))
            .unwrap();
        connection
            .execute("INSERT INTO app_metadata VALUES ('old','preserved')", [])
            .unwrap();
    }
    let connection = db::open(&path).unwrap();
    assert_eq!(
        connection
            .query_row("SELECT value FROM app_metadata WHERE key='old'", [], |r| {
                r.get::<_, String>(0)
            })
            .unwrap(),
        "preserved"
    );
    assert!(list_campaigns(&connection).unwrap().is_empty());
}

#[test]
fn future_schema_is_rejected_without_modifying_user_data() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("future.sqlite3");
    {
        let connection = db::open(&path).unwrap();
        connection
            .execute("INSERT INTO schema_migrations(version) VALUES (99)", [])
            .unwrap();
        connection
            .execute("INSERT INTO app_metadata VALUES ('future','keep')", [])
            .unwrap();
    }
    assert!(db::open(&path).is_err());
    let connection = rusqlite::Connection::open(&path).unwrap();
    assert_eq!(
        connection
            .query_row(
                "SELECT value FROM app_metadata WHERE key='future'",
                [],
                |r| r.get::<_, String>(0)
            )
            .unwrap(),
        "keep"
    );
}

#[test]
fn failed_migration_rolls_back_without_erasing_existing_tables() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("conflict.sqlite3");
    {
        let connection = rusqlite::Connection::open(&path).unwrap();
        connection
            .execute_batch(include_str!("../migrations/001_foundation.sql"))
            .unwrap();
        connection
            .execute_batch(
                "CREATE TABLE campaigns (content TEXT); INSERT INTO campaigns VALUES ('keep');",
            )
            .unwrap();
    }
    assert!(db::open(&path).is_err());
    let connection = rusqlite::Connection::open(&path).unwrap();
    assert_eq!(
        connection
            .query_row("SELECT content FROM campaigns", [], |r| r
                .get::<_, String>(0))
            .unwrap(),
        "keep"
    );
    assert_eq!(
        connection
            .query_row("SELECT MAX(version) FROM schema_migrations", [], |r| r
                .get::<_, i64>(0))
            .unwrap(),
        1
    );
}

#[test]
fn only_duplicate_session_numbers_report_the_session_number_message() {
    let directory = tempfile::tempdir().unwrap();
    let connection = db::open(&directory.path().join("journal.sqlite3")).unwrap();
    let campaign = create_campaign(&connection, "Constraint").unwrap();
    create_session(&connection, &campaign.id, 1, "First", None).unwrap();
    let duplicate = create_session(&connection, &campaign.id, 1, "Again", None).unwrap_err();
    assert!(duplicate.contains("session number"), "{duplicate}");
    let foreign = connection
        .execute(
            "INSERT INTO pages(id,campaign_id,title,title_key,kind,status,document) VALUES ('p','missing','T','t','note','stub','{}')",
            [],
        )
        .map_err(storage)
        .unwrap_err();
    assert!(!foreign.contains("session number"), "{foreign}");
    assert!(foreign.starts_with("Invalid operation"), "{foreign}");
}
