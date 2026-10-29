use crate::{backup, clues, demo, images, journal, knowledge, player};
use image::{DynamicImage, ImageFormat};
use rusqlite::Connection;
use std::{collections::BTreeMap, io::Cursor};

/// Row count of every table, to prove a removal leaves nothing behind.
fn counts(c: &Connection) -> BTreeMap<String, i64> {
    let mut statement = c
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'search_fts%' AND name NOT LIKE 'sqlite_%'")
        .unwrap();
    let tables: Vec<String> = statement
        .query_map([], |r| r.get(0))
        .unwrap()
        .map(Result::unwrap)
        .collect();
    tables
        .into_iter()
        .map(|t| {
            let n = c
                .query_row(&format!("SELECT count(*) FROM \"{t}\""), [], |r| r.get(0))
                .unwrap();
            (t, n)
        })
        .collect()
}

fn png() -> Vec<u8> {
    let mut buffer = Cursor::new(vec![]);
    DynamicImage::new_rgb8(2, 2)
        .write_to(&mut buffer, ImageFormat::Png)
        .unwrap();
    buffer.into_inner()
}

#[test]
fn demo_contains_every_main_view_and_is_labelled() {
    let dir = tempfile::tempdir().unwrap();
    let store = backup::Store::open(&dir.path().join("profile")).unwrap();
    let c = &store.connection;
    let real = journal::create_campaign(c, "My campaign").unwrap();
    let demo = demo::create(c, &store.directory, &demo::sample()).unwrap();
    assert!(demo.demo);
    // Campaigns created in the same millisecond have no fixed order: compare as a set.
    let mut listed: Vec<_> = journal::list_campaigns(c)
        .unwrap()
        .into_iter()
        .map(|x| (x.name, x.demo))
        .collect();
    listed.sort();
    assert_eq!(
        listed,
        vec![
            ("Demo — The Salt Tower".to_string(), true),
            ("My campaign".to_string(), false)
        ]
    );
    assert!(!journal::rename_campaign(c, &real.id, "Mine").unwrap().demo);
    assert!(journal::rename_campaign(c, &demo.id, "Demo").unwrap().demo);

    assert_eq!(knowledge::list_pages(c, &demo.id).unwrap().len(), 4);
    let sessions = journal::list_sessions(c, &demo.id).unwrap();
    assert_eq!(sessions.len(), 2);
    let mentions = knowledge::extract_mentions(&sessions[0].document).unwrap();
    assert_eq!(
        mentions
            .iter()
            .map(|m| m.label.as_str())
            .collect::<Vec<_>>(),
        vec!["Harrowgate", "Mira", "Mira", "Baron Aldric"]
    );
    let mut certainties: Vec<String> = c
        .prepare("SELECT certainty FROM relationships WHERE campaign_id=?1")
        .unwrap()
        .query_map([&demo.id], |r| r.get(0))
        .unwrap()
        .map(Result::unwrap)
        .collect();
    certainties.sort();
    assert_eq!(certainties, vec!["confirmed", "confirmed", "suspected"]);
    let board = clues::list(c, &demo.id).unwrap();
    assert_eq!(board.len(), 2);
    assert!(board
        .iter()
        .all(|x| x.status == "open" && x.certainty == "unknown"));
    assert_eq!(
        player::get_character(c, &demo.id)
            .unwrap()
            .unwrap()
            .data
            .name,
        "Ilsa Marrow"
    );
    // The real campaign is untouched and only one demo may exist.
    assert!(knowledge::list_pages(c, &real.id).unwrap().is_empty());
    assert!(demo::create(c, &store.directory, &demo::sample()).is_err());
    assert_eq!(
        demo::first_start(c).unwrap().demo_campaign_id.as_deref(),
        Some(demo.id.as_str())
    );
}

#[test]
fn removing_the_demo_leaves_no_residue_and_keeps_real_campaigns() {
    let dir = tempfile::tempdir().unwrap();
    let store = backup::Store::open(&dir.path().join("profile")).unwrap();
    let c = &store.connection;
    let real = journal::create_campaign(c, "Real").unwrap();
    let page =
        knowledge::create_page(c, &real.id, "Varek", "npc", "active", &["Keeper".into()]).unwrap();
    let target = |id: &str| images::ImageTarget {
        kind: "page".into(),
        id: id.into(),
    };
    images::add(
        c,
        &store.directory,
        &real.id,
        &target(&page.id),
        "Face",
        "portrait",
        png(),
    )
    .unwrap();
    let before = counts(c);

    let demo = demo::create(c, &store.directory, &demo::sample()).unwrap();
    // The user plays with the demo: an image, a new page with an alias, a dice roll.
    let mira = knowledge::list_pages(c, &demo.id).unwrap()[0].id.clone();
    images::add(
        c,
        &store.directory,
        &demo.id,
        &target(&mira),
        "Map",
        "map",
        png(),
    )
    .unwrap();
    knowledge::create_page(c, &demo.id, "Extra", "lore", "stub", &["Alias".into()]).unwrap();
    crate::dice::roll(
        c,
        &demo.id,
        &uuid::Uuid::now_v7().to_string(),
        &[serde_json::from_value(serde_json::json!({"sides":20,"quantity":1})).unwrap()],
    )
    .unwrap();
    let folder = store.directory.join("attachments").join(&demo.id);
    assert!(folder.is_dir());
    assert_ne!(counts(c), before);

    assert!(demo::remove(c, &store.directory, &real.id).is_err());
    demo::remove(c, &store.directory, &demo.id).unwrap();
    assert_eq!(counts(c), before);
    assert!(!folder.exists());
    assert!(store.directory.join("attachments").join(&real.id).is_dir());
    assert_eq!(demo::first_start(c).unwrap().demo_campaign_id, None);
    // The real campaign's images still validate.
    images::validate_files(c, &store.directory).unwrap();
    // A new demo can be created afterwards.
    demo::create(c, &store.directory, &demo::sample()).unwrap();
}

#[test]
fn broken_translation_creates_nothing() {
    let dir = tempfile::tempdir().unwrap();
    let store = backup::Store::open(&dir.path().join("profile")).unwrap();
    let c = &store.connection;
    let before = counts(c);
    for broken in [
        demo::DemoText {
            session1_claim: "{0} told us something.".into(),
            ..demo::sample()
        },
        demo::DemoText {
            session2_path: "{0} and {0}".into(),
            ..demo::sample()
        },
        demo::DemoText {
            rumour: " ".into(),
            ..demo::sample()
        },
        demo::DemoText {
            character_notes: "x".repeat(601),
            ..demo::sample()
        },
    ] {
        assert!(demo::create(c, &store.directory, &broken).is_err());
        assert_eq!(counts(c), before);
    }
}

#[test]
fn demo_is_never_shared_or_trained_and_the_tour_flag_persists() {
    let dir = tempfile::tempdir().unwrap();
    let store = backup::Store::open(&dir.path().join("profile")).unwrap();
    let c = &store.connection;
    let real = journal::create_campaign(c, "Real").unwrap();
    let demo = demo::create(c, &store.directory, &demo::sample()).unwrap();
    assert!(demo::refuse(c, &demo.id).is_err());
    demo::refuse(c, &real.id).unwrap();
    assert!(!demo::first_start(c).unwrap().tour_seen);
    assert!(demo::set_tour_seen(c, true).unwrap().tour_seen);
    assert!(demo::set_tour_seen(c, true).unwrap().tour_seen);
    assert!(!demo::set_tour_seen(c, false).unwrap().tour_seen);
}
