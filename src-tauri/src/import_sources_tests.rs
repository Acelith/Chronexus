use crate::{backup, import_sources as sources, journal, knowledge};
#[test]
fn original_sources_are_immutable_scoped_and_preserved_in_backup() {
    let dir = tempfile::tempdir().unwrap();
    let store = backup::Store::open(&dir.path().join("source")).unwrap();
    let c = &store.connection;
    let a = journal::create_campaign(c, "A").unwrap();
    let b = journal::create_campaign(c, "B").unwrap();
    let p = knowledge::create_page(c, &a.id, "Fonte", "note", "active", &[]).unwrap();
    let raw = "type:: npc\r\n- [[Varek]] says something, it is not a confirmation.\r\n";
    let source = sources::add(c, &a.id, "page", &p.id, "pages/Fonte.md", raw).unwrap();
    assert!(sources::add(c, &a.id, "page", &p.id, "pages/Fonte.md", "Overwrite").is_err());
    assert!(sources::get(c, &b.id, "page", &p.id).unwrap().is_none());
    assert!(sources::add(c, &b.id, "page", &p.id, "pages/X.md", raw).is_err());
    assert!(sources::add(c, &a.id, "page", &p.id, "../escape.md", raw).is_err());
    let bundle = dir.path().join("source.nodex");
    backup::write_backup(c, &store.directory, &bundle).unwrap();
    let mut restored = backup::Store::open(&dir.path().join("restored")).unwrap();
    let preview = restored.prepare(&bundle).unwrap();
    restored.restore(&preview.token).unwrap();
    let actual = sources::get(&restored.connection, &a.id, "page", &p.id)
        .unwrap()
        .unwrap();
    assert_eq!(actual.content, raw);
    assert_eq!(actual.sha256, source.sha256);
    c.execute(
        "UPDATE import_sources SET content='altered' WHERE id=?1",
        [&source.id],
    )
    .unwrap();
    assert!(backup::write_backup(c, &store.directory, &dir.path().join("bad.nodex")).is_err());
}
