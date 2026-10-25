use super::*;
#[test]
fn english_interface_keeps_backups_created_in_the_legacy_documents_folders_visible() {
    let (dir, store) = store();
    let documents = dir.path().join("Documents");
    let old_folder = documents.join("Chronexus").join("Backup periodici");
    fs::create_dir_all(&old_folder).unwrap();
    let old_file = old_folder.join("manual-before-english.nodex");
    backup::write_backup(&store.connection, &store.directory, &old_file).unwrap();
    let listing = list(&store.root, Some(&documents)).unwrap();
    assert!(listing
        .backups
        .iter()
        .any(|entry| entry.name == "manual-before-english.nodex"));
    assert!(old_file.exists());
}
use crate::{backup, images, journal, knowledge};

fn store() -> (tempfile::TempDir, Store) {
    let root = tempfile::tempdir().unwrap();
    let store = Store::open(&root.path().join("dati")).unwrap();
    (root, store)
}
fn enable(root: &Path, keep: u16) {
    save_schedule(
        root,
        Schedule {
            enabled: true,
            frequency: Frequency::Hours,
            hours: 2,
            keep,
        },
    )
    .unwrap();
}
fn at(hour: u32) -> DateTime<Utc> {
    DateTime::parse_from_rfc3339(&format!("2026-10-25T{hour:02}:00:00Z"))
        .unwrap()
        .with_timezone(&Utc)
}

#[test]
fn preferences_default_off_validate_and_never_accept_paths_from_the_schedule() {
    let (_dir, store) = store();
    let defaults = read_preferences(&store.root).unwrap();
    assert!(!defaults.enabled);
    assert_eq!(defaults.keep, 5);
    assert!(!store.root.join(PREFERENCES).exists(), "no write on read");
    for (hours, keep) in [(1, 5), (73, 5), (12, 0), (12, 61)] {
        assert!(save_schedule(
            &store.root,
            Schedule {
                enabled: true,
                frequency: Frequency::Hours,
                hours,
                keep
            }
        )
        .is_err());
    }
    let raw = r#"{"enabled":true,"frequency":"daily","hours":12,"keep":3,"destination":"C:\\x"}"#;
    assert!(serde_json::from_str::<Schedule>(raw).is_err());
    enable(&store.root, 3);
    let saved = read_preferences(&store.root).unwrap();
    assert!(saved.enabled && saved.keep == 3 && saved.destination.is_none());
    assert!(set_destination(&store.root, Some(&store.root.join("assente"))).is_err());
}

#[test]
fn schedule_is_due_once_per_interval_and_failures_wait_a_full_interval() {
    let mut p = Preferences::default();
    let mut index = Index::default();
    assert!(!due(&p, &index, at(10)), "disabled");
    p.enabled = true;
    p.frequency = Frequency::Hours;
    p.hours = 6;
    assert!(due(&p, &index, at(10)), "never run: overdue at startup");
    index.last_success = Some(at(10).to_rfc3339());
    assert!(!due(&p, &index, at(15)));
    assert!(due(&p, &index, at(16)));
    index.last_attempt = Some(at(14).to_rfc3339());
    index.last_error = Some("disco pieno".into());
    assert!(!due(&p, &index, at(16)), "no retry loop after a failure");
    assert!(due(&p, &index, at(20)));
    p.frequency = Frequency::Weekly;
    assert_eq!(interval(&p), Duration::hours(168));
}

#[test]
fn folder_is_created_only_when_needed_with_spaces_and_unicode() {
    let (dir, store) = store();
    let documents = dir.path().join("Documenti di Zoë ✦");
    fs::create_dir(&documents).unwrap();
    let status = status(&store.root, Some(&documents)).unwrap();
    assert!(status.periodic_folder.unwrap().ends_with(PERIODIC));
    assert!(!documents.join(APP_FOLDER).exists(), "status never creates");
    list(&store.root, Some(&documents)).unwrap();
    assert!(
        !documents.join(APP_FOLDER).exists(),
        "listing never creates"
    );
    enable(&store.root, 3);
    let outcome = run(&store, Some(&documents), at(10)).unwrap();
    let path = PathBuf::from(outcome.path.unwrap());
    assert!(path.starts_with(documents.join(APP_FOLDER).join(PERIODIC)));
    assert!(path
        .file_name()
        .unwrap()
        .to_string_lossy()
        .starts_with("chronexus-periodico-20261025T100000Z-"));
    let index = read_index(&store.root).unwrap();
    assert_eq!(index.entries.len(), 1);
    assert_eq!(index.entries[0].sha256.len(), 64);
}

