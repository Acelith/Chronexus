//! Small JSON preference/index files kept in the data root, outside SQLite.
//! One implementation of the bounded read and atomic replace that the
//! interface, wiki, herald and backup preferences share. Callers keep their own
//! user-facing messages; this module only reports what went wrong.
use serde::Serialize;
use std::{
    fs::{self, File},
    io::{Read, Write},
    path::Path,
};
use tempfile::NamedTempFile;

#[derive(Debug, PartialEq, Eq)]
pub enum ReadError {
    /// Present but not readable (permissions, I/O).
    Unreadable,
    /// Not a regular file, a link/junction, or larger than the limit.
    Invalid,
}
#[derive(Debug, PartialEq, Eq)]
pub enum WriteError {
    /// The destination exists as a link, junction or non-file.
    Unsafe,
    /// Serialization, temporary file or flush failed: nothing was replaced.
    Write,
    /// The atomic rename failed: the previous file is kept.
    Persist,
}

/// Symbolic links and, on Windows, junctions and other reparse points.
pub fn is_link(meta: &fs::Metadata) -> bool {
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        if meta.file_attributes() & 0x400 != 0 {
            return true;
        }
    }
    meta.file_type().is_symlink()
}

/// `Ok(None)` when the file does not exist. Never follows links and never
/// reads more than `limit` bytes, even if the file grows while being read.
pub fn read_bounded(path: &Path, limit: u64) -> Result<Option<Vec<u8>>, ReadError> {
    let meta = match fs::symlink_metadata(path) {
        Ok(meta) => meta,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(_) => return Err(ReadError::Unreadable),
    };
    if !meta.is_file() || is_link(&meta) || meta.len() > limit {
        return Err(ReadError::Invalid);
    }
    let mut bytes = Vec::new();
    File::open(path)
        .and_then(|file| file.take(limit + 1).read_to_end(&mut bytes))
        .map_err(|_| ReadError::Unreadable)?;
    if bytes.len() as u64 > limit {
        return Err(ReadError::Invalid);
    }
    Ok(Some(bytes))
}

/// Replaces `root/file` atomically with pretty JSON, synced to disk. A link or
/// junction at the destination is refused instead of being replaced.
pub fn write_atomic<T: Serialize>(root: &Path, file: &str, value: &T) -> Result<(), WriteError> {
    let path = root.join(file);
    if fs::symlink_metadata(&path).is_ok_and(|m| !m.is_file() || is_link(&m)) {
        return Err(WriteError::Unsafe);
    }
    let bytes = serde_json::to_vec_pretty(value).map_err(|_| WriteError::Write)?;
    let mut next = NamedTempFile::new_in(root).map_err(|_| WriteError::Write)?;
    next.write_all(&bytes)
        .and_then(|_| next.as_file().sync_all())
        .map_err(|_| WriteError::Write)?;
    next.persist(&path).map_err(|_| WriteError::Persist)?;
    // The rename is committed; a failed directory sync must not report the
    // save as lost, so it is best effort here.
    let _ = crate::backup::sync_dir(root);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn bounded_reads_and_atomic_writes_refuse_links_and_oversize_files() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        assert_eq!(read_bounded(&root.join("missing.json"), 10), Ok(None));
        write_atomic(root, "a.json", &serde_json::json!({"v": 1})).unwrap();
        let bytes = read_bounded(&root.join("a.json"), 100).unwrap().unwrap();
        assert_eq!(
            serde_json::from_slice::<serde_json::Value>(&bytes).unwrap()["v"],
            1
        );
        assert_eq!(
            read_bounded(&root.join("a.json"), 3),
            Err(ReadError::Invalid)
        );
        fs::create_dir(root.join("dir.json")).unwrap();
        assert_eq!(
            read_bounded(&root.join("dir.json"), 100),
            Err(ReadError::Invalid)
        );
        assert_eq!(write_atomic(root, "dir.json", &1), Err(WriteError::Unsafe));
        #[cfg(unix)]
        {
            let outside = tempfile::tempdir().unwrap();
            fs::write(outside.path().join("target.json"), b"{}").unwrap();
            std::os::unix::fs::symlink(outside.path().join("target.json"), root.join("l.json"))
                .unwrap();
            assert_eq!(
                read_bounded(&root.join("l.json"), 100),
                Err(ReadError::Invalid)
            );
            assert_eq!(write_atomic(root, "l.json", &1), Err(WriteError::Unsafe));
            assert_eq!(fs::read(outside.path().join("target.json")).unwrap(), b"{}");
        }
    }
}
