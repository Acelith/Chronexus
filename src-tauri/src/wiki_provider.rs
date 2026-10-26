use crate::journal::AppResult;
use crate::json_file::{self, ReadError, WriteError};
use serde::{Deserialize, Serialize};
use std::path::Path;
/// Global, outside restore generations: restoring campaigns never changes the wiki.
pub const FILE: &str = "wiki-preferences.json";
pub const PROVIDERS: [&str; 2] = ["wikidot", "open5e"];
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct WikiPreferences {
    pub version: u8,
    pub provider: String,
}
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WikiChoice {
    pub provider: String,
    /// False when no explicit choice was ever saved and Wikidot is the default.
    pub explicit: bool,
}
fn validate(p: &WikiPreferences) -> AppResult<()> {
    if p.version != 1 || !PROVIDERS.contains(&p.provider.as_str()) {
        return Err("Unsupported wiki source. Choose Wikidot D&D or Open5e.".into());
    }
    Ok(())
}
pub fn read(root: &Path) -> AppResult<WikiChoice> {
    let bytes = match json_file::read_bounded(&root.join(FILE), 1024) {
        Ok(Some(bytes)) => bytes,
        Ok(None) => {
            return Ok(WikiChoice {
                provider: "wikidot".into(),
                explicit: false,
            })
        }
        Err(ReadError::Unreadable) => {
            return Err("Cannot read the chosen wiki source. Check permissions.".into())
        }
        Err(ReadError::Invalid) => {
            return Err("Wiki source preference damaged. Choose it again in the settings.".into())
        }
    };
    let value: WikiPreferences = serde_json::from_slice(&bytes).map_err(|_| {
        "Wiki source preference damaged. Choose it again in the settings.".to_string()
    })?;
    validate(&value)?;
    Ok(WikiChoice {
        provider: value.provider,
        explicit: true,
    })
}
pub fn save(root: &Path, provider: &str) -> AppResult<WikiChoice> {
    let value = WikiPreferences {
        version: 1,
        provider: provider.into(),
    };
    validate(&value)?;
    json_file::write_atomic(root, FILE, &value).map_err(|e| match e {
        WriteError::Unsafe => "Unsafe destination for the wiki preference.",
        WriteError::Write => "Cannot save the wiki source. Check space and permissions.",
        WriteError::Persist => "Cannot confirm the wiki source. The previous choice is kept.",
    })?;
    read(root)
}
#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    #[test]
    fn defaults_to_wikidot_and_keeps_explicit_choice() {
        let d = tempfile::tempdir().unwrap();
        assert_eq!(
            read(d.path()).unwrap(),
            WikiChoice {
                provider: "wikidot".into(),
                explicit: false
            }
        );
        assert!(
            !d.path().join(FILE).exists(),
            "reading never writes a default"
        );
        assert_eq!(save(d.path(), "open5e").unwrap().provider, "open5e");
        let again = read(d.path()).unwrap();
        assert!(again.explicit);
        assert_eq!(again.provider, "open5e");
        assert!(save(d.path(), "dndbeyond").is_err());
        assert_eq!(read(d.path()).unwrap().provider, "open5e");
        save(d.path(), "wikidot").unwrap();
        assert!(read(d.path()).unwrap().explicit);
    }
    #[test]
    fn damaged_or_future_files_are_reported_without_rewrite() {
        let d = tempfile::tempdir().unwrap();
        for text in [
            "not json",
            r#"{"version":2,"provider":"wikidot"}"#,
            r#"{"version":1,"provider":"wikidot","url":"https://evil.test"}"#,
        ] {
            fs::write(d.path().join(FILE), text).unwrap();
            assert!(read(d.path()).is_err());
            assert_eq!(fs::read_to_string(d.path().join(FILE)).unwrap(), text);
        }
        save(d.path(), "wikidot").unwrap();
        assert_eq!(read(d.path()).unwrap().provider, "wikidot");
    }
}