#[test]
fn unsafe_or_missing_destinations_record_an_actionable_error_without_writing() {
    let (dir, store) = store();
    enable(&store.root, 3);
    let missing = dir.path().join("non-esiste");
    let outcome = run(&store, Some(&missing), at(10)).unwrap();
    assert!(outcome.error.unwrap().contains("unavailable"));
    let documents = dir.path().join("Documenti");
    fs::create_dir(&documents).unwrap();
    fs::write(documents.join(APP_FOLDER), "file").unwrap();
    let outcome = run(&store, Some(&documents), at(12)).unwrap();
    assert!(outcome.error.unwrap().contains("is a file"));
    let index = read_index(&store.root).unwrap();
    assert!(index.entries.is_empty() && index.last_error.is_some());
    assert_eq!(index.last_attempt, Some(at(12).to_rfc3339()));
    assert!(run(&store, None, at(14)).unwrap().error.is_some());
}

#[cfg(windows)]
#[test]
fn junctions_and_symlinks_are_rejected() {
    let (dir, store) = store();
    let documents = dir.path().join("Documenti");
    let elsewhere = dir.path().join("altrove");
    fs::create_dir_all(&documents).unwrap();
    fs::create_dir_all(&elsewhere).unwrap();
    let status = std::process::Command::new("cmd")
        .args(["/C", "mklink", "/J"])
        .arg(documents.join(APP_FOLDER))
        .arg(&elsewhere)
        .output()
        .unwrap();
    assert!(status.status.success());
    let error = ensure(&documents, PERIODIC).unwrap_err();
    assert!(error.contains("junction"), "{error}");
    assert!(fs::read_dir(&elsewhere).unwrap().next().is_none());
    let (_, notice) = update_folder(&store.root, Some(&documents));
    assert!(notice.unwrap().contains("data folder"));
}

#[cfg(unix)]
#[test]
fn symlinks_are_rejected() {
    let (dir, _store) = store();
    let documents = dir.path().join("Documenti");
    let elsewhere = dir.path().join("altrove");
    fs::create_dir_all(&documents).unwrap();
    fs::create_dir_all(&elsewhere).unwrap();
    std::os::unix::fs::symlink(&elsewhere, documents.join(APP_FOLDER)).unwrap();
    assert!(ensure(&documents, PERIODIC)
        .unwrap_err()
        .contains("symbolic link"));
}

#[test]
fn rotation_deletes_only_registered_unchanged_periodic_files_in_the_same_folder() {
    let (dir, store) = store();
    let documents = dir.path().join("Documenti");
    fs::create_dir(&documents).unwrap();
    enable(&store.root, 2);
    let folder = documents.join(APP_FOLDER).join(PERIODIC);
    let first = run(&store, Some(&documents), at(1)).unwrap().path.unwrap();
    let second = run(&store, Some(&documents), at(3)).unwrap().path.unwrap();
    // Files Chronexus did not register, even with the periodic prefix.
    let manual = folder.join("manuale.nodex");
    let lookalike = folder.join("chronexus-periodico-20200101T000000Z-aaaaaaaa.nodex");
    fs::copy(&first, &manual).unwrap();
    fs::copy(&first, &lookalike).unwrap();
    // A registered file modified by the user is no longer Chronexus' own.
    fs::write(&second, b"modificato").unwrap();
    let third = run(&store, Some(&documents), at(5)).unwrap();
    assert_eq!(third.removed, 1);
    assert!(!Path::new(&first).exists(), "oldest verified copy rotated");
    assert!(Path::new(&second).exists() && manual.exists() && lookalike.exists());
    let fourth = run(&store, Some(&documents), at(7)).unwrap();
    assert_eq!((fourth.removed, fourth.kept_unverified), (0, 1));
    assert!(Path::new(&second).exists(), "changed file is never deleted");
    let index = read_index(&store.root).unwrap();
    assert_eq!(index.entries.len(), 2);
    // A failed run records the error and never rotates.
    let periodic = folder.clone();
    fs::rename(&periodic, dir.path().join("spostata")).unwrap();
    fs::write(&periodic, "ora è un file").unwrap();
    let failed = run(&store, Some(&documents), at(9)).unwrap();
    assert!(failed.error.is_some() && failed.removed == 0);
    assert_eq!(read_index(&store.root).unwrap().entries.len(), 2);
}

#[test]
fn changing_folder_keeps_old_backups_and_rotates_per_folder() {
    let (dir, store) = store();
    let documents = dir.path().join("Documenti");
    let custom = dir.path().join("Disco esterno");
    fs::create_dir_all(&documents).unwrap();
    fs::create_dir_all(&custom).unwrap();
    enable(&store.root, 1);
    let old = run(&store, Some(&documents), at(1)).unwrap().path.unwrap();
    set_destination(&store.root, Some(&custom)).unwrap();
    let new = run(&store, Some(&documents), at(3)).unwrap().path.unwrap();
    let newer = run(&store, Some(&documents), at(5)).unwrap();
    assert!(Path::new(&old).exists(), "other folder untouched");
    assert!(!Path::new(&new).exists() && newer.removed == 1);
    assert!(newer.path.unwrap().starts_with(&*shown(&custom)));
    let listing = list(&store.root, Some(&documents)).unwrap();
    let locations: Vec<_> = listing.backups.iter().map(|b| b.location).collect();
    assert!(locations.contains(&Location::Periodic) && locations.contains(&Location::Custom));
    set_destination(&store.root, None).unwrap();
    assert!(read_preferences(&store.root).unwrap().destination.is_none());
}

