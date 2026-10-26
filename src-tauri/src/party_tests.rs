use crate::{backup, journal, knowledge, party};
#[test]
fn party_preserves_codex_identity_through_rename_removal_and_restore() {
    let d = tempfile::tempdir().unwrap();
    let store = backup::Store::open(&d.path().join("profile")).unwrap();
    let c = &store.connection;
    let a = journal::create_campaign(c, "A").unwrap();
    let b = journal::create_campaign(c, "B").unwrap();
    let mut input = party::MemberInput {
        page_id: None,
        name: "Compagno".into(),
        player_name: "Giocatore".into(),
        role: "Esploratore".into(),
        status: "active".into(),
        revision: None,
    };
    let saved = party::save(c, &a.id, &input).unwrap();
    assert_eq!(knowledge::list_pages(c, &a.id).unwrap().len(), 1);
    input.page_id = Some(saved.page.id.clone());
    assert!(party::save(c, &a.id, &input).is_err());
    assert!(party::save(c, &b.id, &input).is_err());
    input.revision = Some(0);
    input.role = "Cartografo".into();
    let updated = party::save(c, &a.id, &input).unwrap();
    assert_eq!(updated.revision, 1);
    assert!(party::save(c, &a.id, &input).is_err());
    knowledge::update_page(c, &a.id, &saved.page.id, "New name", "npc", "active", &[]).unwrap();
    assert_eq!(party::list(c, &a.id).unwrap()[0].page.title, "New name");
    let file = d.path().join("party.nodex");
    backup::write_backup(c, &store.directory, &file).unwrap();
    let mut restored = backup::Store::open(&d.path().join("restored")).unwrap();
    let preview = restored.prepare(&file).unwrap();
    restored.restore(&preview.token).unwrap();
    assert_eq!(
        party::list(&restored.connection, &a.id).unwrap()[0].page.id,
        saved.page.id
    );
    party::remove(c, &a.id, &saved.page.id, 1).unwrap();
    assert!(party::list(c, &a.id).unwrap().is_empty());
    assert!(knowledge::get_page(c, &a.id, &saved.page.id).is_ok());
    input.page_id = None;
    input.revision = None;
    input.name = "Not created".into();
    input.status = "spoiler".into();
    assert!(party::save(c, &a.id, &input).is_err());
    assert_eq!(knowledge::list_pages(c, &a.id).unwrap().len(), 1);
}
