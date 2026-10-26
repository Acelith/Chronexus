//! Portable whole-archive backups. No live SQLite files are copied directly.
use crate::{
    db,
    journal::{self, AppResult},
};
use rusqlite::{Connection, OpenFlags};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeSet,
    fs::{self, File},
    io::{Read, Write},
    path::{Path, PathBuf},
};
use tempfile::{NamedTempFile, TempDir};
use uuid::Uuid;
use zip::{write::SimpleFileOptions, ZipArchive, ZipWriter};

const DB_ENTRY: &str = "data/nodex.sqlite3";
const MAX_FILE: u64 = 256 * 1024 * 1024;
const MAX_TOTAL: u64 = 512 * 1024 * 1024;
const MAX_ENTRIES: usize = 10_000;
const MAX_MANIFEST: u64 = 2 * 1024 * 1024;

fn io(error: impl std::fmt::Display) -> String {
    format!("Backup not completed: {error}. Check space, permissions and folder availability, then try again.")
}
fn invalid(detail: &str) -> String {
    format!("Invalid backup: {detail}. The current archive was not replaced.")
}
pub(crate) fn sync_dir(path: &Path) -> AppResult<()> {
    #[cfg(unix)]
    File::open(path).and_then(|f| f.sync_all()).map_err(io)?;
    #[cfg(not(unix))]
    let _ = path;
    Ok(())
}
fn canonical_id(value: &str) -> bool {
    Uuid::parse_str(value).is_ok_and(|id| id.to_string() == value)
}
pub(crate) fn attachment_path(name: &str) -> bool {
    let parts: Vec<_> = name.split('/').collect();
    if parts.len() != 3 || parts[0] != "attachments" || !canonical_id(parts[1]) {
        return false;
    }
    match parts[2].split_once('.') {
        None => canonical_id(parts[2]),
        Some((stem, extension)) => {
            canonical_id(stem)
                && !extension.is_empty()
                && extension.len() <= 12
                && extension
                    .bytes()
                    .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit())
        }
    }
}
fn allowed_path(name: &str) -> bool {
    name == DB_ENTRY || attachment_path(name)
}
fn regular_file(path: &Path) -> AppResult<()> {
    let meta = fs::symlink_metadata(path).map_err(io)?;
    if !meta.is_file() || meta.file_type().is_symlink() {
        return Err(invalid("symbolic or special file not allowed"));
    }
    Ok(())
}
fn checksum(path: &Path) -> AppResult<(u64, String)> {
    regular_file(path)?;
    let mut file = File::open(path).map_err(io)?;
    let mut hash = Sha256::new();
    let mut size = 0;
    let mut buffer = [0_u8; 65536];
    loop {
        let read = file.read(&mut buffer).map_err(io)?;
        if read == 0 {
            break;
        }
        size += read as u64;
        if size > MAX_FILE {
            return Err(invalid("a file exceeds the 256 MiB limit"));
        }
        hash.update(&buffer[..read]);
    }
    Ok((size, format!("{:x}", hash.finalize())))
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Counts {
    pub campaigns: u64,
    pub sessions: u64,
    pub pages: u64,
    pub mentions: u64,
    pub relationships: u64,
    pub attachments: u64,
    #[serde(default, skip_serializing_if = "is_zero")]
    pub characters: u64,
    #[serde(default, skip_serializing_if = "is_zero")]
    pub items: u64,
    #[serde(default, skip_serializing_if = "is_zero")]
    pub spells: u64,
    #[serde(default, skip_serializing_if = "is_zero")]
    pub dice_rolls: u64,
}
fn is_zero(value: &u64) -> bool {
    *value == 0
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case", deny_unknown_fields)]
pub struct Entry {
    pub path: String,
    pub size: u64,
    pub sha256: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case", deny_unknown_fields)]
pub struct Manifest {
    pub format_version: u32,
    pub app_version: String,
    pub created_at: String,
    pub schema_version: i64,
    pub scope: String,
    pub counts: Counts,
    pub files: Vec<Entry>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub assistant_settings: Option<crate::assistant::store::Settings>,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Preview {
    pub token: String,
    pub file_name: String,
    pub manifest: Manifest,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupReceipt {
    pub path: String,
    pub counts: Counts,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreReceipt {
    pub safety_path: String,
    pub counts: Counts,
    pub warning: Option<String>,
}
pub struct PreparedRestore {
    pub token: String,
    pub directory: TempDir,
    pub manifest: Manifest,
}

fn version(connection: &Connection) -> AppResult<i64> {
    connection
        .query_row("SELECT MAX(version) FROM schema_migrations", [], |row| {
            row.get(0)
        })
        .map_err(|_| invalid("database version missing"))
}
fn count(connection: &Connection, table: &str) -> AppResult<u64> {
    // All table names are constants owned by this module.
    connection
        .query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |r| {
            r.get::<_, i64>(0)
        })
        .map(|n| n as u64)
        .map_err(journal::storage)
}
fn counts(connection: &Connection, attachments: u64, schema: i64) -> AppResult<Counts> {
    Ok(Counts {
        campaigns: if schema >= 2 {
            count(connection, "campaigns")?
        } else {
            0
        },
        sessions: if schema >= 2 {
            count(connection, "sessions")?
        } else {
            0
        },
        pages: if schema >= 3 {
            count(connection, "pages")?
        } else {
            0
        },
        mentions: if schema >= 3 {
            count(connection, "mentions")?
        } else {
            0
        },
        relationships: if schema >= 4 {
            count(connection, "relationships")?
        } else {
            0
        },
        attachments,
        dice_rolls: if schema >= 15 {
            count(connection, "dice_rolls")?
        } else {
            0
        },
        characters: if schema >= 5 {
            count(connection, "characters")?
        } else {
            0
        },
        items: if schema >= 5 {
            connection.query_row("SELECT COUNT(*) FROM player_assets WHERE json_extract(details,'$.kind')='item'",[],|r|r.get::<_,i64>(0)).map_err(journal::storage)? as u64
        } else {
            0
        },
        spells: if schema >= 5 {
            connection.query_row("SELECT COUNT(*) FROM player_assets WHERE json_extract(details,'$.kind') IN ('spell','ability')",[],|r|r.get::<_,i64>(0)).map_err(journal::storage)? as u64
        } else {
            0
        },
    })
}
fn schema(connection: &Connection) -> AppResult<Vec<(String, String, String)>> {
    // Auto-indexes have NULL SQL. Do not filter names with LIKE: '_' is a
    // wildcard and could hide unexpected objects such as sqliteXunexpected.
    let mut statement = connection
        .prepare("SELECT type,name,sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY type,name")
        .map_err(journal::storage)?;
    let rows = statement
        .query_map([], |r| {
            let sql: String = r.get(2)?;
            Ok((r.get(0)?, r.get(1)?, schema_line_endings(&sql)))
        })
        .map_err(journal::storage)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(journal::storage)?;
    Ok(rows)
}

/// SQLite preserves migration source newlines in sqlite_master. Archives can
/// contain both Windows and Unix migrations after upgrades or cross-OS restores.
/// Normalize only SQL layout: quoted values/identifiers remain byte-exact, so a
/// modified CHECK/default cannot pass validation through newline normalization.
fn schema_line_endings(sql: &str) -> String {
    let mut out = String::with_capacity(sql.len());
    let mut chars = sql.chars().peekable();
    let mut quote = None;
    let mut line_comment = false;
    let mut block_comment = false;
    while let Some(c) = chars.next() {
        if let Some(end) = quote {
            out.push(c);
            if c == end {
                if end != ']' && chars.peek() == Some(&end) {
                    out.push(chars.next().unwrap_or(end));
                } else {
                    quote = None;
                }
            }
            continue;
        }
        if c == '\r' && chars.peek() == Some(&'\n') {
            chars.next();
            out.push('\n');
            line_comment = false;
            continue;
        }
        out.push(c);
        if line_comment {
            if c == '\n' {
                line_comment = false;
            }
        } else if block_comment {
            if c == '*' && chars.peek() == Some(&'/') {
                out.push(chars.next().unwrap_or('/'));
                block_comment = false;
            }
        } else {
            match c {
                '\'' | '"' | '`' => quote = Some(c),
                '[' => quote = Some(']'),
                '-' if chars.peek() == Some(&'-') => {
                    out.push(chars.next().unwrap_or('-'));
                    line_comment = true;
                }
                '/' if chars.peek() == Some(&'*') => {
                    out.push(chars.next().unwrap_or('*'));
                    block_comment = true;
                }
                _ => {}
            }
        }
    }
    out
}

fn validate_db(path: &Path, expected_version: i64) -> AppResult<Connection> {
    if !(1..=db::LATEST_SCHEMA).contains(&expected_version) {
        return Err(invalid("unsupported database version; update Chronexus"));
    }
    let connection = Connection::open_with_flags(
        path,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .map_err(|_| invalid("unreadable database"))?;
    connection
        .pragma_update(None, "trusted_schema", "OFF")
        .map_err(journal::storage)?;
    let integrity: String = connection
        .query_row("PRAGMA integrity_check", [], |r| r.get(0))
        .map_err(|_| invalid("SQLite integrity compromised"))?;
    if integrity != "ok" || version(&connection)? != expected_version {
        return Err(invalid("inconsistent database integrity or version"));
    }
    let expected = Connection::open_in_memory().map_err(journal::storage)?;
    for migration in db::MIGRATIONS.into_iter().take(expected_version as usize) {
        expected
            .execute_batch(migration)
            .map_err(journal::storage)?;
    }
    if schema(&connection)? != schema(&expected)?
        || count(&connection, "schema_migrations")? != expected_version as u64
    {
        return Err(invalid("unexpected database structure"));
    }
    let versions: i64 = connection
        .query_row("SELECT SUM(version) FROM schema_migrations", [], |r| {
            r.get(0)
        })
        .map_err(journal::storage)?;
    if versions != expected_version * (expected_version + 1) / 2 {
        return Err(invalid("inconsistent migration history"));
    }
    let mut foreign = connection
        .prepare("PRAGMA foreign_key_check")
        .map_err(journal::storage)?;
    if foreign.exists([]).map_err(journal::storage)? {
        return Err(invalid("inconsistent database references"));
    }
    drop(foreign);
    if expected_version >= 5 {
        crate::player::validate_archive(&connection)?;
    }
    if expected_version >= 6 {
        crate::catalog::validate_archive(&connection)?;
    }
    if expected_version >= 12 {
        crate::assistant::store::validate_archive(&connection)?;
    }
    if expected_version >= 13 {
        crate::assistant::campaign::validate_archive(&connection)?;
    }
    if expected_version >= 15 {
        crate::dice::validate_archive(&connection)?;
    }
    if expected_version >= 14 {
        crate::assistant::training::validate_archive(&connection)?;
    }
    if expected_version >= 11 {
        crate::wiki::validate_archive(&connection)?;
    }
    if expected_version >= 16 {
        crate::wikidot::validate_archive(&connection)?;
    }
    if expected_version >= 17 {
        crate::wiki_translation::validate_archive(&connection)?;
    }
    if expected_version >= 10 {
        crate::party::validate_archive(&connection)?;
    }
    if expected_version >= 19 {
        crate::sync::engine::validate_archive(&connection)?;
    }
    if expected_version >= 9 {
        crate::import_sources::validate_archive(&connection)?;
    }
    if expected_version >= 2 {
        for campaign in journal::list_campaigns(&connection)? {
            journal::identifier(&campaign.id)?;
            for session in journal::list_sessions(&connection, &campaign.id)? {
                journal::identifier(&session.id)?;
                journal::validate_document(&session.document)?;
            }
        }
    }
    if expected_version >= 3 {
        let crossing: bool = connection.query_row("SELECT EXISTS(SELECT 1 FROM mentions m JOIN pages p ON p.id=m.target_page_id WHERE p.campaign_id!=m.campaign_id)",[],|r|r.get(0)).map_err(journal::storage)?;
        if crossing {
            return Err(invalid("mentions cross campaign boundaries"));
        }
        for campaign in journal::list_campaigns(&connection)? {
            for page in crate::knowledge::list_pages(&connection, &campaign.id)? {
                journal::identifier(&page.id)?;
                journal::validate_document(&page.document)?;
            }
        }
    }
    Ok(connection)
}

fn attachments(directory: &Path, connection: &Connection) -> AppResult<Vec<(String, PathBuf)>> {
    if version(connection)? >= 14 {
        crate::assistant::training::validate_files(connection, directory)?;
    }
    if version(connection)? >= 8 {
        crate::images::validate_files(connection, directory)?;
    }
    let root = directory.join("attachments");
    if !root.exists() {
        return Ok(vec![]);
    }
    if fs::symlink_metadata(&root)
        .map_err(io)?
        .file_type()
        .is_symlink()
    {
        return Err(invalid("symbolic attachment folder"));
    }
    let campaign_ids: BTreeSet<_> = journal::list_campaigns(connection)?
        .into_iter()
        .map(|c| c.id)
        .collect();
    let mut files = vec![];
    for campaign in fs::read_dir(root).map_err(io)? {
        let campaign = campaign.map_err(io)?;
        let id = campaign.file_name().to_string_lossy().into_owned();
        if !campaign.file_type().map_err(io)?.is_dir()
            || !canonical_id(&id)
            || !campaign_ids.contains(&id)
        {
            return Err(invalid("attachment folder not associated with a campaign"));
        }
        for file in fs::read_dir(campaign.path()).map_err(io)? {
            let file = file.map_err(io)?;
            let name = format!("attachments/{id}/{}", file.file_name().to_string_lossy());
            if !attachment_path(&name) {
                return Err(invalid("non-portable attachment name"));
            }
            regular_file(&file.path())?;
            files.push((name, file.path()));
            if files.len() + 2 > MAX_ENTRIES {
                return Err(invalid("too many attachments (maximum 9998)"));
            }
        }
    }
    files.sort_by(|a, b| a.0.cmp(&b.0));
    Ok(files)
}

pub fn write_backup(
    connection: &Connection,
    directory: &Path,
    destination: &Path,
) -> AppResult<BackupReceipt> {
    if !destination.is_absolute()
        || destination.extension().and_then(|e| e.to_str()) != Some("nodex")
    {
        return Err("Choose an absolute path with the .nodex extension.".into());
    }
    let parent = destination
        .parent()
        .ok_or_else(|| invalid("destination missing"))?;
    let workspace = tempfile::tempdir_in(parent).map_err(io)?;
    let snapshot = workspace.path().join("snapshot.sqlite3");
    connection
        .backup(rusqlite::MAIN_DB, &snapshot, None)
        .map_err(journal::storage)?;
    let schema_version = version(connection)?;
    let validated = validate_db(&snapshot, schema_version)?;
    let mut sources = vec![(DB_ENTRY.to_string(), snapshot)];
    sources.extend(attachments(directory, &validated)?);
    let mut total = 0;
    let mut files = vec![];
    for (name, path) in &sources {
        let (size, sha256) = checksum(path)?;
        total += size;
        if total > MAX_TOTAL {
            return Err(invalid("total size exceeds 512 MiB"));
        }
        files.push(Entry {
            path: name.clone(),
            size,
            sha256,
        });
    }
    let counts = counts(&validated, (sources.len() - 1) as u64, schema_version)?;
    let manifest = Manifest {
        format_version: 1,
        app_version: env!("CARGO_PKG_VERSION").into(),
        created_at: chrono::DateTime::<chrono::Utc>::from(std::time::SystemTime::now())
            .to_rfc3339(),
        schema_version,
        scope: "all_campaigns".into(),
        counts: counts.clone(),
        files,
        assistant_settings: if schema_version >= 12 {
            Some(crate::assistant::store::settings(&validated)?)
        } else {
            None
        },
    };
    let manifest_json = serde_json::to_vec_pretty(&manifest).map_err(io)?;
    if manifest_json.len() as u64 > MAX_MANIFEST {
        return Err(invalid("manifest too large"));
    }
    let mut output = NamedTempFile::new_in(parent).map_err(io)?;
    {
        let mut zip = ZipWriter::new(output.as_file_mut());
        let options = SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated)
            .unix_permissions(0o600);
        zip.start_file("manifest.json", options).map_err(io)?;
        zip.write_all(&manifest_json).map_err(io)?;
        for (name, path) in sources {
            zip.start_file(name, options).map_err(io)?;
            std::io::copy(&mut File::open(path).map_err(io)?, &mut zip).map_err(io)?;
        }
        zip.finish().map_err(io)?;
    }
    output.as_file().sync_all().map_err(io)?;
    // Re-read exactly what will be published, catching attachments modified externally
    // between hashing and archiving, truncated output and CRC failures.
    let verified = prepare_restore(output.path(), parent)?;
    drop(verified);
    // Never silently overwrite: atomic no-clobber publish, even after a dialog race.
    output.persist_noclobber(destination).map_err(|_|"The file already exists or is not writable. Choose a new name: no existing backup is overwritten.".to_string())?;
    sync_dir(parent)?;
    Ok(BackupReceipt {
        path: destination.display().to_string(),
        counts,
    })
}

pub fn prepare_restore(source: &Path, staging_parent: &Path) -> AppResult<PreparedRestore> {
    regular_file(source)?;
    if fs::metadata(source).map_err(io)?.len() > MAX_TOTAL {
        return Err(invalid("archive exceeds 512 MiB"));
    }
    let mut zip = ZipArchive::new(File::open(source).map_err(io)?)
        .map_err(|_| invalid("unreadable or incomplete ZIP"))?;
    if zip.len() < 2 || zip.len() > MAX_ENTRIES {
        return Err(invalid("file count not allowed"));
    }
    let mut names = BTreeSet::new();
    for index in 0..zip.len() {
        let file = zip.by_index(index).map_err(io)?;
        let name = file.name().map_err(io)?.into_owned();
        let mode = file.unix_mode().unwrap_or(0) & 0o170000;
        if file.is_dir()
            || (mode != 0 && mode != 0o100000)
            || (name != "manifest.json" && !allowed_path(&name))
            || !names.insert(name)
            || file.size() > MAX_FILE
        {
            return Err(invalid("path, duplicate, special file or size not allowed"));
        }
    }
    let manifest: Manifest = {
        let file = zip
            .by_name("manifest.json")
            .map_err(|_| invalid("manifest missing"))?;
        if file.size() > MAX_MANIFEST {
            return Err(invalid("manifest too large"));
        }
        serde_json::from_reader(file.take(MAX_MANIFEST + 1))
            .map_err(|_| invalid("unreadable manifest"))?
    };
    if manifest.format_version != 1
        || manifest.scope != "all_campaigns"
        || manifest.app_version.len() > 50
        || chrono::DateTime::parse_from_rfc3339(&manifest.created_at).is_err()
    {
        return Err(invalid("unsupported format or metadata"));
    }
    let mut declared = BTreeSet::from(["manifest.json".to_string()]);
    let mut total = 0_u64;
    for entry in &manifest.files {
        total = total
            .checked_add(entry.size)
            .ok_or_else(|| invalid("inconsistent sizes"))?;
        if !allowed_path(&entry.path)
            || !declared.insert(entry.path.clone())
            || entry.size > MAX_FILE
            || total > MAX_TOTAL
            || entry.sha256.len() != 64
            || !entry
                .sha256
                .bytes()
                .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
        {
            return Err(invalid("invalid file list or checksum"));
        }
    }
    if names != declared || !declared.contains(DB_ENTRY) {
        return Err(invalid("missing or undeclared files"));
    }
    let directory = tempfile::tempdir_in(staging_parent).map_err(io)?;
    for entry in &manifest.files {
        let path = directory.path().join(&entry.path);
        fs::create_dir_all(path.parent().ok_or_else(|| invalid("empty path"))?).map_err(io)?;
        let mut output = File::create_new(&path).map_err(io)?;
        let mut file = zip.by_name(&entry.path).map_err(io)?;
        if file.size() != entry.size {
            return Err(invalid("inconsistent declared size"));
        }
        let written =
            std::io::copy(&mut (&mut file).take(entry.size + 1), &mut output).map_err(io)?;
        output.sync_all().map_err(io)?;
        if written != entry.size || checksum(&path)?.1 != entry.sha256 {
            return Err(invalid("checksum mismatch: file altered or damaged"));
        }
    }
    // Flush directory entries bottom-up before the staged tree can become active.
    let mut parents: BTreeSet<PathBuf> = BTreeSet::new();
    for entry in &manifest.files {
        let mut parent = directory
            .path()
            .join(&entry.path)
            .parent()
            .map(Path::to_path_buf);
        while let Some(path) = parent {
            if path == directory.path() {
                break;
            }
            parents.insert(path.clone());
            parent = path.parent().map(Path::to_path_buf);
        }
    }
    for parent in parents.iter().rev() {
        sync_dir(parent)?;
    }
    sync_dir(directory.path())?;
    let connection = validate_db(&directory.path().join(DB_ENTRY), manifest.schema_version)?;
    if manifest.schema_version >= 14 {
        crate::assistant::training::validate_files(&connection, directory.path())?;
    }
    if manifest.schema_version >= 12
        && manifest.assistant_settings.as_ref()
            != Some(&crate::assistant::store::settings(&connection)?)
    {
        return Err(invalid("inconsistent manifest AI configuration"));
    }
    let actual = counts(
        &connection,
        (manifest.files.len() - 1) as u64,
        manifest.schema_version,
    )?;
    if actual != manifest.counts {
        return Err(invalid("manifest counts do not match"));
    }
    // Validate campaign attachment ownership, also for archives assembled externally.
    if manifest.schema_version >= 2 {
        attachments(directory.path(), &connection)?;
    } else if actual.attachments != 0 {
        return Err(invalid("attachments without campaigns"));
    }
    drop(connection);
    Ok(PreparedRestore {
        token: Uuid::new_v4().to_string(),
        directory,
        manifest,
    })
}

/// Profile generations keep the current data untouched until an atomic pointer switch.
pub struct Store {
    pub root: PathBuf,
    pub directory: PathBuf,
    pub connection: Connection,
    pub pending: Option<PreparedRestore>,
    _lock: File,
}
impl Store {
    pub fn open(root: &Path) -> AppResult<Self> {
        fs::create_dir_all(root).map_err(io)?;
        let root = fs::canonicalize(root).map_err(io)?;
        let lock = File::options()
            .read(true)
            .write(true)
            .create(true)
            .truncate(false)
            .open(root.join("archive.lock"))
            .map_err(io)?;
        lock.try_lock().map_err(|_|"This archive is already open in another Chronexus window. Close it before continuing.".to_string())?;
        let pointer = root.join("active-profile.json");
        let directory = if pointer.exists() {
            let value: String =
                serde_json::from_slice(&fs::read(&pointer).map_err(io)?).map_err(|_| {
                    invalid(
                        "damaged profile selector; preserve the data before attempting recovery",
                    )
                })?;
            if !canonical_id(&value) {
                return Err(invalid("invalid profile selector"));
            }
            let directory = root.join("profiles").join(value);
            if !directory.join("nodex.sqlite3").is_file() {
                return Err(invalid("active profile missing"));
            }
            directory
        } else {
            root.clone()
        };
        let connection = db::open(&directory.join("nodex.sqlite3")).map_err(journal::storage)?;
        Ok(Self {
            root,
            directory,
            connection,
            pending: None,
            _lock: lock,
        })
    }
    pub fn prepare(&mut self, path: &Path) -> AppResult<Preview> {
        self.pending = None;
        let prepared = prepare_restore(path, &self.root)?;
        let preview = Preview {
            token: prepared.token.clone(),
            file_name: path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .into(),
            manifest: prepared.manifest.clone(),
        };
        self.pending = Some(prepared);
        Ok(preview)
    }
    pub fn restore(&mut self, token: &str) -> AppResult<RestoreReceipt> {
        if self.pending.as_ref().is_none_or(|p| p.token != token) {
            return Err("The verification expired. Select the backup again.".into());
        }
        let prepared = self
            .pending
            .take()
            .ok_or_else(|| invalid("verification missing"))?;
        let safety_dir = self.root.join("backups");
        fs::create_dir_all(&safety_dir).map_err(io)?;
        let safety_path = safety_dir.join(format!("prima-del-ripristino-{}.nodex", Uuid::new_v4()));
        write_backup(&self.connection, &self.directory, &safety_path)?;
        let profiles = self.root.join("profiles");
        fs::create_dir_all(&profiles).map_err(io)?;
        let id = Uuid::new_v4().to_string();
        let next = profiles.join(&id);
        fs::create_dir(&next).map_err(io)?;
        // Keep failed/orphan generations for inspection; never delete user data here.
        // Copy only validated, inactive payloads. Moving a directory can fail on
        // Windows when an indexer holds a directory handle without delete sharing.
        // The live SQLite file is still never copied, replaced or removed.
        for entry in &prepared.manifest.files {
            let target = next.join(if entry.path == DB_ENTRY {
                "nodex.sqlite3"
            } else {
                &entry.path
            });
            let parent = target
                .parent()
                .ok_or_else(|| invalid("destination missing"))?;
            fs::create_dir_all(parent).map_err(io)?;
            let mut output = File::create_new(&target).map_err(io)?;
            std::io::copy(
                &mut File::open(prepared.directory.path().join(&entry.path)).map_err(io)?,
                &mut output,
            )
            .map_err(io)?;
            output.sync_all().map_err(io)?;
            if checksum(&target)? != (entry.size, entry.sha256.clone()) {
                return Err(invalid("payload copy failed integrity verification"));
            }
            sync_dir(parent)?;
        }
        if next.join("attachments").exists() {
            sync_dir(&next.join("attachments"))?;
        }
        let connection = db::open(&next.join("nodex.sqlite3")).map_err(journal::storage)?;
        crate::search::rebuild(&connection)?;
        File::options()
            .read(true)
            .write(true)
            .open(next.join("nodex.sqlite3"))
            .and_then(|f| f.sync_all())
            .map_err(io)?;
        sync_dir(&next)?;
        sync_dir(&profiles)?;
        let mut pointer = NamedTempFile::new_in(&self.root).map_err(io)?;
        serde_json::to_writer(pointer.as_file_mut(), &id).map_err(io)?;
        pointer.as_file().sync_all().map_err(io)?;
        pointer
            .persist(self.root.join("active-profile.json"))
            .map_err(io)?;
        // After the commit point, always switch the live connection too.
        self.connection = connection;
        self.directory = next;
        // A directory sync failure here cannot be reported as a cancelled restore.
        let durability_warning = sync_dir(&self.root).err();
        Ok(RestoreReceipt {safety_path:safety_path.display().to_string(),counts:prepared.manifest.counts,warning:durability_warning.map(|_|"Restore applied, but the system did not confirm the folder was synced to disk. Keep the safety copy and check after restarting.".into())})
    }
}

#[cfg(test)]
mod path_tests {
    use super::{attachment_path, schema_line_endings};
    #[test]
    fn schema_normalization_preserves_quoted_values_and_handles_comment_quotes() {
        let sql = "CREATE TABLE x (\r\n-- owner's comment\r\nv TEXT CHECK(v='a\r\nb'),\r\n/* ' */ [a\r\nb] TEXT DEFAULT 'it''s\r\nexact'\r\n)";
        let expected = "CREATE TABLE x (\n-- owner's comment\nv TEXT CHECK(v='a\r\nb'),\n/* ' */ [a\r\nb] TEXT DEFAULT 'it''s\r\nexact'\n)";
        assert_eq!(schema_line_endings(sql), expected);
        assert_ne!(
            schema_line_endings(sql),
            schema_line_endings(&sql.replace("a\r\nb", "a\nb"))
        );
    }
    #[test]
    fn attachment_names_are_portable_and_cannot_alias_windows_trailing_dots() {
        let prefix =
            "attachments/56dc229c-00e7-486b-8e95-a99c0e2d403e/33efd3db-9236-4ba6-abc8-3b072fb0c630";
        assert!(attachment_path(prefix));
        assert!(attachment_path(&format!("{prefix}.png")));
        for suffix in [".", "..", ".PNG", ".png.exe", ".png:", ". ", "/nested"] {
            assert!(!attachment_path(&format!("{prefix}{suffix}")));
        }
    }
}