#[test]
fn listing_and_resolution_accept_only_names_inside_known_folders() {
    let (dir, store) = store();
    let documents = dir.path().join("Documenti");
    fs::create_dir(&documents).unwrap();
    let legacy = store.root.join(LEGACY_UPDATES);
    fs::create_dir(&legacy).unwrap();
    fs::write(legacy.join("before-update-x.nodex"), b"vecchio").unwrap();
    fs::write(legacy.join("before-update-x.json"), b"{}").unwrap();
    fs::write(legacy.join("note.txt"), b"ignorato").unwrap();
    let listing = list(&store.root, Some(&documents)).unwrap();
    assert_eq!(listing.backups.len(), 1);
    assert_eq!(listing.backups[0].kind, Kind::Update);
    assert_eq!(listing.backups[0].location, Location::Legacy);
    for bad in ["../x.nodex", "a\\b.nodex", "x.txt", "", "C:x.nodex"] {
        assert!(resolve(&store.root, Some(&documents), Location::Legacy, bad).is_err());
    }
    assert!(resolve(
        &store.root,
        Some(&documents),
        Location::Legacy,
        "before-update-x.nodex"
    )
    .is_ok());
    assert!(resolve(&store.root, Some(&documents), Location::Custom, "x.nodex").is_err());
    let copied = copy_legacy(&store.root, Some(&documents), "before-update-x.nodex").unwrap();
    assert_eq!(fs::read(&copied).unwrap(), b"vecchio");
    let updates = documents.join(APP_FOLDER).join(UPDATES);
    assert!(updates.join("before-update-x.json").exists());
    assert!(
        legacy.join("before-update-x.nodex").exists(),
        "original kept"
    );
    let again = copy_legacy(&store.root, Some(&documents), "before-update-x.nodex");
    assert!(again.unwrap_err().contains("no file was overwritten"));
}

#[test]
fn periodic_backup_with_images_restores_and_preferences_survive_restore() {
    let (dir, mut store) = store();
    let documents = dir.path().join("Documenti");
    fs::create_dir(&documents).unwrap();
    let campaign = journal::create_campaign(&store.connection, "Periodica").unwrap();
    let page = knowledge::create_page(
        &store.connection,
        &campaign.id,
        "Map",
        "place",
        "active",
        &[],
    )
    .unwrap();
    let mut png = std::io::Cursor::new(Vec::new());
    image::DynamicImage::new_rgb8(3, 2)
        .write_to(&mut png, image::ImageFormat::Png)
        .unwrap();
    let image = images::add(
        &store.connection,
        &store.directory,
        &campaign.id,
        &images::ImageTarget {
            kind: "page".into(),
            id: page.id,
        },
        "Map",
        "map",
        png.into_inner(),
    )
    .unwrap();
    enable(&store.root, 4);
    let path = run(&store, Some(&documents), at(1)).unwrap().path.unwrap();
    journal::create_campaign(&store.connection, "Dopo il backup").unwrap();
    let listed = list(&store.root, Some(&documents)).unwrap();
    let entry = &listed.backups[0];
    assert!(entry.registered && entry.kind == Kind::Periodic);
    let resolved = resolve(&store.root, Some(&documents), entry.location, &entry.name).unwrap();
    assert_eq!(resolved, PathBuf::from(&path));
    let preview = store.prepare(&resolved).unwrap();
    store.restore(&preview.token).unwrap();
    assert_eq!(journal::list_campaigns(&store.connection).unwrap().len(), 1);
    assert!(!images::bytes(&store.directory, &image).unwrap().is_empty());
    let after = read_preferences(&store.root).unwrap();
    assert!(after.enabled && after.keep == 4);
    assert_eq!(read_index(&store.root).unwrap().entries.len(), 1);
    assert!(backup::prepare_restore(&resolved, &store.root).is_ok());
}

#[test]
fn update_folder_prefers_documents_and_falls_back_with_notice() {
    let (dir, store) = store();
    let documents = dir.path().join("Documenti");
    fs::create_dir(&documents).unwrap();
    let (folder, notice) = update_folder(&store.root, Some(&documents));
    assert_eq!(folder, documents.join(APP_FOLDER).join(UPDATES));
    assert!(notice.is_none() && folder.is_dir());
    let (folder, notice) = update_folder(&store.root, Some(&dir.path().join("assenti")));
    assert_eq!(folder, store.root.join(LEGACY_UPDATES));
    assert!(notice.unwrap().contains("cannot be used"));
    assert_eq!(
        update_folder(&store.root, None).0,
        store.root.join(LEGACY_UPDATES)
    );
}

#[test]
fn cloud_folders_are_flagged() {
    assert!(cloud_synced(Path::new("C:/Users/x/OneDrive/Documenti")));
    assert!(cloud_synced(Path::new(
        "/Users/x/Library/Mobile Documents/x"
    )));
    assert!(!cloud_synced(Path::new("D:/Archivio/Chronexus")));
}
