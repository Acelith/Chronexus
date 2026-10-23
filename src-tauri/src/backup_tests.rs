use crate::{backup::*, db, graph, journal, knowledge};
use serde_json::{json, Value};
use std::{
    fs::{self, File},
    io::{Read, Write},
    path::Path,
};
use uuid::Uuid;
use zip::{write::SimpleFileOptions, ZipArchive, ZipWriter};

fn seed(store: &Store) -> (String, String, String, String) {
    let c = &store.connection;
    let campaign = journal::create_campaign(c, "La via delle ceneri").unwrap();
    let v = knowledge::create_page(
        c,
        &campaign.id,
        "Varek",
        "npc",
        "active",
        &["Il testimone".into()],
    )
    .unwrap();
    let g = knowledge::create_page(c, &campaign.id, "Gilda", "faction", "stub", &[]).unwrap();
    let session =
        journal::create_session(c, &campaign.id, 12, "L'accusa", Some("2026-10-23".into()))
            .unwrap();
    let doc = json!({"version":1,"blocks":[{"id":"proof","type":"paragraph","props":{},"children":[],"content":[{"type":"text","text":"È una supposizione. ","styles":{}},{"type":"pageMention","props":{"pageId":v.id,"label":"Varek"}},{"type":"pageMention","props":{"pageId":g.id,"label":"Gilda"}}]}]});
    journal::save_document(c, &campaign.id, &session.id, 0, doc.clone()).unwrap();
    knowledge::save_page_document(c, &campaign.id, &v.id, 0, doc).unwrap();
    let relation = graph::save_relationship(
        c,
        &campaign.id,
        None,
        None,
        graph::RelationshipInput {
            from_page_id: v.id.clone(),
            to_page_id: g.id,
            label: "accusa".into(),
            certainty: "suspected".into(),
            source_kind: Some("session".into()),
            source_id: Some(session.id.clone()),
            source_block_id: Some("proof".into()),
            evidence: "Dichiarazione al ponte".into(),
            notes: "Da verificare".into(),
        },
    )
    .unwrap();
    let folder = store.directory.join("attachments").join(&campaign.id);
    fs::create_dir_all(&folder).unwrap();
    fs::write(
        folder.join(format!("{}.png", Uuid::new_v4())),
        b"\x89PNG\r\n\x1a\nfixture",
    )
    .unwrap();
    (campaign.id, session.id, v.id, relation.id)
}
fn query() -> graph::GraphQuery {
    graph::GraphQuery {
        kind: None,
        edge_kind: "all".into(),
        certainty: None,
        focus_id: None,
        depth: 1,
        session_id: None,
        search: String::new(),
    }
}
fn contents(path: &Path) -> Vec<(String, Vec<u8>)> {
    let mut zip = ZipArchive::new(File::open(path).unwrap()).unwrap();
    (0..zip.len())
        .map(|i| {
            let mut f = zip.by_index(i).unwrap();
            let name = f.name().unwrap().into_owned();
            let mut bytes = vec![];
            f.read_to_end(&mut bytes).unwrap();
            (name, bytes)
        })
        .collect()
}
fn rewrite(path: &Path, entries: Vec<(String, Vec<u8>)>) {
    let mut zip = ZipWriter::new(File::create(path).unwrap());
    for (name, bytes) in entries {
        zip.start_file(name, SimpleFileOptions::default()).unwrap();
        zip.write_all(&bytes).unwrap();
    }
    zip.finish().unwrap();
}
#[test]
fn backup_restore_round_trip_preserves_all_campaigns_documents_links_relationships_and_attachments()
{
    let temp = tempfile::tempdir().unwrap();
    let source = Store::open(&temp.path().join("source")).unwrap();
    let (campaign, session, page, relation) = seed(&source);
    journal::create_campaign(&source.connection, "Seconda campagna").unwrap();
    // A WAL write is visible in the snapshot, without raw copying the live DB.
    source
        .connection
        .pragma_update(None, "journal_mode", "WAL")
        .unwrap();
    journal::rename_campaign(&source.connection, &campaign, "Ceneri persistenti").unwrap();
    let before_graph =
        serde_json::to_value(graph::graph(&source.connection, &campaign, query()).unwrap())
            .unwrap();
    let before_sessions =
        serde_json::to_value(journal::list_sessions(&source.connection, &campaign).unwrap())
            .unwrap();
    let before_pages =
        serde_json::to_value(knowledge::list_pages(&source.connection, &campaign).unwrap())
            .unwrap();
    let bundle = temp.path().join("portable.nodex");
    let receipt = write_backup(&source.connection, &source.directory, &bundle).unwrap();
    assert_eq!(
        receipt.counts,
        Counts {
            campaigns: 2,
            sessions: 1,
            pages: 2,
            mentions: 4,
            relationships: 1,
            attachments: 1,
            ..Default::default()
        }
    );
    let target_root = temp.path().join("fresh");
    let mut target = Store::open(&target_root).unwrap();
    let old = journal::create_campaign(&target.connection, "Da proteggere").unwrap();
    let preview = target.prepare(&bundle).unwrap();
    assert_eq!(
        journal::list_campaigns(&target.connection).unwrap()[0].id,
        old.id
    );
    let restored = target.restore(&preview.token).unwrap();
    assert!(Path::new(&restored.safety_path).is_file());
    assert!(restored.warning.is_none());
    assert!(target_root.join("nodex.sqlite3").is_file());
    assert_eq!(
        serde_json::to_value(journal::list_sessions(&target.connection, &campaign).unwrap())
            .unwrap(),
        before_sessions
    );
    assert_eq!(
        serde_json::to_value(knowledge::list_pages(&target.connection, &campaign).unwrap())
            .unwrap(),
        before_pages
    );
    assert_eq!(
        serde_json::to_value(graph::graph(&target.connection, &campaign, query()).unwrap())
            .unwrap(),
        before_graph
    );
    assert_eq!(
        graph::get_relationship(&target.connection, &campaign, &relation)
            .unwrap()
            .input
            .source_id,
        Some(session)
    );
    assert_eq!(
        knowledge::backlinks(&target.connection, &campaign, &page)
            .unwrap()
            .len(),
        2
    );
    let attachment_path = fs::read_dir(target.directory.join("attachments").join(&campaign))
        .unwrap()
        .next()
        .unwrap()
        .unwrap()
        .path();
    assert_eq!(
        fs::read(attachment_path).unwrap(),
        b"\x89PNG\r\n\x1a\nfixture"
    );
    let active = target.directory.clone();
    drop(target);
    let mut target = Store::open(&target_root).unwrap();
    assert_eq!(target.directory, active);
    assert_eq!(
        journal::list_campaigns(&target.connection).unwrap().len(),
        2
    );
    // Safety copy is itself a portable restore route.
    let safety = target.prepare(Path::new(&restored.safety_path)).unwrap();
    target.restore(&safety.token).unwrap();
    assert_eq!(
        journal::list_campaigns(&target.connection).unwrap()[0].id,
        old.id
    );
}
#[test]
fn refuses_overwrite_bad_destination_and_parallel_profile_writers() {
    let temp = tempfile::tempdir().unwrap();
    let root = temp.path().join("profile");
    let store = Store::open(&root).unwrap();
    seed(&store);
    assert!(Store::open(&root).is_err());
    let path = temp.path().join("existing.nodex");
    fs::write(&path, b"original").unwrap();
    assert!(write_backup(&store.connection, &store.directory, &path).is_err());
    assert_eq!(fs::read(&path).unwrap(), b"original");
    assert!(write_backup(
        &store.connection,
        &store.directory,
        &temp.path().join("absent/x.nodex")
    )
    .is_err());
    assert!(write_backup(
        &store.connection,
        &store.directory,
        Path::new("relative.nodex")
    )
    .is_err());
    assert!(write_backup(
        &store.connection,
        &store.directory,
        &temp.path().join("bad.sqlite3")
    )
    .is_err());
}
#[test]
fn rejects_unsafe_paths_duplicates_and_symlink_entries_before_extracting() {
    let temp = tempfile::tempdir().unwrap();
    let store = Store::open(&temp.path().join("source")).unwrap();
    seed(&store);
    let valid = temp.path().join("valid.nodex");
    write_backup(&store.connection, &store.directory, &valid).unwrap();
    for name in [
        "../escape",
        "/absolute",
        "C:/escape",
        "attachments/../../escape",
        "attachments\\escape",
        "data/../nodex.sqlite3",
    ] {
        let mut entries = contents(&valid);
        entries.push((name.into(), b"bad".to_vec()));
        let bad = temp.path().join("bad.nodex");
        rewrite(&bad, entries);
        assert!(prepare_restore(&bad, temp.path()).is_err(), "{name}");
    }
    let bad = temp.path().join("duplicate.nodex");
    // zip writer rejects duplicates itself; construct equivalent duplicate central-directory
    // names by rewriting an equal-length file name in the raw ZIP bytes.
    rewrite(
        &bad,
        vec![
            ("manifest.json".into(), b"{}".to_vec()),
            ("manifesx.json".into(), b"{}".to_vec()),
        ],
    );
    let bytes = fs::read(&bad).unwrap();
    let mut bytes = bytes;
    for index in 0..bytes.len() - 13 {
        if &bytes[index..index + 13] == b"manifesx.json" {
            bytes[index + 7] = b't';
        }
    }
    fs::write(&bad, bytes).unwrap();
    assert!(prepare_restore(&bad, temp.path()).is_err());
    let symlink = temp.path().join("symlink.nodex");
    let mut zip = ZipWriter::new(File::create(&symlink).unwrap());
    zip.add_symlink(
        "manifest.json",
        "../elsewhere",
        SimpleFileOptions::default(),
    )
    .unwrap();
    zip.start_file("data/nodex.sqlite3", SimpleFileOptions::default())
        .unwrap();
    zip.finish().unwrap();
    assert!(prepare_restore(&symlink, temp.path()).is_err());
    assert!(!temp.path().join("escape").exists());
}
#[test]
fn corruption_future_format_unknown_files_and_wrong_counts_preserve_current_data() {
    let temp = tempfile::tempdir().unwrap();
    let mut store = Store::open(&temp.path().join("profile")).unwrap();
    seed(&store);
    let valid = temp.path().join("valid.nodex");
    write_backup(&store.connection, &store.directory, &valid).unwrap();
    for scenario in 0..7 {
        let mut entries = contents(&valid);
        let manifest_index = entries
            .iter()
            .position(|(n, _)| n == "manifest.json")
            .unwrap();
        let mut manifest: Value = serde_json::from_slice(&entries[manifest_index].1).unwrap();
        match scenario {
            0 => {
                entries
                    .iter_mut()
                    .find(|(n, _)| n == "data/nodex.sqlite3")
                    .unwrap()
                    .1[0] ^= 1;
            }
            1 => {
                manifest["format_version"] = json!(999);
            }
            2 => {
                manifest["schema_version"] = json!(999);
            }
            3 => {
                manifest["counts"]["sessions"] = json!(999);
            }
            4 => {
                entries.push(("extra.txt".into(), vec![]));
            }
            5 => {
                entries.retain(|(n, _)| !n.starts_with("attachments/"));
            }
            _ => {
                manifest["files"][0]["size"] = json!(u64::MAX);
            }
        }
        entries
            .iter_mut()
            .find(|(n, _)| n == "manifest.json")
            .unwrap()
            .1 = serde_json::to_vec(&manifest).unwrap();
        let bad = temp.path().join("bad.nodex");
        rewrite(&bad, entries);
        assert!(store.prepare(&bad).is_err(), "scenario {scenario}");
        assert!(store.pending.is_none());
        assert_eq!(journal::list_campaigns(&store.connection).unwrap().len(), 1);
        assert!(!store.root.join("active-profile.json").exists());
    }
}
#[test]
fn damaged_database_with_matching_checksum_and_unexpected_schema_are_rejected() {
    let temp = tempfile::tempdir().unwrap();
    let store = Store::open(&temp.path().join("profile")).unwrap();
    seed(&store);
    let valid = temp.path().join("valid.nodex");
    write_backup(&store.connection, &store.directory, &valid).unwrap();
    for scenario in 0..3 {
        let mut entries = contents(&valid);
        let db = entries
            .iter_mut()
            .find(|(n, _)| n == "data/nodex.sqlite3")
            .unwrap();
        if scenario != 0 {
            let path = temp.path().join("edit.sqlite3");
            fs::write(&path, &db.1).unwrap();
            let c = rusqlite::Connection::open(&path).unwrap();
            let name = if scenario == 1 {
                "unexpected"
            } else {
                "sqliteXunexpected"
            };
            c.execute_batch(&format!(
                "CREATE TRIGGER {name} AFTER INSERT ON campaigns BEGIN DELETE FROM sessions; END;"
            ))
            .unwrap();
            drop(c);
            db.1 = fs::read(&path).unwrap();
        } else {
            db.1 = b"not SQLite".to_vec();
        }
        use sha2::{Digest, Sha256};
        let size = db.1.len();
        let hash = format!("{:x}", Sha256::digest(&db.1));
        let manifest = entries
            .iter_mut()
            .find(|(n, _)| n == "manifest.json")
            .unwrap();
        let mut m: Value = serde_json::from_slice(&manifest.1).unwrap();
        m["files"][0]["size"] = json!(size);
        m["files"][0]["sha256"] = json!(hash);
        manifest.1 = serde_json::to_vec(&m).unwrap();
        let bad = temp.path().join("bad.nodex");
        rewrite(&bad, entries);
        assert!(prepare_restore(&bad, temp.path()).is_err());
    }
}
#[test]
fn cancelled_token_failed_safety_copy_and_failed_activation_never_replace_current_archive() {
    let temp = tempfile::tempdir().unwrap();
    let mut store = Store::open(&temp.path().join("profile")).unwrap();
    seed(&store);
    let valid = temp.path().join("valid.nodex");
    write_backup(&store.connection, &store.directory, &valid).unwrap();
    let preview = store.prepare(&valid).unwrap();
    store.pending = None;
    assert!(store.restore(&preview.token).is_err());
    let preview = store.prepare(&valid).unwrap();
    fs::write(store.root.join("backups"), b"blocked").unwrap();
    assert!(store.restore(&preview.token).is_err());
    assert!(!store.root.join("active-profile.json").exists());
    fs::remove_file(store.root.join("backups")).unwrap();
    let preview = store.prepare(&valid).unwrap();
    fs::create_dir(store.root.join("active-profile.json")).unwrap();
    assert!(store.restore(&preview.token).is_err());
    assert_eq!(store.directory, store.root);
    assert_eq!(journal::list_campaigns(&store.connection).unwrap().len(), 1);
    assert!(fs::read_dir(store.root.join("backups"))
        .unwrap()
        .next()
        .is_some());
}
#[test]
fn old_schema_snapshot_is_validated_then_migrated_in_new_generation() {
    let temp = tempfile::tempdir().unwrap();
    let root = temp.path().join("legacy");
    fs::create_dir(&root).unwrap();
    let c = rusqlite::Connection::open(root.join("nodex.sqlite3")).unwrap();
    c.execute_batch(include_str!("../migrations/001_foundation.sql"))
        .unwrap();
    c.execute_batch(include_str!("../migrations/002_journal.sql"))
        .unwrap();
    let campaign = journal::create_campaign(&c, "M1 preservata").unwrap();
    let session = journal::create_session(&c, &campaign.id, 1, "Inizio", None).unwrap();
    let file = temp.path().join("m1.nodex");
    write_backup(&c, &root, &file).unwrap();
    drop(c);
    let mut store = Store::open(&temp.path().join("target")).unwrap();
    let preview = store.prepare(&file).unwrap();
    store.restore(&preview.token).unwrap();
    assert_eq!(
        journal::list_sessions(&store.connection, &campaign.id).unwrap()[0].id,
        session.id
    );
    let migrations: i64 = store
        .connection
        .query_row("SELECT MAX(version) FROM schema_migrations", [], |r| {
            r.get(0)
        })
        .unwrap();
    assert_eq!(migrations, db::LATEST_SCHEMA);
    assert!(knowledge::list_pages(&store.connection, &campaign.id)
        .unwrap()
        .is_empty());
    assert!(db::open(&store.directory.join("nodex.sqlite3")).is_ok());
}

#[cfg(windows)]
#[test]
fn restore_with_directory_handle_without_delete_sharing_keeps_attachment_copy_working() {
    use std::os::windows::fs::OpenOptionsExt;
    let temp = tempfile::tempdir().unwrap();
    let mut store = Store::open(&temp.path().join("profile")).unwrap();
    let (campaign, _, _, _) = seed(&store);
    let bundle = temp.path().join("bundle.nodex");
    write_backup(&store.connection, &store.directory, &bundle).unwrap();
    let preview = store.prepare(&bundle).unwrap();
    let source = store
        .pending
        .as_ref()
        .unwrap()
        .directory
        .path()
        .join("attachments");
    // Emulates an indexer or other reader retaining a directory handle.
    let handle = File::options()
        .read(true)
        .share_mode(0x1 | 0x2)
        .custom_flags(0x02000000)
        .open(&source)
        .unwrap();
    assert!(fs::rename(&source, source.with_file_name("moved-attachments")).is_err());
    let receipt = store.restore(&preview.token).unwrap();
    assert_eq!(receipt.counts.attachments, 1);
    assert_eq!(
        fs::read_dir(store.directory.join("attachments").join(campaign))
            .unwrap()
            .count(),
        1
    );
    drop(handle);
}
