use crate::journal::AppResult;
use serde::{Deserialize, Serialize};
use std::{fs, io::Write, path::Path};
use tempfile::NamedTempFile;
const FILE: &str = "interface-preferences.json";
const LOCALES: [&str; 13] = [
    "it",
    "en",
    "de",
    "fr",
    "es",
    "pt-BR",
    "ja",
    "ko",
    "zh-Hans",
    "ar",
    "lmo-CH",
    "tlh",
    "art-x-rihan",
];
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Preferences {
    pub version: u8,
    pub locale: String,
    pub script: String,
    pub show_original: bool,
}
impl Default for Preferences {
    fn default() -> Self {
        Self {
            version: 2,
            locale: "it".into(),
            script: "standard".into(),
            show_original: true,
        }
    }
}
fn validate(p: &Preferences) -> AppResult<()> {
    if p.version != 2
        || !LOCALES.contains(&p.locale.as_str())
        || ![
            "standard", "braille", "morse", "galactic", "espruar", "dethek",
        ]
        .contains(&p.script.as_str())
    {
        return Err(
            "Preferenze linguistiche non supportate. Scegli una lingua disponibile.".into(),
        );
    }
    Ok(())
}
fn upgrade(mut value: Preferences) -> AppResult<Preferences> {
    if value.version == 1
        && ["standard", "braille", "morse", "galactic"].contains(&value.script.as_str())
    {
        value.version = 2;
    }
    validate(&value)?;
    Ok(value)
}
pub fn read(root: &Path) -> AppResult<Preferences> {
    let path = root.join(FILE);
    let bytes = match fs::read(path) {
        Ok(bytes) => bytes,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Preferences::default()),
        Err(_) => return Err(
            "Impossibile leggere le preferenze dell’interfaccia. Verifica i permessi e riprova."
                .into(),
        ),
    };
    if bytes.len() > 4096 {
        return Err("Preferenze dell’interfaccia danneggiate. Puoi ripristinare l’italiano dalle impostazioni.".into());
    }
    let value:Preferences=serde_json::from_slice(&bytes).map_err(|_|"Preferenze dell’interfaccia danneggiate. Puoi ripristinare l’italiano dalle impostazioni.".to_string())?;
    upgrade(value)
}
pub fn save(root: &Path, value: Preferences) -> AppResult<Preferences> {
    let value = upgrade(value)?;
    let mut next = NamedTempFile::new_in(root)
        .map_err(|_| "Impossibile salvare la lingua. Verifica spazio e permessi.".to_string())?;
    let bytes = serde_json::to_vec_pretty(&value)
        .map_err(|_| "Preferenze linguistiche non valide.".to_string())?;
    next.write_all(&bytes)
        .and_then(|_| next.as_file().sync_all())
        .map_err(|_| "Impossibile salvare la lingua. Verifica spazio e permessi.".to_string())?;
    next.persist(root.join(FILE)).map_err(|_| {
        "Impossibile confermare le preferenze. La lingua precedente è conservata.".to_string()
    })?;
    Ok(value)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn default_round_trip_and_recovery() {
        let d = tempfile::tempdir().unwrap();
        assert_eq!(read(d.path()).unwrap(), Preferences::default());
        for locale in LOCALES {
            for script in [
                "standard", "braille", "morse", "galactic", "espruar", "dethek",
            ] {
                let p = Preferences {
                    version: 2,
                    locale: locale.into(),
                    script: script.into(),
                    show_original: false,
                };
                assert_eq!(save(d.path(), p.clone()).unwrap(), p);
                assert_eq!(read(d.path()).unwrap(), p);
            }
        }
        fs::write(d.path().join(FILE), b"invalid").unwrap();
        assert!(read(d.path()).is_err());
        save(d.path(), Preferences::default()).unwrap();
        assert_eq!(read(d.path()).unwrap(), Preferences::default());
    }
    #[test]
    fn invalid_preferences_cannot_replace_previous() {
        let d = tempfile::tempdir().unwrap();
        let prior = Preferences::default();
        save(d.path(), prior.clone()).unwrap();
        let mut bad = prior.clone();
        bad.locale = "unknown".into();
        assert!(save(d.path(), bad).is_err());
        assert_eq!(read(d.path()).unwrap(), prior);
        assert!(serde_json::from_str::<Preferences>(r#"{"version":1,"locale":"it","script":"standard","showOriginal":true,"path":"elsewhere"}"#).is_err());
    }
    #[test]
    fn upgrades_legacy_preferences_without_rewriting_on_read() {
        let root = tempfile::tempdir().unwrap();
        let path = root.path().join(FILE);
        let original = br#"{"version":1,"locale":"de","script":"morse","showOriginal":false}"#;
        fs::write(&path, original).unwrap();
        let current = read(root.path()).unwrap();
        assert_eq!(current.version, 2);
        assert_eq!(current.locale, "de");
        assert_eq!(current.script, "morse");
        assert!(!current.show_original);
        assert_eq!(fs::read(&path).unwrap(), original);
        save(root.path(), current).unwrap();
        let saved: Preferences = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
        assert_eq!(saved.version, 2);
    }
    #[test]
    fn rejects_new_alphabets_mislabeled_as_v1_and_unknown_future_versions() {
        let root = tempfile::tempdir().unwrap();
        for text in [
            r#"{"version":1,"locale":"it","script":"espruar","showOriginal":true}"#,
            r#"{"version":3,"locale":"it","script":"dethek","showOriginal":true}"#,
        ] {
            fs::write(root.path().join(FILE), text).unwrap();
            assert!(read(root.path()).is_err());
            assert_eq!(fs::read_to_string(root.path().join(FILE)).unwrap(), text);
        }
    }
}
