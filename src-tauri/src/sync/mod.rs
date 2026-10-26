//! M24: opt-in sharing client for a self-hosted Chronexus server, which lives
//! in a separate repository (see docs/SYNC_API.md and docs/SERVER_NOTES.md).
//! Every request follows an explicit user action; nothing runs at startup.
//! Only items the user marked as shared leave the device, over HTTPS.
pub mod api;
pub mod auto;
pub mod engine;
#[cfg(test)]
mod tests;

use crate::{
    journal::AppResult,
    json_file::{self, ReadError, WriteError},
};
use reqwest::Url;
use serde::{Deserialize, Serialize};
use std::path::Path;

/// Server address and signed-in session, outside SQLite and backups.
pub const ACCOUNT_FILE: &str = "sync-account.json";
/// Version of the HTTP contract this client speaks (docs/SYNC_API.md).
pub const API_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Session {
    pub account_id: String,
    pub username: String,
    pub display_name: String,
    pub token: String,
    pub device: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Account {
    pub version: u8,
    pub server: Option<String>,
    pub session: Option<Session>,
}
/// What the interface may know: never the token.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AccountView {
    pub server: Option<String>,
    pub signed_in: bool,
    pub account_id: Option<String>,
    pub username: Option<String>,
    pub display_name: Option<String>,
    pub device: Option<String>,
}
impl From<&Account> for AccountView {
    fn from(a: &Account) -> Self {
        Self {
            server: a.server.clone(),
            signed_in: a.session.is_some(),
            account_id: a.session.as_ref().map(|s| s.account_id.clone()),
            username: a.session.as_ref().map(|s| s.username.clone()),
            display_name: a.session.as_ref().map(|s| s.display_name.clone()),
            device: a.session.as_ref().map(|s| s.device.clone()),
        }
    }
}

/// Normalizes a user-entered server address to its HTTPS origin. Plain HTTP
/// is accepted only for loopback test servers, never by the app commands.
pub fn server_url(value: &str, allow_loopback_http: bool) -> AppResult<Url> {
    let value = value.trim();
    if value.len() > 512 {
        return Err("Server address too long.".into());
    }
    let url =
        Url::parse(value).map_err(|_| "Enter the full HTTPS address of the Chronexus server.")?;
    let loopback = url.host_str() == Some("127.0.0.1");
    if !(url.scheme() == "https" || (allow_loopback_http && loopback && url.scheme() == "http"))
        || url.host_str().is_none_or(str::is_empty)
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
        || !matches!(url.path(), "" | "/")
    {
        return Err(
            "Use an HTTPS server address without path, credentials, query or fragment.".into(),
        );
    }
    Url::parse(&url.origin().ascii_serialization())
        .map_err(|_| "Enter the full HTTPS address of the Chronexus server.".into())
}

pub fn read_account(root: &Path) -> AppResult<Account> {
    let bytes = match json_file::read_bounded(&root.join(ACCOUNT_FILE), 16_384) {
        Ok(Some(bytes)) => bytes,
        Ok(None) => {
            return Ok(Account {
                version: 1,
                ..Account::default()
            })
        }
        Err(ReadError::Unreadable) => {
            return Err("Cannot read the sharing account. Check permissions.".into())
        }
        Err(ReadError::Invalid) => {
            return Err("Sharing account file damaged. Sign out and sign in again.".into())
        }
    };
    let account: Account = serde_json::from_slice(&bytes)
        .map_err(|_| "Sharing account file damaged. Sign out and sign in again.")?;
    if account.version != 1 {
        return Err("Sharing account file damaged. Sign out and sign in again.".into());
    }
    Ok(account)
}

pub fn write_account(root: &Path, account: &Account) -> AppResult<()> {
    json_file::write_atomic(root, ACCOUNT_FILE, account).map_err(|e| match e {
        WriteError::Unsafe => "Unsafe destination for the sharing account.".to_string(),
        _ => "Cannot save the sharing account. Check space and permissions.".to_string(),
    })?;
    // The session token is a credential: readable by this user only.
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(
            root.join(ACCOUNT_FILE),
            std::fs::Permissions::from_mode(0o600),
        );
    }
    Ok(())
}

/// Identifiers chosen by the server: opaque, path-safe and bounded.
pub fn remote_id(value: &str) -> AppResult<()> {
    if value.is_empty()
        || value.len() > 64
        || !value
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
    {
        return Err("Invalid identifier from the sharing server.".into());
    }
    Ok(())
}
pub const KINDS: [&str; 4] = ["page", "session", "relationship", "party"];
pub fn kind(value: &str) -> AppResult<()> {
    if !KINDS.contains(&value) {
        return Err("Unsupported shared item type.".into());
    }
    Ok(())
}

/// One sharing network operation at a time: a second one is refused, never queued.
#[derive(Default)]
pub struct Gate(pub tokio::sync::Mutex<()>);
