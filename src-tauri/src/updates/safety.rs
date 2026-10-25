use super::{Settings, DEFAULT_ENDPOINT};
use crate::{
    backup::{self, BackupReceipt, Store},
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
fn read_json(path: &Path) -> AppResult<Option<serde_json::Value>> {
    let meta = match fs::symlink_metadata(path) {
        Ok(m) => m,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(_) => {
            return Err(
                "Impossibile leggere le preferenze da proteggere prima dell’aggiornamento.".into(),
            )
        }
    };
    if !meta.is_file() || meta.file_type().is_symlink() || meta.len() > 16_384 {
        return Err("File delle preferenze non valido: aggiornamento bloccato.".into());
    }
    let bytes = fs::read(path).map_err(|_| "Preferenze non leggibili.")?;
    serde_json::from_slice(&bytes).map(Some).map_err(|_| {
        "Preferenze danneggiate: conserva i dati e correggile prima di aggiornare.".into()
    })
}
pub fn read_settings(root: &Path) -> AppResult<Settings> {
    let settings = match read_json(&root.join(FILE))? {
        Some(value) => {
            serde_json::from_value(value).map_err(|_| "Preferenze aggiornamenti non valide.")?
        }
        None => Settings {
            endpoint: DEFAULT_ENDPOINT.into(),
        },
    };
    super::network::url(&settings.endpoint)?;
    Ok(settings)
}
pub fn write_settings(root: &Path, settings: &Settings) -> AppResult<()> {
    let path = root.join(FILE);
    if fs::symlink_metadata(&path).is_ok_and(|m| !m.is_file() || m.file_type().is_symlink()) {
        return Err("Destinazione preferenze aggiornamenti non sicura.".into());
    }
    let mut f =
        NamedTempFile::new_in(root).map_err(|_| "Impossibile salvare il canale aggiornamenti.")?;
    serde_json::to_writer_pretty(f.as_file_mut(), settings)
        .map_err(|_| "Preferenze aggiornamenti non serializzabili.")?;
    f.flush()
        .and_then(|_| f.as_file().sync_all())
        .map_err(|_| "Preferenze aggiornamenti non salvate.")?;
    f.persist(path)
        .map_err(|_| "Impossibile salvare il canale aggiornamenti.")?;
    backup::sync_dir(root)
}
/// The installer callback is unreachable if snapshot creation or verification fails.
pub fn before_install<T>(
    store: &Store,
    target: &str,
    install: impl FnOnce(&BackupReceipt) -> AppResult<T>,
) -> AppResult<T> {
    let directory = store.root.join("update-backups");
    fs::create_dir_all(&directory)
        .map_err(|_| "Impossibile creare la cartella dei backup: installazione bloccata.")?;
    let meta = fs::symlink_metadata(&directory).map_err(|_| "Cartella backup non leggibile.")?;
    if !meta.is_dir() || meta.file_type().is_symlink() {
        return Err("Cartella backup non sicura: installazione bloccata.".into());
    }
    let preferences = read_json(&store.root.join("interface-preferences.json"))?;
    let settings = read_settings(&store.root)?;
    let wiki = read_json(&store.root.join(crate::wiki_provider::FILE))?;
    let announcements = read_json(&store.root.join(super::herald::FILE))?;
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
        .map_err(|_| "Backup creato ma non rileggibile: installazione bloccata.")?;
    let mut hash = Sha256::new();
    let mut bytes = [0; 65536];
    loop {
        let n = file
            .read(&mut bytes)
            .map_err(|_| "Backup non verificabile.")?;
        if n == 0 {
            break;
        }
        hash.update(&bytes[..n]);
    }
    let record = json!({"format":"chronexus-update-backup","version":1,"fromVersion":env!("CARGO_PKG_VERSION"),"targetVersion":target,"backup":receipt.path,"sha256":format!("{:x}",hash.finalize()),"interfacePreferences":preferences,"updateSettings":settings,"wikiPreferences":wiki,"updateAnnouncements":announcements});
    let mut sidecar = NamedTempFile::new_in(&directory)
        .map_err(|_| "Backup creato ma ricevuta non salvabile: installazione bloccata.")?;
    serde_json::to_writer_pretty(sidecar.as_file_mut(), &record)
        .map_err(|_| "Ricevuta backup non serializzabile.")?;
    sidecar
        .as_file()
        .sync_all()
        .map_err(|_| "Ricevuta backup non salvata.")?;
    sidecar
        .persist_noclobber(directory.join(format!("{name}.json")))
        .map_err(|_| "Ricevuta backup non salvata: installazione bloccata.")?;
    backup::sync_dir(&directory)?;
    install(&receipt)
}
