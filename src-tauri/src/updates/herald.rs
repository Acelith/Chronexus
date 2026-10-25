//! M15a: when to announce a real update. Pure policy plus a small preference
//! file kept outside restore generations; installing still needs the M15 flow.
use crate::journal::AppResult;
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use std::{fs, io::Write, path::Path};
use tempfile::NamedTempFile;

pub const FILE: &str = "update-announcements.json";
/// At most one automatic check per this interval, and one per app session.
pub const CHECK_INTERVAL_HOURS: i64 = 20;
pub const REMIND_AFTER_DAYS: i64 = 3;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Reminder {
    pub version: String,
    pub until: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Announcements {
    pub version: u8,
    pub startup_check: bool,
    pub sound: bool,
    pub last_automatic_check: Option<String>,
    /// A dismissed version is never announced again; a newer one is.
    pub dismissed: Option<String>,
    pub remind: Option<Reminder>,
}
impl Default for Announcements {
    fn default() -> Self {
        Self {
            version: 1,
            startup_check: true,
            sound: true,
            last_automatic_check: None,
            dismissed: None,
            remind: None,
        }
    }
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct HeraldSettings {
    pub startup_check: bool,
    pub sound: bool,
}
fn version_ok(v: &str) -> bool {
    !v.is_empty()
        && v.len() <= 64
        && v.bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'.' || b == b'-' || b == b'+')
}
fn time(s: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|t| t.with_timezone(&Utc))
}
fn validate(a: &Announcements) -> AppResult<()> {
    let bad_time = |s: &Option<String>| s.as_deref().is_some_and(|t| time(t).is_none());
    if a.version != 1
        || bad_time(&a.last_automatic_check)
        || a.dismissed.as_deref().is_some_and(|v| !version_ok(v))
        || a.remind
            .as_ref()
            .is_some_and(|r| !version_ok(&r.version) || time(&r.until).is_none())
    {
        return Err("Preferenze degli annunci di aggiornamento non valide.".into());
    }
    Ok(())
}
pub fn read(root: &Path) -> AppResult<Announcements> {
    let path = root.join(FILE);
    let meta = match fs::symlink_metadata(&path) {
        Ok(m) => m,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Announcements::default()),
        Err(_) => return Err("Impossibile leggere le preferenze degli annunci.".into()),
    };
    if !meta.is_file() || meta.file_type().is_symlink() || meta.len() > 4096 {
        return Err(
            "Preferenze degli annunci danneggiate. Salvale di nuovo dalle impostazioni.".into(),
        );
    }
    let bytes = fs::read(&path).map_err(|_| "Impossibile leggere le preferenze degli annunci.")?;
    let value: Announcements = serde_json::from_slice(&bytes).map_err(|_| {
        "Preferenze degli annunci danneggiate. Salvale di nuovo dalle impostazioni.".to_string()
    })?;
    validate(&value)?;
    Ok(value)
}
pub fn write(root: &Path, value: &Announcements) -> AppResult<()> {
    validate(value)?;
    let path = root.join(FILE);
    if fs::symlink_metadata(&path).is_ok_and(|m| !m.is_file() || m.file_type().is_symlink()) {
        return Err("Destinazione delle preferenze degli annunci non sicura.".into());
    }
    let mut next = NamedTempFile::new_in(root)
        .map_err(|_| "Impossibile salvare le preferenze degli annunci.")?;
    let bytes = serde_json::to_vec_pretty(value).map_err(|_| "Preferenze non serializzabili.")?;
    next.write_all(&bytes)
        .and_then(|_| next.as_file().sync_all())
        .map_err(|_| "Impossibile salvare le preferenze degli annunci.")?;
    next.persist(path)
        .map_err(|_| "Impossibile confermare le preferenze degli annunci.")?;
    Ok(())
}
pub fn settings(a: &Announcements) -> HeraldSettings {
    HeraldSettings {
        startup_check: a.startup_check,
        sound: a.sound,
    }
}
/// Automatic checks need the opt-out off and the interval elapsed.
pub fn should_check(a: &Announcements, now: DateTime<Utc>) -> bool {
    a.startup_check
        && a.last_automatic_check
            .as_deref()
            .and_then(time)
            .is_none_or(|last| now - last >= Duration::hours(CHECK_INTERVAL_HOURS) || last > now)
}
/// Whether a found version may interrupt with the herald.
pub fn should_announce(a: &Announcements, version: &str, now: DateTime<Utc>) -> bool {
    if a.dismissed.as_deref() == Some(version) {
        return false;
    }
    !a.remind
        .as_ref()
        .is_some_and(|r| r.version == version && time(&r.until).is_some_and(|until| now < until))
}
pub fn record_check(a: &mut Announcements, now: DateTime<Utc>) {
    a.last_automatic_check = Some(now.to_rfc3339());
}
pub fn record_choice(
    a: &mut Announcements,
    version: &str,
    choice: &str,
    now: DateTime<Utc>,
) -> AppResult<()> {
    if !version_ok(version) {
        return Err("Versione dell’annuncio non valida.".into());
    }
    match choice {
        "later" => {
            a.remind = Some(Reminder {
                version: version.into(),
                until: (now + Duration::days(REMIND_AFTER_DAYS)).to_rfc3339(),
            })
        }
        "dismiss" => {
            a.dismissed = Some(version.into());
            a.remind = None;
        }
        _ => return Err("Scelta dell’annuncio non valida.".into()),
    }
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    fn at(s: &str) -> DateTime<Utc> {
        time(s).unwrap()
    }
    #[test]
    fn automatic_checks_are_opt_out_and_rate_limited() {
        let now = at("2026-10-25T10:00:00Z");
        let mut a = Announcements::default();
        assert!(should_check(&a, now));
        record_check(&mut a, now);
        assert!(!should_check(&a, now + Duration::hours(19)));
        assert!(should_check(&a, now + Duration::hours(20)));
        // A clock moved backwards does not lock checks out forever.
        assert!(should_check(&a, now - Duration::hours(1)));
        a.startup_check = false;
        assert!(!should_check(&a, now + Duration::days(30)));
    }
    #[test]
    fn dismiss_and_remind_are_per_version_without_loops() {
        let now = at("2026-10-25T10:00:00Z");
        let mut a = Announcements::default();
        assert!(should_announce(&a, "0.5.0", now));
        record_choice(&mut a, "0.5.0", "later", now).unwrap();
        assert!(!should_announce(&a, "0.5.0", now + Duration::days(2)));
        assert!(should_announce(&a, "0.5.0", now + Duration::days(3)));
        assert!(should_announce(&a, "0.5.1", now));
        record_choice(&mut a, "0.5.0", "dismiss", now).unwrap();
        assert!(!should_announce(&a, "0.5.0", now + Duration::days(400)));
        assert!(should_announce(&a, "0.6.0", now));
        assert!(record_choice(&mut a, "../x", "later", now).is_err());
        assert!(record_choice(&mut a, "0.6.0", "install", now).is_err());
    }
    #[test]
    fn file_round_trip_defaults_and_rejects_damage_without_rewrite() {
        let d = tempfile::tempdir().unwrap();
        assert_eq!(read(d.path()).unwrap(), Announcements::default());
        assert!(!d.path().join(FILE).exists());
        let mut a = Announcements {
            sound: false,
            ..Default::default()
        };
        record_choice(&mut a, "0.5.0", "dismiss", at("2026-10-25T10:00:00Z")).unwrap();
        write(d.path(), &a).unwrap();
        assert_eq!(read(d.path()).unwrap(), a);
        for text in [
            "nope",
            r#"{"version":2,"startupCheck":true,"sound":true,"lastAutomaticCheck":null,"dismissed":null,"remind":null}"#,
            r#"{"version":1,"startupCheck":true,"sound":true,"lastAutomaticCheck":"ieri","dismissed":null,"remind":null}"#,
        ] {
            fs::write(d.path().join(FILE), text).unwrap();
            assert!(read(d.path()).is_err());
            assert_eq!(fs::read_to_string(d.path().join(FILE)).unwrap(), text);
        }
    }
}
