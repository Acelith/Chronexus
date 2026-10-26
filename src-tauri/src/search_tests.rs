use crate::{db, journal, knowledge, search};
use serde_json::json;
fn document(text: &str) -> serde_json::Value {
    json!({"version":1,"blocks":[{"id":"source","type":"paragraph","props":{},"content":[{"type":"text","text":text,"styles":{}}],"children":[]}]})
}
#[test]
fn full_text_is_atomic_scoped_accent_insensitive_and_rebuildable_after_restart() {
    let dir = tempfile::tempdir().unwrap();
    let file = dir.path().join("search.sqlite3");
    let c = db::open(&file).unwrap();
    let a = journal::create_campaign(&c, "A").unwrap();
    let b = journal::create_campaign(&c, "B").unwrap();
    let s = journal::create_session(&c, &a.id, 12, "The bridge", None).unwrap();
    journal::save_document(
        &c,
        &a.id,
        &s.id,
        0,
        document("The café hides a golden key"),
    )
    .unwrap();
    let hits = search::find(&c, &a.id, "cafe key", None, "relevance").unwrap();
    assert_eq!(hits.len(), 1);
    assert_eq!(hits[0].block_id.as_deref(), Some("source"));
    assert!(search::find(&c, &b.id, "key", None, "relevance")
        .unwrap()
        .is_empty());
    assert!(
        journal::save_document(&c, &a.id, &s.id, 0, document("Wrong replacement")).is_err()
    );
    assert!(search::find(&c, &a.id, "wrong", None, "relevance")
        .unwrap()
        .is_empty());
    let p =
        knowledge::create_page(&c, &a.id, "Varek", "npc", "active", &["Keeper".into()]).unwrap();
    knowledge::update_page(
        &c,
        &a.id,
        &p.id,
        "New Varek",
        "npc",
        "active",
        &["Keeper".into()],
    )
    .unwrap();
    assert_eq!(
        search::find(&c, &a.id, "Keeper", Some("page"), "recent").unwrap()[0].source_id,
        p.id
    );
    let original = search::find(&c, &a.id, "key", None, "relevance").unwrap()[0]
        .preview
        .clone();
    c.execute("DELETE FROM search_documents", []).unwrap();
    assert!(search::find(&c, &a.id, "key", None, "relevance")
        .unwrap()
        .is_empty());
    search::rebuild(&c).unwrap();
    drop(c);
    let c = db::open(&file).unwrap();
    assert_eq!(
        search::find(&c, &a.id, "key", None, "relevance").unwrap()[0].preview,
        original
    );
    for query in ["\" OR *", "a:b", "[[Varek]]", "' ; DROP TABLE pages;--"] {
        assert!(search::find(&c, &a.id, query, None, "relevance").is_ok());
    }
}
#[test]
fn schema_six_migration_indexes_existing_notes_without_rewriting_documents() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("legacy.sqlite3");
    let c = rusqlite::Connection::open(&path).unwrap();
    for m in db::MIGRATIONS.iter().take(6) {
        c.execute_batch(m).unwrap();
    }
    let a = journal::create_campaign(&c, "Legacy").unwrap();
    let s = journal::create_session(&c, &a.id, 1, "Prima", None).unwrap();
    journal::save_document(&c, &a.id, &s.id, 0, document("Memoria precedente")).unwrap();
    drop(c);
    let c = db::open(&path).unwrap();
    assert_eq!(
        search::find(&c, &a.id, "precedente", None, "relevance")
            .unwrap()
            .len(),
        1
    );
    assert_eq!(
        journal::get_session(&c, &a.id, &s.id).unwrap().document,
        document("Memoria precedente")
    );
}

#[test]
fn full_text_match_drives_the_search_query_plan() {
    let d = tempfile::tempdir().unwrap();
    let c = crate::db::open(&d.path().join("plan.sqlite3")).unwrap();
    let plan: Vec<String> = c
        .prepare(&format!("EXPLAIN QUERY PLAN {}", crate::search::SEARCH_SQL))
        .unwrap()
        .query_map(
            rusqlite::params!["\"x\"*", "c", None::<String>, "relevance"],
            |r| r.get::<_, String>(3),
        )
        .unwrap()
        .collect::<rusqlite::Result<_>>()
        .unwrap();
    // The virtual table must be scanned first; documents are looked up by id.
    assert!(plan[0].contains("search_fts VIRTUAL TABLE"), "{plan:?}");
    assert!(
        plan.iter().any(|p| p.contains("INTEGER PRIMARY KEY")),
        "{plan:?}"
    );
}
