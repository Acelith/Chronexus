use super::{Settings, DEFAULT_ENDPOINT};
use crate::{
    backup::{self, BackupReceipt, Store},
    backup_folder,
    journal::AppResult,
};
use serde_json::json;
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::{Read, Write},
    path::Path,
};
use tempfile::NamedTempFile;
const FILE: &str = "update-settings.json";
// Fingerprints of the two retired built-in channels. Custom saved channels stay explicit.
const RETIRED_CHANNELS: [&str; 2] = [
    "099a18d111681020404e5bf57c6e348251f9e29e57a6d39a33bd12eb83c41a27",
    "ff0c0696874e1b5eb2bb134367921935f6903ef1d7fbad7e63d473914e556e25",
];
fn migrate_channel(settings: &mut Settings, fingerprints: &[&str]) -> bool {
    let digest = format!("{:x}", Sha256::digest(settings.endpoint.as_bytes()));
    if fingerprints.contains(&digest.as_str()) {
        settings.endpoint = DEFAULT_ENDPOINT.into();
        true
    } else {
        false
    }
}
fn read_json(path: &Path) -> AppResult<Option<serde_json::Value>> {
    let meta = match fs::symlink_metadata(path) {
        Ok(m) => m,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(_) => return Err("Cannot read the preferences to protect before the update.".into()),
    };
    if !meta.is_file() || meta.file_type().is_symlink() || meta.len() > 16_384 {
        return Err("Invalid preferences file: update blocked.".into());
    }
    let bytes = fs::read(path).map_err(|_| "Preferences not readable.")?;
    serde_json::from_slice(&bytes)
        .map(Some)
        .map_err(|_| "Damaged preferences: keep your data and fix them before updating.".into())
}
pub fn read_settings(root: &Path) -> AppResult<Settings> {
    let mut settings = match read_json(&root.join(FILE))? {
        Some(value) => serde_json::from_value(value).map_err(|_| "Invalid update preferences.")?,
        None => Settings {
            endpoint: DEFAULT_ENDPOINT.into(),
        },
    };
    if migrate_channel(&mut settings, &RETIRED_CHANNELS) {
        write_settings(root, &settings)?;
    }
    super::network::url(&settings.endpoint)?;
    Ok(settings)
}
pub fn write_settings(root: &Path, settings: &Settings) -> AppResult<()> {
    let path = root.join(FILE);
    if fs::symlink_metadata(&path).is_ok_and(|m| !m.is_file() || m.file_type().is_symlink()) {
        return Err("Unsafe destination for the update preferences.".into());
    }
    let mut f = NamedTempFile::new_in(root).map_err(|_| "Cannot save the update channel.")?;
    serde_json::to_writer_pretty(f.as_file_mut(), settings)
        .map_err(|_| "Update preferences cannot be serialized.")?;
    f.flush()
        .and_then(|_| f.as_file().sync_all())
        .map_err(|_| "Update preferences not saved.")?;
    f.persist(path)
        .map_err(|_| "Cannot save the update channel.")?;
    backup::sync_dir(root)
}
/// The installer callback is unreachable if snapshot creation or verification fails.
/// M19: written to `Documenti/Chronexus/Backup aggiornamenti`; when Documents is
/// unusable, to the data folder with a notice passed to `install`. Never skipped.
pub fn before_install<T>(
    store: &Store,
    documents: Option<&Path>,
    target: &str,
    install: impl FnOnce(&BackupReceipt, Option<&str>) -> AppResult<T>,
) -> AppResult<T> {
    let (directory, notice) = backup_folder::update_folder(&store.root, documents);
    fs::create_dir_all(&directory)
        .map_err(|_| "Cannot create the backup folder: installation blocked.")?;
    let meta = fs::symlink_metadata(&directory).map_err(|_| "Backup folder not readable.")?;
    if !meta.is_dir() || meta.file_type().is_symlink() {
        return Err("Unsafe backup folder: installation blocked.".into());
    }
    let preferences = read_json(&store.root.join("interface-preferences.json"))?;
    let settings = read_settings(&store.root)?;
    let wiki = read_json(&store.root.join(crate::wiki_provider::FILE))?;
    let announcements = read_json(&store.root.join(super::herald::FILE))?;
    let backups = read_json(&store.root.join(backup_folder::PREFERENCES))?;
    let stamp = chrono::DateTime::<chrono::Utc>::from(std::time::SystemTime::now())
        .format("%Y%m%dT%H%M%SZ")
        .to_string();
    let name = format!("before-update-{stamp}-{}", uuid::Uuid::new_v4());
    let receipt = backup::write_backup(
        &store.connection,
        &store.directory,
        &directory.join(format!("{name}.nodex")),
    )?;
    let mut file = fs::File::open(&receipt.path)
        .map_err(|_| "Backup created but not readable again: installation blocked.")?;
    let mut hash = Sha256::new();
    let mut bytes = [0; 65536];
    loop {
        let n = file
            .read(&mut bytes)
            .map_err(|_| "Backup cannot be verified.")?;
        if n == 0 {
            break;
        }
        hash.update(&bytes[..n]);
    }
    let record = json!({"format":"chronexus-update-backup","version":1,"fromVersion":env!("CARGO_PKG_VERSION"),"targetVersion":target,"backup":receipt.path,"sha256":format!("{:x}",hash.finalize()),"interfacePreferences":preferences,"updateSettings":settings,"wikiPreferences":wiki,"updateAnnouncements":announcements,"backupPreferences":backups});
    let mut sidecar = NamedTempFile::new_in(&directory)
        .map_err(|_| "Backup created but its receipt could not be saved: installation blocked.")?;
    serde_json::to_writer_pretty(sidecar.as_file_mut(), &record)
        .map_err(|_| "Backup receipt cannot be serialized.")?;
    sidecar
        .as_file()
        .sync_all()
        .map_err(|_| "Backup receipt not saved.")?;
    sidecar
        .persist_noclobber(directory.join(format!("{name}.json")))
        .map_err(|_| "Backup receipt not saved: installation blocked.")?;
    backup::sync_dir(&directory)?;
    install(&receipt, notice.as_deref())
}

#[cfg(test)]
mod channel_tests {
    use super::*;

    #[test]
    fn only_exact_retired_channels_are_migrated() {
        let custom = "https://example.org/updates/latest.json";
        let mut settings = Settings {
            endpoint: custom.into(),
        };
        assert!(!migrate_channel(&mut settings, &RETIRED_CHANNELS));
        assert_eq!(settings.endpoint, custom);
        let fingerprint = format!("{:x}", Sha256::digest(custom.as_bytes()));
        assert!(migrate_channel(&mut settings, &[&fingerprint]));
        assert_eq!(settings.endpoint, DEFAULT_ENDPOINT);
    }
}
