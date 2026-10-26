//! M19: `Chronexus` folder in Documents, configurable periodic backups and
//! update backup destination. Preferences and the periodic file index live
//! in the data root, outside restore generations.
use crate::{
    backup::{self, Store},
    journal::AppResult,
    json_file::{self, is_link, ReadError, WriteError},
};
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs::{self, File},
    io::Read,
    path::{Path, PathBuf},
};
use tempfile::NamedTempFile;
pub mod commands;
#[cfg(test)]
mod tests;

pub const PREFERENCES: &str = "backup-preferences.json";
pub const INDEX: &str = "periodic-backups.json";
pub const APP_FOLDER: &str = "Chronexus";
// Existing backup paths are storage identifiers, independent of UI language.
pub const PERIODIC: &str = "Backup periodici";
pub const UPDATES: &str = "Backup aggiornamenti";
pub const LEGACY_UPDATES: &str = "update-backups";
const PERIODIC_PREFIX: &str = "chronexus-periodico-";
const MAX_INDEX_ENTRIES: usize = 1000;
const MAX_LISTED: usize = 500;
pub const HOURS: std::ops::RangeInclusive<u16> = 2..=72;
pub const KEEP: std::ops::RangeInclusive<u16> = 1..=60;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum Frequency {
    Daily,
    Weekly,
    Hours,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Preferences {
    pub version: u8,
    pub enabled: bool,
    pub frequency: Frequency,
    pub hours: u16,
    pub keep: u16,
    /// Folder chosen with the system picker; `None` means Documents.
    pub destination: Option<String>,
}
/// Disabled by default: `.nodex` files are not encrypted and Documents is
/// often synchronised to a cloud service, so the user opts in explicitly.
impl Default for Preferences {
    fn default() -> Self {
        Self {
            version: 1,
            enabled: false,
            frequency: Frequency::Weekly,
            hours: 12,
            keep: 5,
            destination: None,
        }
    }
}
/// The part of the preferences the interface may change directly: never a path.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Schedule {
    pub enabled: bool,
    pub frequency: Frequency,
    pub hours: u16,
    pub keep: u16,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Entry {
    pub folder: String,
    pub file: String,
    pub sha256: String,
    pub size: u64,
    pub created_at: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Index {
    pub version: u8,
    pub last_success: Option<String>,
    pub last_attempt: Option<String>,
    pub last_error: Option<String>,
    pub entries: Vec<Entry>,
}
impl Default for Index {
    fn default() -> Self {
        Self {
            version: 1,
            last_success: None,
            last_attempt: None,
            last_error: None,
            entries: Vec::new(),
        }
    }
}

pub fn now() -> DateTime<Utc> {
    DateTime::<Utc>::from(std::time::SystemTime::now())
}
fn time(value: &Option<String>) -> Option<DateTime<Utc>> {
    value
        .as_deref()
        .and_then(|v| DateTime::parse_from_rfc3339(v).ok())
        .map(|v| v.with_timezone(&Utc))
}

fn validate(p: &Preferences) -> AppResult<()> {
    if p.version != 1 || !HOURS.contains(&p.hours) || !KEEP.contains(&p.keep) {
        return Err(format!(
            "Invalid backup preferences: interval between {} and {} hours, from {} to {} copies.",
            HOURS.start(),
            HOURS.end(),
            KEEP.start(),
            KEEP.end()
        ));
    }
    if p.destination
        .as_deref()
        .is_some_and(|d| d.len() > 4096 || !Path::new(d).is_absolute())
    {
        return Err("Invalid custom backup folder.".into());
    }
    Ok(())
}
fn read_file(root: &Path, file: &str, limit: u64) -> AppResult<Option<Vec<u8>>> {
    json_file::read_bounded(&root.join(file), limit).map_err(|e| match e {
        ReadError::Unreadable => format!("Cannot read {file}. Check permissions."),
        ReadError::Invalid => format!("{file} is not a valid file: correct or move it."),
    })
}
fn write_file<T: Serialize>(root: &Path, file: &str, value: &T) -> AppResult<()> {
    json_file::write_atomic(root, file, value).map_err(|e| match e {
        WriteError::Unsafe => format!("{file}: unsafe destination."),
        _ => format!("Cannot save {file}. Check space and permissions."),
    })
}
pub fn read_preferences(root: &Path) -> AppResult<Preferences> {
    let Some(bytes) = read_file(root, PREFERENCES, 8192)? else {
        return Ok(Preferences::default());
    };
    let value: Preferences = serde_json::from_slice(&bytes).map_err(|_| {
        "Backup preferences damaged: save them again from the settings.".to_string()
    })?;
    validate(&value)?;
    Ok(value)
}
fn write_preferences(root: &Path, value: Preferences) -> AppResult<Preferences> {
    validate(&value)?;
    write_file(root, PREFERENCES, &value)?;
    Ok(value)
}
pub fn save_schedule(root: &Path, schedule: Schedule) -> AppResult<Preferences> {
    let current = read_preferences(root).unwrap_or_default();
    write_preferences(
        root,
        Preferences {
            enabled: schedule.enabled,
            frequency: schedule.frequency,
            hours: schedule.hours,
            keep: schedule.keep,
            ..current
        },
    )
}
/// Only a folder returned by the system picker (or `None` for Documents).
pub fn set_destination(root: &Path, folder: Option<&Path>) -> AppResult<Preferences> {
    let destination = match folder {
        Some(folder) => Some(shown(&custom_folder(folder)?)),
        None => None,
    };
    let current = read_preferences(root).unwrap_or_default();
    write_preferences(
        root,
        Preferences {
            destination,
            ..current
        },
    )
}
pub fn read_index(root: &Path) -> AppResult<Index> {
    let Some(bytes) = read_file(root, INDEX, 1 << 20)? else {
        return Ok(Index::default());
    };
    let index: Index = serde_json::from_slice(&bytes).map_err(|_| {
        "Periodic backup index damaged: no file is deleted until it is fixed.".to_string()
    })?;
    if index.version != 1 || index.entries.len() > MAX_INDEX_ENTRIES {
        return Err("Unsupported periodic backup index.".into());
    }
    Ok(index)
}

pub fn interval(p: &Preferences) -> Duration {
    Duration::hours(match p.frequency {
        Frequency::Daily => 24,
        Frequency::Weekly => 24 * 7,
        Frequency::Hours => i64::from(p.hours),
    })
}
/// Retries after a failure wait a full interval too: no loop on a broken disk.
pub fn next_due(p: &Preferences, index: &Index) -> Option<DateTime<Utc>> {
    if !p.enabled {
        return None;
    }
    let last = [time(&index.last_success), time(&index.last_attempt)]
        .into_iter()
        .flatten()
        .max();
    Some(last.map_or(DateTime::<Utc>::UNIX_EPOCH, |t| t + interval(p)))
}
pub fn due(p: &Preferences, index: &Index, now: DateTime<Utc>) -> bool {
    next_due(p, index).is_some_and(|t| t <= now)
}

pub fn shown(path: &Path) -> String {
    let text = path.display().to_string();
    text.strip_prefix(r"\\?\")
        .map(str::to_string)
        .unwrap_or(text)
}
/// Checks (and on request creates) one level, never following links.
fn safe_dir(path: &Path, create: bool) -> AppResult<bool> {
    let name = shown(path);
    match fs::symlink_metadata(path) {
        Ok(meta) if is_link(&meta) => Err(format!(
            "{name} is a symbolic link or junction: Chronexus does not use it for safety. Replace it with a regular folder."
        )),
        Ok(meta) if !meta.is_dir() => Err(format!(
            "{name} is a file, not a folder: rename it or choose another destination."
        )),
        Ok(_) => Ok(true),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            if !create {
                return Ok(false);
            }
            match fs::create_dir(path) {
                Ok(()) => Ok(true),
                Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => safe_dir(path, false),
                Err(e) => Err(format!(
                    "Cannot create {name}: {e}. Check permissions and free space."
                )),
            }
        }
        Err(e) => Err(format!("Cannot access {name}: {e}. Check permissions.")),
    }
}
fn documents_base(documents: &Path) -> AppResult<()> {
    // Documents may be redirected (OneDrive, another disk): follow it, but it must exist.
    match fs::metadata(documents) {
        Ok(m) if m.is_dir() => Ok(()),
        _ => Err(format!(
            "The Documents folder {} is unavailable.",
            shown(documents)
        )),
    }
}
/// `Documents/Chronexus/<sub>`, created only now that it is needed.
pub fn ensure(documents: &Path, sub: &str) -> AppResult<PathBuf> {
    documents_base(documents)?;
    let app = documents.join(APP_FOLDER);
    safe_dir(&app, true)?;
    let folder = app.join(sub);
    safe_dir(&folder, true)?;
    Ok(folder)
}
pub fn custom_folder(folder: &Path) -> AppResult<PathBuf> {
    if !folder.is_absolute() {
        return Err("Choose the folder using the system dialog.".into());
    }
    if !safe_dir(folder, false)? {
        return Err(format!(
            "The folder {} no longer exists: choose another one.",
            shown(folder)
        ));
    }
    Ok(folder.to_path_buf())
}
/// Common cloud-sync clients; a hint only, never a guarantee either way.
pub fn cloud_synced(path: &Path) -> bool {
    let lower = shown(path).to_lowercase();
    let known = [
        "onedrive",
        "dropbox",
        "google drive",
        "googledrive",
        "icloud",
        "mobile documents",
        "nextcloud",
        "pcloud",
    ];
    known.iter().any(|k| lower.contains(k))
        || ["OneDrive", "OneDriveConsumer", "OneDriveCommercial"]
            .iter()
            .filter_map(std::env::var_os)
            .any(|base| !base.is_empty() && path.starts_with(PathBuf::from(base)))
}
fn periodic_folder(p: &Preferences, documents: Option<&Path>) -> AppResult<PathBuf> {
    match (&p.destination, documents) {
        (Some(custom), _) => custom_folder(Path::new(custom)),
        (None, Some(documents)) => ensure(documents, PERIODIC),
        (None, None) => {
            Err("Documents folder unavailable: choose a folder for periodic backups.".into())
        }
    }
}
fn planned_periodic(p: &Preferences, documents: Option<&Path>) -> Option<PathBuf> {
    match &p.destination {
        Some(custom) => Some(PathBuf::from(custom)),
        None => documents.map(|d| d.join(APP_FOLDER).join(PERIODIC)),
    }
}

/// Folder for the M15 update backup. Documents first; on any problem the data
/// folder, with a notice. The backup itself is never skipped.
pub fn update_folder(root: &Path, documents: Option<&Path>) -> (PathBuf, Option<String>) {
    let problem = match documents.map(|d| ensure(d, UPDATES)) {
        Some(Ok(folder)) => return (folder, None),
        Some(Err(e)) => e,
        None => "Documents folder unavailable".into(),
    };
    let fallback = root.join(LEGACY_UPDATES);
    let notice = format!(
        "Update backup saved in the Chronexus data folder ({}) because Documents cannot be used: {problem}",
        shown(&fallback)
    );
    (fallback, Some(notice))
}
pub fn planned_update_folder(documents: Option<&Path>) -> Option<PathBuf> {
    documents.map(|d| d.join(APP_FOLDER).join(UPDATES))
}

pub fn sha256(path: &Path) -> AppResult<(u64, String)> {
    let mut file = File::open(path).map_err(|_| "Cannot reread the backup.".to_string())?;
    let mut hash = Sha256::new();
    let mut bytes = [0; 65536];
    let mut size = 0u64;
    loop {
        let n = file
            .read(&mut bytes)
            .map_err(|_| "Backup cannot be verified.".to_string())?;
        if n == 0 {
            break;
        }
        size += n as u64;
        hash.update(&bytes[..n]);
    }
    Ok((size, format!("{:x}", hash.finalize())))
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Outcome {
    pub path: Option<String>,
    pub error: Option<String>,
    pub removed: usize,
    pub kept_unverified: usize,
}
/// Writes one verified periodic backup and, only after it succeeds, rotates
/// files that this index registered in the same folder with matching hashes.
pub fn run(store: &Store, documents: Option<&Path>, at: DateTime<Utc>) -> AppResult<Outcome> {
    let preferences = read_preferences(&store.root)?;
    let mut index = read_index(&store.root)?;
    index.last_attempt = Some(at.to_rfc3339());
    let attempt = periodic_folder(&preferences, documents).and_then(|folder| {
        let name = format!(
            "{PERIODIC_PREFIX}{}-{}.nodex",
            at.format("%Y%m%dT%H%M%SZ"),
            &uuid::Uuid::new_v4().simple().to_string()[..8]
        );
        let receipt =
            backup::write_backup(&store.connection, &store.directory, &folder.join(&name))?;
        let (size, sha256) = sha256(Path::new(&receipt.path))?;
        Ok((folder, name, size, sha256, receipt.path))
    });
    let outcome = match attempt {
        Ok((folder, file, size, sha256, path)) => {
            index.entries.push(Entry {
                folder: shown(&folder),
                file,
                sha256,
                size,
                created_at: at.to_rfc3339(),
            });
            index.last_success = Some(at.to_rfc3339());
            index.last_error = None;
            let (removed, kept_unverified) = rotate(&mut index, &folder, preferences.keep);
            Outcome {
                path: Some(path),
                error: None,
                removed,
                kept_unverified,
            }
        }
        Err(error) => {
            index.last_error = Some(error.clone());
            Outcome {
                path: None,
                error: Some(error),
                removed: 0,
                kept_unverified: 0,
            }
        }
    };
    // Never forget a written backup: drop the oldest records only past the bound.
    while index.entries.len() > MAX_INDEX_ENTRIES {
        index.entries.remove(0);
    }
    write_file(&store.root, INDEX, &index)?;
    Ok(outcome)
}
fn periodic_name(file: &str) -> bool {
    file.starts_with(PERIODIC_PREFIX)
        && file.ends_with(".nodex")
        && !file.contains(['/', '\\'])
        && !file.contains("..")
}
/// Returns (deleted, records dropped without deleting because they changed).
fn rotate(index: &mut Index, folder: &Path, keep: u16) -> (usize, usize) {
    let key = shown(folder);
    let mine: Vec<usize> = index
        .entries
        .iter()
        .enumerate()
        .filter(|(_, e)| e.folder == key)
        .map(|(i, _)| i)
        .collect();
    let excess = mine.len().saturating_sub(usize::from(keep));
    let mut drop = Vec::new();
    let (mut removed, mut kept) = (0, 0);
    for &i in &mine[..excess] {
        let entry = &index.entries[i];
        let path = folder.join(&entry.file);
        if !periodic_name(&entry.file) {
            drop.push(i);
            kept += 1;
            continue;
        }
        match fs::symlink_metadata(&path) {
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => drop.push(i),
            Ok(meta) if meta.is_file() && !is_link(&meta) => {
                if sha256(&path)
                    .is_ok_and(|(size, hash)| size == entry.size && hash == entry.sha256)
                {
                    if fs::remove_file(&path).is_ok() {
                        removed += 1;
                        drop.push(i);
                    }
                } else {
                    // Modified or replaced: no longer the file Chronexus wrote.
                    kept += 1;
                    drop.push(i);
                }
            }
            Ok(_) => {
                kept += 1;
                drop.push(i);
            }
            // Temporarily unreadable: keep the record and retry next time.
            Err(_) => {}
        }
    }
    for i in drop.into_iter().rev() {
        index.entries.remove(i);
    }
    let _ = backup::sync_dir(folder);
    (removed, kept)
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum Location {
    Periodic,
    Updates,
    Legacy,
    Custom,
}
#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum Kind {
    Periodic,
    Update,
    Other,
}
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Folder {
    pub location: Location,
    pub path: String,
    pub exists: bool,
    pub error: Option<String>,
}
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Listed {
    pub location: Location,
    pub name: String,
    pub kind: Kind,
    pub size: u64,
    pub modified: Option<String>,
    pub registered: bool,
}
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Listing {
    pub folders: Vec<Folder>,
    pub backups: Vec<Listed>,
    pub truncated: bool,
}
fn folders(root: &Path, documents: Option<&Path>, p: &Preferences) -> Vec<(Location, PathBuf)> {
    let mut out = Vec::new();
    if let Some(d) = documents {
        out.push((Location::Periodic, d.join(APP_FOLDER).join(PERIODIC)));
        out.push((Location::Updates, d.join(APP_FOLDER).join(UPDATES)));
    }
    if let Some(custom) = &p.destination {
        out.push((Location::Custom, PathBuf::from(custom)));
    }
    out.push((Location::Legacy, root.join(LEGACY_UPDATES)));
    out
}
fn located(root: &Path, documents: Option<&Path>, location: Location) -> AppResult<PathBuf> {
    let p = read_preferences(root)?;
    folders(root, documents, &p)
        .into_iter()
        .find(|(l, _)| *l == location)
        .map(|(_, path)| path)
        .ok_or_else(|| "Backup folder unavailable.".to_string())
}
/// Lists without creating anything; unsafe folders are reported, not read.
pub fn list(root: &Path, documents: Option<&Path>) -> AppResult<Listing> {
    let p = read_preferences(root)?;
    let index = read_index(root).unwrap_or_default();
    let mut listing = Listing {
        folders: Vec::new(),
        backups: Vec::new(),
        truncated: false,
    };
    for (location, path) in folders(root, documents, &p) {
        let shown_path = shown(&path);
        let parent_ok = match location {
            Location::Periodic | Location::Updates => {
                path.parent().map_or(Ok(false), |app| safe_dir(app, false))
            }
            _ => Ok(true),
        };
        let state = parent_ok.and_then(|ok| {
            if ok {
                safe_dir(&path, false)
            } else {
                Ok(false)
            }
        });
        let (exists, error) = match state {
            Ok(e) => (e, None),
            Err(e) => (false, Some(e)),
        };
        listing.folders.push(Folder {
            location,
            path: shown_path.clone(),
            exists,
            error,
        });
        if !exists {
            continue;
        }
        let Ok(entries) = fs::read_dir(&path) else {
            continue;
        };
        let mut count = 0;
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if !name.ends_with(".nodex") {
                continue;
            }
            let Ok(meta) = fs::symlink_metadata(entry.path()) else {
                continue;
            };
            if !meta.is_file() || is_link(&meta) {
                continue;
            }
            if count == MAX_LISTED {
                listing.truncated = true;
                break;
            }
            count += 1;
            let registered = index
                .entries
                .iter()
                .any(|e| e.folder == shown_path && e.file == name);
            let kind = if registered || name.starts_with(PERIODIC_PREFIX) {
                Kind::Periodic
            } else if name.starts_with("before-update-") {
                Kind::Update
            } else {
                Kind::Other
            };
            listing.backups.push(Listed {
                location,
                kind,
                size: meta.len(),
                modified: meta
                    .modified()
                    .ok()
                    .map(|m| DateTime::<Utc>::from(m).to_rfc3339()),
                registered,
                name,
            });
        }
    }
    listing
        .backups
        .sort_by(|a, b| b.modified.cmp(&a.modified).then(a.name.cmp(&b.name)));
    Ok(listing)
}
fn plain_name(name: &str, extension: &str) -> AppResult<()> {
    if name.is_empty()
        || name.len() > 255
        || !name.ends_with(extension)
        || name.contains(['/', '\\', ':', '\0'])
        || name.starts_with('.')
    {
        return Err("Invalid backup name.".into());
    }
    Ok(())
}
/// Resolves a listed backup by folder and file name; never a free path.
pub fn resolve(
    root: &Path,
    documents: Option<&Path>,
    location: Location,
    name: &str,
) -> AppResult<PathBuf> {
    plain_name(name, ".nodex")?;
    let folder = located(root, documents, location)?;
    if !safe_dir(&folder, false)? {
        return Err("The backup folder no longer exists.".into());
    }
    let path = folder.join(name);
    match fs::symlink_metadata(&path) {
        Ok(m) if m.is_file() && !is_link(&m) => Ok(path),
        Ok(_) => Err("The selected backup is not a regular file.".into()),
        Err(_) => Err("The selected backup no longer exists. Refresh the list.".into()),
    }
}
/// Folder to show in the file manager; Documents subfolders are created now.
pub fn open_target(
    root: &Path,
    documents: Option<&Path>,
    location: Location,
) -> AppResult<PathBuf> {
    match (location, documents) {
        (Location::Periodic, Some(d)) => ensure(d, PERIODIC),
        (Location::Updates, Some(d)) => ensure(d, UPDATES),
        (Location::Periodic | Location::Updates, None) => {
            Err("Documents folder unavailable.".into())
        }
        _ => {
            let folder = located(root, documents, location)?;
            if safe_dir(&folder, false)? {
                Ok(folder)
            } else {
                Err("The folder does not exist yet.".into())
            }
        }
    }
}
fn copy_verified(source: &Path, target: &Path) -> AppResult<String> {
    let folder = target.parent().ok_or("Missing destination.")?;
    let mut temp = NamedTempFile::new_in(folder)
        .map_err(|e| format!("Copy failed: {e}. Check space and permissions."))?;
    std::io::copy(
        &mut File::open(source).map_err(|_| "Cannot read the original backup.".to_string())?,
        temp.as_file_mut(),
    )
    .map_err(|e| format!("Copy failed: {e}. Check space and permissions."))?;
    temp.as_file()
        .sync_all()
        .map_err(|_| "Copy not saved.".to_string())?;
    let (expected, copied) = (sha256(source)?, sha256(temp.path())?);
    if expected != copied {
        return Err("The copy does not match the original: cancelled.".into());
    }
    temp.persist_noclobber(target).map_err(|_| {
        "A file with this name already exists at the destination: no file was overwritten."
            .to_string()
    })?;
    Ok(copied.1)
}
/// Copies a legacy update backup (and its receipt) into Documents, verifying
/// SHA-256. The original in the data folder is never removed.
pub fn copy_legacy(root: &Path, documents: Option<&Path>, name: &str) -> AppResult<String> {
    let source = resolve(root, documents, Location::Legacy, name)?;
    let documents = documents.ok_or("Documents folder unavailable.")?;
    let folder = ensure(documents, UPDATES)?;
    let target = folder.join(name);
    copy_verified(&source, &target)?;
    let receipt = name.trim_end_matches(".nodex").to_string() + ".json";
    let receipt_source = source.with_file_name(&receipt);
    if fs::symlink_metadata(&receipt_source)
        .is_ok_and(|m| m.is_file() && !is_link(&m) && m.len() <= 65536)
    {
        copy_verified(&receipt_source, &folder.join(&receipt))?;
    }
    backup::sync_dir(&folder)?;
    Ok(shown(&target))
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    pub preferences: Preferences,
    pub documents_folder: Option<String>,
    pub periodic_folder: Option<String>,
    pub updates_folder: Option<String>,
    pub cloud_synced: bool,
    pub last_success: Option<String>,
    pub last_attempt: Option<String>,
    pub last_error: Option<String>,
    pub next_due: Option<String>,
    pub due_now: bool,
    pub registered: usize,
}
pub fn status(root: &Path, documents: Option<&Path>) -> AppResult<Status> {
    let preferences = read_preferences(root)?;
    let index = read_index(root)?;
    let periodic = planned_periodic(&preferences, documents);
    let updates = planned_update_folder(documents);
    let cloud = periodic
        .iter()
        .chain(updates.iter())
        .any(|p| cloud_synced(p));
    let key = periodic.as_deref().map(shown);
    Ok(Status {
        documents_folder: documents.map(|d| shown(&d.join(APP_FOLDER))),
        periodic_folder: key.clone(),
        updates_folder: updates.as_deref().map(shown),
        cloud_synced: cloud,
        next_due: next_due(&preferences, &index).map(|t| t.to_rfc3339()),
        due_now: due(&preferences, &index, now()),
        registered: index
            .entries
            .iter()
            .filter(|e| Some(&e.folder) == key.as_ref())
            .count(),
        last_success: index.last_success,
        last_attempt: index.last_attempt,
        last_error: index.last_error,
        preferences,
    })
}
