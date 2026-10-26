//! M15a: when to announce a real update. Pure policy plus a small preference
//! file kept outside restore generations; installing still needs the M15 flow.
use crate::journal::AppResult;
use crate::json_file::{self, ReadError, WriteError};
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use std::path::Path;

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
        return Err("Invalid update announcement preferences.".into());
    }
    Ok(())
}
pub fn read(root: &Path) -> AppResult<Announcements> {
    let bytes = match json_file::read_bounded(&root.join(FILE), 4096) {
        Ok(Some(bytes)) => bytes,
        Ok(None) => return Ok(Announcements::default()),
        Err(ReadError::Unreadable) => {
            return Err("Cannot read the announcement preferences.".into())
        }
        Err(ReadError::Invalid) => {
            return Err(
                "Announcement preferences damaged. Save them again from the settings.".into(),
            )
        }
    };
    let value: Announcements = serde_json::from_slice(&bytes).map_err(|_| {
        "Announcement preferences damaged. Save them again from the settings.".to_string()
    })?;
    validate(&value)?;
    Ok(value)
}
pub fn write(root: &Path, value: &Announcements) -> AppResult<()> {
    validate(value)?;
    json_file::write_atomic(root, FILE, value).map_err(|e| {
        match e {
            WriteError::Unsafe => "Unsafe destination for the announcement preferences.",
            WriteError::Write => "Cannot save the announcement preferences.",
            WriteError::Persist => "Cannot confirm the announcement preferences.",
        }
        .into()
    })
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
        return Err("Invalid announcement version.".into());
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
        _ => return Err("Invalid announcement choice.".into()),
    }
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
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
