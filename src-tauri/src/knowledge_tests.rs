use crate::{db, journal, knowledge::*};
use serde_json::json;

fn document(id: &str) -> serde_json::Value {
    json!({"version":1,"blocks":[{"id":"source-block","type":"paragraph","props":{},"content":[{"type":"text","text":"Dice ","styles":{}},{"type":"pageMention","props":{"pageId":id,"label":"Varek"}},{"type":"pageMention","props":{"pageId":id,"label":"Varek"}}],"children":[{"id":"child-block","type":"quote","props":{},"content":[{"type":"pageMention","props":{"pageId":id,"label":"Varek"}}],"children":[]}]}]})
}
#[test]
fn stable_mentions_backlinks_and_rename_survive_restart() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("knowledge.sqlite3");
    let (campaign_id, page_id, session_id) = {
        let c = db::open(&path).unwrap();
        let campaign = journal::create_campaign(&c, "A").unwrap();
        let page = create_page(
            &c,
            &campaign.id,
            "Varek",
            "npc",
            "stub",
            &["Il mercante".into()],
        )
        .unwrap();
        let session = journal::create_session(&c, &campaign.id, 12, "La gilda", None).unwrap();
        journal::save_document(&c, &campaign.id, &session.id, 0, document(&page.id)).unwrap();
        let links = backlinks(&c, &campaign.id, &page.id).unwrap();
        assert_eq!(links.len(), 2);
        assert_eq!(links[0].sequence, Some(12));
        assert!(links
            .iter()
            .any(|l| l.block_id == "source-block" && l.preview == "Dice VarekVarek"));
        let renamed = update_page(
            &c,
            &campaign.id,
            &page.id,
            "Varek il grigio",
            "npc",
            "active",
            &page.aliases,
        )
        .unwrap();
        assert!(renamed.aliases.contains(&"Varek".into()));
        assert_eq!(renamed.id, page.id);
        (campaign.id, page.id, session.id)
    };
    let c = db::open(&path).unwrap();
    assert_eq!(
        get_page(&c, &campaign_id, &page_id).unwrap().title,
        "Varek il grigio"
    );
    assert_eq!(
        journal::get_session(&c, &campaign_id, &session_id)
            .unwrap()
            .document,
        document(&page_id)
    );
    assert_eq!(backlinks(&c, &campaign_id, &page_id).unwrap().len(), 2);
    // Removing a mention updates the derived index in the same transaction.
    journal::save_document(&c, &campaign_id, &session_id, 1, journal::empty_document()).unwrap();
    assert!(backlinks(&c, &campaign_id, &page_id).unwrap().is_empty());
}
#[test]
fn page_sources_are_indexed_and_stale_or_cross_campaign_writes_roll_back() {
    let c = db::open(std::path::Path::new(":memory:")).unwrap();
    let a = journal::create_campaign(&c, "A").unwrap();
    let b = journal::create_campaign(&c, "B").unwrap();
    let source = create_page(&c, &a.id, "Fonte", "note", "active", &[]).unwrap();
    let target = create_page(&c, &a.id, "Varek", "npc", "active", &[]).unwrap();
    let foreign = create_page(&c, &b.id, "Varek", "npc", "active", &[]).unwrap();
    save_page_document(&c, &a.id, &source.id, 0, document(&target.id)).unwrap();
    assert_eq!(
        backlinks(&c, &a.id, &target.id).unwrap()[0].source_kind,
        "page"
    );
    assert!(save_page_document(&c, &a.id, &source.id, 1, document(&foreign.id)).is_err());
    assert_eq!(get_page(&c, &a.id, &source.id).unwrap().revision, 1);
    assert_eq!(backlinks(&c, &a.id, &target.id).unwrap().len(), 2);
    assert!(get_page(&c, &b.id, &source.id).is_err());
    assert!(save_page_document(&c, &a.id, &source.id, 0, document(&target.id)).is_err());
    let session = journal::create_session(&c, &a.id, 1, "Prima", None).unwrap();
    assert!(journal::save_document(&c, &a.id, &session.id, 0, document(&foreign.id)).is_err());
    assert_eq!(
        journal::get_session(&c, &a.id, &session.id)
            .unwrap()
            .revision,
        0
    );
    assert!(backlinks(&c, &b.id, &target.id).unwrap().is_empty());
}
#[test]
fn ambiguous_aliases_remain_explicit_and_duplicate_creation_is_rejected() {
    let c = db::open(std::path::Path::new(":memory:")).unwrap();
    let a = journal::create_campaign(&c, "A").unwrap();
    let p = create_page(&c, &a.id, "Varek", "npc", "stub", &["Custode".into()]).unwrap();
    create_page(&c, &a.id, "Nara", "npc", "active", &["Custode".into()]).unwrap();
    let candidates = list_pages(&c, &a.id)
        .unwrap()
        .into_iter()
        .filter(|p| p.aliases.contains(&"Custode".into()))
        .count();
    assert_eq!(candidates, 2);
    assert!(create_page(&c, &a.id, " custode ", "note", "stub", &[]).is_err());
    assert!(create_page(&c, &a.id, " VAREK ", "note", "stub", &[]).is_err());
    assert!(update_page(&c, &a.id, &p.id, "Nara", "npc", "active", &[]).is_err());
    assert_eq!(get_page(&c, &a.id, &p.id).unwrap().title, "Varek");
}
#[test]
fn missing_reference_can_be_recovered_with_same_id_only_in_its_campaign() {
    let c = db::open(std::path::Path::new(":memory:")).unwrap();
    let a = journal::create_campaign(&c, "A").unwrap();
    let b = journal::create_campaign(&c, "B").unwrap();
    let id = uuid::Uuid::new_v4().to_string();
    let source = journal::create_session(&c, &a.id, 1, "Prima", None).unwrap();
    journal::save_document(&c, &a.id, &source.id, 0, document(&id)).unwrap();
    assert!(get_page(&c, &a.id, &id).is_err());
    assert!(recover_page(&c, &b.id, &id, "Varek").is_err());
    let recovered = recover_page(&c, &a.id, &id, "Varek").unwrap();
    assert_eq!(recovered.id, id);
    assert_eq!(recovered.status, "stub");
    assert_eq!(backlinks(&c, &a.id, &id).unwrap().len(), 2);
    assert!(recover_page(&c, &a.id, &id, "Other").is_err());
}
#[test]
fn plain_brackets_do_not_assert_links_and_invalid_mentions_are_rejected() {
    let mut doc = journal::empty_document();
    doc["blocks"][0]["content"] =
        json!([{"type":"text","text":"[[Varek]] conosce [[Gilda]]","styles":{}}]);
    assert!(extract_mentions(&doc).unwrap().is_empty());
    doc["blocks"][0]["content"] =
        json!([{"type":"pageMention","props":{"pageId":"not-an-id","label":"Varek"}}]);
    assert!(extract_mentions(&doc).is_err());
}
#[test]
fn m1_migration_keeps_documents_and_is_applied_once() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("m1.sqlite3");
    let old = rusqlite::Connection::open(&path).unwrap();
    old.execute_batch(include_str!("../migrations/001_foundation.sql"))
        .unwrap();
    old.execute_batch(include_str!("../migrations/002_journal.sql"))
        .unwrap();
    let campaign = journal::create_campaign(&old, "M1").unwrap();
    let session = journal::create_session(&old, &campaign.id, 1, "Prima", None).unwrap();
    drop(old);
    for _ in 0..2 {
        let c = db::open(&path).unwrap();
        assert_eq!(
            journal::get_session(&c, &campaign.id, &session.id)
                .unwrap()
                .document,
            session.document
        );
        assert_eq!(
            c.query_row("SELECT COUNT(*) FROM schema_migrations", [], |r| r
                .get::<_, i64>(0))
                .unwrap(),
            db::LATEST_SCHEMA
        );
    }
}

#[test]
fn listed_pages_keep_their_own_sorted_aliases_within_the_campaign() {
    let d = tempfile::tempdir().unwrap();
    let c = crate::db::open(&d.path().join("test.sqlite3")).unwrap();
    let first = crate::journal::create_campaign(&c, "First").unwrap();
    let other = crate::journal::create_campaign(&c, "Other").unwrap();
    let a = create_page(
        &c,
        &first.id,
        "Alpha",
        "npc",
        "active",
        &["Zed".into(), "Ash".into()],
    )
    .unwrap();
    let b = create_page(&c, &first.id, "Beta", "place", "active", &[]).unwrap();
    create_page(&c, &other.id, "Gamma", "npc", "active", &["Ghost".into()]).unwrap();
    let pages = list_pages(&c, &first.id).unwrap();
    assert_eq!(pages.len(), 2);
    let find = |id: &str| pages.iter().find(|p| p.id == id).unwrap();
    assert_eq!(
        find(&a.id).aliases,
        vec!["Ash".to_string(), "Zed".to_string()]
    );
    assert!(find(&b.id).aliases.is_empty());
    assert_eq!(
        get_page(&c, &first.id, &a.id).unwrap().aliases,
        find(&a.id).aliases
    );
}
