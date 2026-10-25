use super::*;
use crate::{backup, db, journal};

fn seed(c: &Connection) {
    crate::wiki::store(c,"entry/spells/test",json!({"entry":{"key":"test","name":"Test Light","desc":"Light for 1 minute, 30 feet. Deal 1d4 damage.","document":{"key":"srd"}},"document":{"key":"srd","name":"Test SRD","licenses":[]}})).unwrap();
}
fn translation(c: &Connection) -> Translation {
    Translation {
        locale: "it".into(),
        source_hash: source(c, "open5e", "entry/spells/test").unwrap().2,
        model: crate::assistant::models::policy()
            .unwrap()
            .primary
            .name
            .clone(),
        model_digest: "a".repeat(64),
        revision: REVISION.into(),
        title: "Luce di prova".into(),
        blocks: vec![Block::Paragraph {
            text: "Luce per 1 minuto, 30 piedi. Infligge 1d4 danni.".into(),
        }],
    }
}
#[test]
fn cache_is_bound_to_provider_language_original_and_survives_backup_restore() {
    let d = tempfile::tempdir().unwrap();
    let mut s = backup::Store::open(&d.path().join("profile")).unwrap();
    journal::create_campaign(&s.connection, "Prova sintetica").unwrap();
    seed(&s.connection);
    let t = translation(&s.connection);
    store(&s.connection, "open5e", "entry/spells/test", &t).unwrap();
    assert!(cached(&s.connection, "open5e", "entry/spells/test", "de")
        .unwrap()
        .is_none());
    let file = d.path().join("translation.nodex");
    backup::write_backup(&s.connection, &s.directory, &file).unwrap();
    let preview = s.prepare(&file).unwrap();
    s.restore(&preview.token).unwrap();
    assert_eq!(
        cached(&s.connection, "open5e", "entry/spells/test", "it")
            .unwrap()
            .unwrap()
            .title,
        t.title
    );
    let before = crate::wiki::read(&s.connection, "entry/spells/test")
        .unwrap()
        .unwrap()
        .payload;
    wikidot::clear(&s.connection, "wikidot").unwrap();
    assert!(cached(&s.connection, "open5e", "entry/spells/test", "it")
        .unwrap()
        .is_some());
    seed(&s.connection);
    assert_eq!(
        before,
        crate::wiki::read(&s.connection, "entry/spells/test")
            .unwrap()
            .unwrap()
            .payload
    );
    crate::wiki::store(&s.connection,"entry/spells/test",json!({"entry":{"key":"test","name":"Changed","document":{"key":"srd"}},"document":{"key":"srd"}})).unwrap();
    assert!(cached(&s.connection, "open5e", "entry/spells/test", "it")
        .unwrap()
        .is_none());
    assert!(store(&s.connection, "open5e", "entry/spells/test", &t).is_err());
    wikidot::clear(&s.connection, "open5e").unwrap();
    let n: i64 = s
        .connection
        .query_row("SELECT COUNT(*) FROM wiki_translations", [], |r| r.get(0))
        .unwrap();
    assert_eq!(n, 0);
}
#[test]
fn model_output_rejects_missing_rows_changed_numbers_and_truncation() {
    let input = vec!["Deals 2d6 damage in 30 feet.".into()];
    let valid = json!({"done":true,"message":{"content":"{\"translations\":[\"Infligge 2d6 danni entro 30 piedi.\"]}"}});
    assert!(checked_output(&input, &valid).is_ok());
    for bad in [
        json!({"done":true,"message":{"content":"[]"}}),
        json!({"done":true,"message":{"content":"{\"translations\":[\"Infligge 3d6 danni entro 30 piedi.\"]}"}}),
        json!({"done":true,"done_reason":"length","message":{"content":"[]"}}),
    ] {
        assert!(checked_output(&input, &bad).is_err());
    }
    assert!(language("tlh").is_err());
    assert!(language("art-x-rihan").is_err());
    assert!(language("it;execute").is_err());
}
#[test]
fn structured_slots_preserve_tables_and_lists_without_executing_markup() {
    let mut title = "Title".into();
    let mut blocks = vec![
        Block::Table {
            rows: vec![vec!["<script>bad()</script>".into(), "2d6".into()]],
        },
        Block::List {
            items: vec!["one".into(), "two".into()],
        },
    ];
    slots(&mut title, &mut blocks, |text| {
        *text = format!("T:{text}");
        Ok(())
    })
    .unwrap();
    assert_eq!(
        blocks[0],
        Block::Table {
            rows: vec![vec!["T:<script>bad()</script>".into(), "T:2d6".into()]]
        }
    );
}
#[test]
fn migration_from_016_keeps_original_sources() {
    let d = tempfile::tempdir().unwrap();
    let path = d.path().join("old.sqlite3");
    let c = Connection::open(&path).unwrap();
    for migration in db::MIGRATIONS.iter().take(16) {
        c.execute_batch(migration).unwrap();
    }
    seed(&c);
    drop(c);
    let c = db::open(&path).unwrap();
    assert!(source(&c, "open5e", "entry/spells/test").is_ok());
    assert!(cached(&c, "open5e", "entry/spells/test", "it")
        .unwrap()
        .is_none());
}

