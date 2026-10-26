use crate::journal::AppResult;
use crate::json_file::{self, ReadError};
use serde::{Deserialize, Serialize};
use std::path::Path;
const FILE: &str = "interface-preferences.json";
const LOCALES: [&str; 10] = [
    "it", "en", "de", "fr", "es", "pt-BR", "ja", "ko", "zh-Hans", "ar",
];
/// Options removed in M23. Ticinese readers continue in Italian; the fantasy
/// vocabularies already fell back to English for most text.
const RETIRED: [(&str, &str); 3] = [("lmo-CH", "it"), ("tlh", "en"), ("art-x-rihan", "en")];
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
            locale: "en".into(),
            script: "standard".into(),
            show_original: true,
        }
    }
}
/// English is the default from 0.8.1. An archive created by an earlier
/// version without an explicit choice was shown in Italian: keep it that way
/// by saving Italian once. A fresh install, or any saved choice, is untouched.
pub fn keep_legacy_italian(root: &Path, archive_existed: bool) -> AppResult<()> {
    if !archive_existed || root.join(FILE).exists() {
        return Ok(());
    }
    save(
        root,
        Preferences {
            locale: "it".into(),
            ..Preferences::default()
        },
    )
    .map(|_| ())
}
fn validate(p: &Preferences) -> AppResult<()> {
    if p.version != 2
        || !LOCALES.contains(&p.locale.as_str())
        || ![
            "standard", "braille", "morse", "galactic", "espruar", "dethek",
        ]
        .contains(&p.script.as_str())
    {
        return Err("Unsupported language preferences. Choose an available language.".into());
    }
    Ok(())
}
fn upgrade(mut value: Preferences) -> AppResult<Preferences> {
    if let Some((_, replacement)) = RETIRED.iter().find(|(old, _)| *old == value.locale) {
        value.locale = (*replacement).into();
    }
    if value.version == 1
        && ["standard", "braille", "morse", "galactic"].contains(&value.script.as_str())
    {
        value.version = 2;
    }
    validate(&value)?;
    Ok(value)
}
pub fn read(root: &Path) -> AppResult<Preferences> {
    let damaged =
        || "Interface preferences damaged. You can reset to English from the settings.".to_string();
    let bytes = match json_file::read_bounded(&root.join(FILE), 4096) {
        Ok(Some(bytes)) => bytes,
        Ok(None) => return Ok(Preferences::default()),
        Err(ReadError::Invalid) => return Err(damaged()),
        Err(ReadError::Unreadable) => {
            return Err(
                "Cannot read the interface preferences. Check permissions and try again.".into(),
            )
        }
    };
    let value: Preferences = serde_json::from_slice(&bytes).map_err(|_| damaged())?;
    upgrade(value)
}
pub fn save(root: &Path, value: Preferences) -> AppResult<Preferences> {
    let value = upgrade(value)?;
    json_file::write_atomic(root, FILE, &value).map_err(|e| match e {
        json_file::WriteError::Persist => {
            "Cannot confirm the preferences. The previous language is kept.".to_string()
        }
        _ => "Cannot save the language. Check space and permissions.".to_string(),
    })?;
    Ok(value)
}
#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    #[test]
    fn legacy_archives_keep_italian_and_fresh_installs_start_in_english() {
        let fresh = tempfile::tempdir().unwrap();
        keep_legacy_italian(fresh.path(), false).unwrap();
        assert_eq!(read(fresh.path()).unwrap().locale, "en");
        let legacy = tempfile::tempdir().unwrap();
        keep_legacy_italian(legacy.path(), true).unwrap();
        assert_eq!(read(legacy.path()).unwrap().locale, "it");
        let chosen = tempfile::tempdir().unwrap();
        save(
            chosen.path(),
            Preferences {
                locale: "de".into(),
                ..Preferences::default()
            },
        )
        .unwrap();
        keep_legacy_italian(chosen.path(), true).unwrap();
        assert_eq!(read(chosen.path()).unwrap().locale, "de");
    }
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
    fn retired_locales_move_to_italian_or_english_keeping_other_choices() {
        let root = tempfile::tempdir().unwrap();
        for (old, new) in [("lmo-CH", "it"), ("tlh", "en"), ("art-x-rihan", "en")] {
            let text = format!(
                r#"{{"version":2,"locale":"{old}","script":"braille","showOriginal":false}}"#
            );
            fs::write(root.path().join(FILE), &text).unwrap();
            let current = read(root.path()).unwrap();
            assert_eq!(
                (current.locale.as_str(), current.script.as_str()),
                (new, "braille")
            );
            assert!(!current.show_original);
            assert_eq!(fs::read_to_string(root.path().join(FILE)).unwrap(), text);
            let saved = save(root.path(), current).unwrap();
            assert_eq!(saved.locale, new);
        }
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
