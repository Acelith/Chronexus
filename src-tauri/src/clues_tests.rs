use crate::{
    backup::{self, Store},
    clues, journal, knowledge, search,
};

fn input(page: &str, session: &str) -> clues::Input {
    clues::Input {
        kind: "question".into(),
        title: "Who took the seal?".into(),
        details: "The witness may be mistaken.".into(),
        certainty: "unknown".into(),
        status: "open".into(),
        sources: vec![clues::Source {
            kind: "session".into(),
            id: session.into(),
            block_id: Some("proof".into()),
        }],
        page_ids: vec![page.into()],
        resolution_session_id: None,
    }
}

#[test]
fn clue_lifecycle_keeps_source_and_page_ids_without_asserting_facts() {
    let temp = tempfile::tempdir().unwrap();
    let store = Store::open(&temp.path().join("data")).unwrap();
    let c = &store.connection;
    let campaign = journal::create_campaign(c, "Road").unwrap();
    let other = journal::create_campaign(c, "Other").unwrap();
    let page = knowledge::create_page(c, &campaign.id, "Witness", "npc", "active", &[]).unwrap();
    let session = journal::create_session(c, &campaign.id, 1, "Bridge", None).unwrap();
    let saved = clues::save(c, &campaign.id, None, None, input(&page.id, &session.id)).unwrap();
    assert_eq!(saved.sources[0].block_id.as_deref(), Some("proof"));
    assert_eq!(saved.page_ids, vec![page.id.clone()]);
    assert_eq!(
        c.query_row("SELECT count(*) FROM relationships", [], |r| r
            .get::<_, i64>(0))
            .unwrap(),
        0
    );
    assert!(clues::save(c, &other.id, None, None, input(&page.id, &session.id)).is_err());
    let renamed =
        knowledge::update_page(c, &campaign.id, &page.id, "New name", "npc", "active", &[]);
    assert!(renamed.is_ok());
    assert_eq!(
        clues::get(c, &campaign.id, &saved.id).unwrap().page_ids,
        vec![page.id.clone()]
    );
    let mut resolved = input(&page.id, &session.id);
    resolved.status = "resolved".into();
    resolved.certainty = "confirmed".into();
    resolved.resolution_session_id = Some(session.id.clone());
    let saved = clues::save(
        c,
        &campaign.id,
        Some(&saved.id),
        Some(saved.revision),
        resolved,
    )
    .unwrap();
    assert_eq!(saved.status, "resolved");
    assert!(clues::save(
        c,
        &campaign.id,
        Some(&saved.id),
        Some(0),
        input(&page.id, &session.id)
    )
    .is_err());
    let reopened = clues::save(
        c,
        &campaign.id,
        Some(&saved.id),
        Some(saved.revision),
        input(&page.id, &session.id),
    )
    .unwrap();
    assert_eq!(reopened.status, "open");
    assert_eq!(reopened.resolution_session_id, None);
    assert_eq!(
        c.query_row("SELECT count(*) FROM relationships", [], |r| r
            .get::<_, i64>(0))
            .unwrap(),
        0
    );
    let hits = search::find(c, &campaign.id, "witness", Some("clue"), "relevance").unwrap();
    assert!(hits.iter().any(|hit| hit.source_id == saved.id));
    clues::delete(c, &campaign.id, &saved.id, reopened.revision).unwrap();
    assert!(clues::list(c, &campaign.id).unwrap().is_empty());
}

#[test]
fn clues_survive_backup_restore_with_references() {
    let temp = tempfile::tempdir().unwrap();
    let source = Store::open(&temp.path().join("source")).unwrap();
    let c = &source.connection;
    let campaign = journal::create_campaign(c, "Road").unwrap();
    let page = knowledge::create_page(c, &campaign.id, "Witness", "npc", "active", &[]).unwrap();
    let session = journal::create_session(c, &campaign.id, 1, "Bridge", None).unwrap();
    let clue = clues::save(c, &campaign.id, None, None, input(&page.id, &session.id)).unwrap();
    let path = temp.path().join("backup.nodex");
    let receipt = backup::write_backup(c, &source.directory, &path).unwrap();
    assert_eq!(receipt.counts.clues, 1);
    let mut target = Store::open(&temp.path().join("target")).unwrap();
    let prepared = target.prepare(&path).unwrap();
    target.restore(&prepared.token).unwrap();
    let restored = clues::get(&target.connection, &campaign.id, &clue.id).unwrap();
    assert_eq!(restored.sources, clue.sources);
    assert_eq!(restored.page_ids, clue.page_ids);
}