#[test]
fn retired_translation_is_valid_archive_data_but_never_reused_as_a_new_model_copy() {
    let d = tempfile::tempdir().unwrap();
    let mut archive = backup::Store::open(&d.path().join("profile")).unwrap();
    journal::create_campaign(&archive.connection, "Prova cache storica").unwrap();
    seed(&archive.connection);
    let mut old = translation(&archive.connection);
    old.model = "qwen3:4b-instruct".into();
    old.revision = "wiki-translation-v1".into();
    let raw = serde_json::to_string(&old).unwrap();
    archive.connection.execute("INSERT INTO wiki_translations(provider,source_key,locale,source_hash,payload) VALUES('open5e','entry/spells/test','it',?1,?2)",params![old.source_hash,raw]).unwrap();
    validate_archive(&archive.connection).unwrap();
    assert!(
        cached(&archive.connection, "open5e", "entry/spells/test", "it")
            .unwrap()
            .is_none()
    );
    let file = d.path().join("historical-cache.nodex");
    backup::write_backup(&archive.connection, &archive.directory, &file).unwrap();
    let p = archive.prepare(&file).unwrap();
    archive.restore(&p.token).unwrap();
    let preserved: String = archive
        .connection
        .query_row("SELECT payload FROM wiki_translations", [], |r| r.get(0))
        .unwrap();
    assert_eq!(preserved, raw);
    let mut current = translation(&archive.connection);
    current.model = models::policy().unwrap().secondary.name.clone();
    store(&archive.connection, "open5e", "entry/spells/test", &current).unwrap();
    assert!(
        cached(&archive.connection, "open5e", "entry/spells/test", "it")
            .unwrap()
            .is_none()
    );
    assert!(cached_for(
        &archive.connection,
        "open5e",
        "entry/spells/test",
        "it",
        &current.model
    )
    .unwrap()
    .is_some());
    assert!(cached_for(
        &archive.connection,
        "open5e",
        "entry/spells/test",
        "it",
        "qwen3:4b-instruct"
    )
    .is_err());
}

#[test]
fn wikidot_translation_keeps_provenance_and_separate_provider_cache() {
    let c = db::open(std::path::Path::new(":memory:")).unwrap();
    let e=wikidot::parse::entry(r#"<div class="page-title">Test Light</div><div id="page-content"><p>Source: Synthetic Handbook</p><p>A light for 1 minute.</p><table><tr><td>1</td><td>Light</td></tr></table></div>"#,"spell:test-light").unwrap();
    let original = serde_json::to_value(&e).unwrap();
    wikidot::store(&c, "entry/spell:test-light", &original).unwrap();
    seed(&c);
    let (title, blocks, hash) = source(&c, "wikidot", "spell:test-light").unwrap();
    let mut t = translation(&c);
    t.title = title;
    t.blocks = blocks;
    t.source_hash = hash;
    store(&c, "wikidot", "spell:test-light", &t).unwrap();
    store(&c, "open5e", "entry/spells/test", &translation(&c)).unwrap();
    assert!(cached(&c, "wikidot", "spell:test-light", "it")
        .unwrap()
        .is_some());
    assert_eq!(
        serde_json::to_value(
            wikidot::read_entry(&c, "spell:test-light")
                .unwrap()
                .unwrap()
                .0
        )
        .unwrap(),
        original
    );
    wikidot::clear(&c, "wikidot").unwrap();
    assert!(cached(&c, "open5e", "entry/spells/test", "it")
        .unwrap()
        .is_some());
    let n: i64 = c
        .query_row(
            "SELECT COUNT(*) FROM wiki_translations WHERE provider='wikidot'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(n, 0);
}
