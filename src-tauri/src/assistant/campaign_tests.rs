use super::campaign::*;
use crate::{db, journal, knowledge};
use serde_json::json;
use std::path::Path;

#[test]
fn preferences_and_freshness_are_scoped_persistent_and_backend_owned() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("test.sqlite3");
    let c = db::open(&path).unwrap();
    let a = journal::create_campaign(&c, "A").unwrap();
    let b = journal::create_campaign(&c, "B").unwrap();
    let page = knowledge::create_page(&c, &a.id, "Mirna", "npc", "active", &[]).unwrap();
    knowledge::save_page_document(&c,&a.id,&page.id,0,json!({"version":1,"blocks":[{"id":"block-a","type":"paragraph","props":{},"content":[{"type":"text","text":"Mirna dice di essere una maga.","styles":{}}],"children":[]}]})).unwrap();
    let first = overview(&c, &a.id).unwrap();
    assert_eq!(first.added, 1);
    assert!(!first.profile.settings.enabled);
    let mut malicious = first.profile.clone();
    malicious.settings.enabled = true;
    malicious.settings.model = "qwen3:4b-instruct".into();
    malicious.settings.digest = "a".repeat(64);
    malicious.indexed_at = Some("inventata".into());
    let p = save_preferences(&c, &a.id, &malicious).unwrap();
    assert!(!p.settings.enabled);
    assert_eq!(p.indexed_at, None);
    let updated = refresh(&c, &a.id).unwrap();
    assert_eq!(updated.added, 0);
    assert!(updated.profile.indexed_at.is_some());
    let mut profile = updated.profile;
    profile.excluded_ids = vec![page.id.clone()];
    save_preferences(&c, &a.id, &profile).unwrap();
    assert_eq!(overview(&c, &a.id).unwrap().removed, 1);
    assert!(save_preferences(&c, &b.id, &profile).is_err());
    assert!(get(&c, &b.id).unwrap().manifest.is_empty());
    drop(c);
    let reopened = db::open(&path).unwrap();
    assert_eq!(get(&reopened, &a.id).unwrap().excluded_ids, vec![page.id]);
}
#[test]
fn migration_preserves_m7_choice_without_enabling_future_campaigns() {
    let c = rusqlite::Connection::open_in_memory().unwrap();
    for migration in db::MIGRATIONS.iter().take(12) {
        c.execute_batch(migration).unwrap();
    }
    let a = journal::create_campaign(&c, "Prima").unwrap();
    c.execute(
        "UPDATE assistant_settings SET enabled=1,model='qwen3:4b-instruct',digest=?1",
        ["a".repeat(64)],
    )
    .unwrap();
    c.execute_batch(db::MIGRATIONS[12]).unwrap();
    assert!(get(&c, &a.id).unwrap().settings.enabled);
    let b = journal::create_campaign(&c, "Dopo").unwrap();
    assert!(!get(&c, &b.id).unwrap().settings.enabled);
}
#[test]
fn sources_and_limits_reject_foreign_editions_and_invalid_preferences() {
    let c = db::open(Path::new(":memory:")).unwrap();
    let a = journal::create_campaign(&c, "A").unwrap();
    let mut p = Profile {
        context: 100000,
        ..Profile::default()
    };
    assert!(save_preferences(&c, &a.id, &p).is_err());
    p.context = 8192;
    p.rule_keys = vec!["entry/missing".into()];
    assert!(save_preferences(&c, &a.id, &p).is_err());
    p.rule_keys.clear();
    p.include_kinds = vec!["conversation".into()];
    assert!(save_preferences(&c, &a.id, &p).is_err());
}
