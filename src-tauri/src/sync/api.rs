//! HTTP client for the versioned Chronexus server contract (docs/SYNC_API.md and the
//! server's generated OpenAPI). Responses are untrusted data: bounded, parsed into typed
//! values, validated. Failures are classified so the engine can tell "try again later"
//! from "sign in again" from "resynchronize".
use super::{kind, remote_id, API_VERSION};
use crate::journal::AppResult;
use lines::LineReader;
use reqwest::{Method, Url};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::Duration;

const MAX_RESPONSE: usize = 8 * 1024 * 1024;
/// A single `/sync` page holds at most this many items (server limit with margin).
const MAX_PAGE_ITEMS: usize = 1000;

/// Why a request did not complete. Messages are English; the interface translates
/// from the variant, never from server text.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Failure {
    /// Network, timeout, 429 or 5xx: nothing was lost, retry later.
    Unavailable(String),
    /// 401: the session is gone; the user must sign in again.
    Unauthorized(String),
    /// 410 for a sync cursor: re-list the campaign and resume from its head.
    CursorExpired,
    /// 410 for an old operation ID: re-read the item and create a new operation.
    RequestExpired,
    /// The server understood and refused; retrying the same request cannot help.
    Rejected(String),
}
impl Failure {
    pub fn message(&self) -> String {
        match self {
            Self::Unavailable(m) | Self::Unauthorized(m) | Self::Rejected(m) => m.clone(),
            Self::CursorExpired => {
                "The server no longer remembers this device's position: resynchronizing.".into()
            }
            Self::RequestExpired => {
                "A pending change is too old to retry safely: it will be re-evaluated.".into()
            }
        }
    }
    /// Worth retrying automatically with backoff.
    pub fn transient(&self) -> bool {
        matches!(self, Self::Unavailable(_))
    }
}
impl std::fmt::Display for Failure {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.message())
    }
}
impl From<Failure> for String {
    fn from(failure: Failure) -> Self {
        failure.message()
    }
}
impl From<String> for Failure {
    fn from(message: String) -> Self {
        Self::Rejected(message)
    }
}
impl From<&str> for Failure {
    fn from(message: &str) -> Self {
        Self::Rejected(message.into())
    }
}
pub type ApiResult<T> = Result<T, Failure>;

pub struct Client {
    http: reqwest::Client,
    streaming: reqwest::Client,
    base: Url,
    token: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Meta {
    pub api: String,
    pub version: u32,
    #[serde(default)]
    pub capabilities: Vec<String>,
}
impl Meta {
    /// Capabilities the continuous replication of this client depends on.
    pub fn supports_replication(&self) -> bool {
        [
            "private-content",
            "idempotent-mutations",
            "incremental-sync",
        ]
        .iter()
        .all(|needed| self.capabilities.iter().any(|c| c == needed))
    }
    pub fn supports_notifications(&self) -> bool {
        self.capabilities
            .iter()
            .any(|c| c == "change-notifications")
    }
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SignedIn {
    pub token: String,
    pub account_id: String,
    pub username: String,
    pub display_name: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RemoteCampaign {
    pub id: String,
    pub name: String,
    pub role: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Invite {
    pub code: String,
    pub role: String,
    pub expires_at: String,
}
/// One item as the server shows it to this account.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Change {
    pub kind: String,
    pub id: String,
    pub author_id: String,
    pub author_name: String,
    pub revision: i64,
    #[serde(default)]
    pub deleted: bool,
    #[serde(default)]
    pub payload: Option<Value>,
    pub updated_at: String,
    /// `private` or `members`; absent on the legacy feed (always shared).
    #[serde(default)]
    pub visibility: Option<String>,
}
impl Change {
    pub fn visibility(&self) -> &str {
        self.visibility.as_deref().unwrap_or("members")
    }
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Page {
    pub items: Vec<Change>,
    pub cursor: String,
    #[serde(default)]
    pub more: bool,
    /// Present on the full listing: where to resume `/sync` afterwards.
    #[serde(default)]
    pub head: Option<String>,
}
/// Outcome of a write guarded by the last known server revision.
#[derive(Debug, PartialEq)]
pub enum Write {
    Accepted {
        revision: i64,
    },
    Conflict {
        revision: i64,
        payload: Option<Value>,
    },
    Missing,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Current {
    revision: i64,
    #[serde(default)]
    payload: Option<Value>,
}

impl Client {
    /// `allow_loopback_http` exists for the in-repo contract tests only.
    pub fn new(base: Url, token: Option<String>, allow_loopback_http: bool) -> AppResult<Self> {
        let build = |timeout: Option<Duration>| {
            let mut builder = reqwest::Client::builder()
                .redirect(reqwest::redirect::Policy::none())
                .https_only(!allow_loopback_http)
                .connect_timeout(Duration::from_secs(10))
                .user_agent(concat!("Chronexus/", env!("CARGO_PKG_VERSION")));
            if let Some(limit) = timeout {
                builder = builder.read_timeout(limit).timeout(Duration::from_secs(60));
            }
            builder.build()
        };
        let http = build(Some(Duration::from_secs(30)))
            .map_err(|_| "Connection to the sharing server not available.")?;
        let streaming =
            build(None).map_err(|_| "Connection to the sharing server not available.")?;
        Ok(Self {
            http,
            streaming,
            base,
            token,
        })
    }
    /// The session token, for the in-repo tests that build a second client.
    #[cfg(test)]
    pub fn token(&self) -> Option<&str> {
        self.token.as_deref()
    }
    fn url(&self, path: &str) -> ApiResult<Url> {
        self.base
            .join(path)
            .map_err(|_| Failure::Rejected("Invalid sharing server address.".into()))
    }
    async fn send(
        &self,
        method: Method,
        url: Url,
        body: Option<Value>,
        extra: Option<(&str, &str)>,
    ) -> ApiResult<(u16, Value)> {
        let mut request = self.http.request(method, url);
        if let Some(token) = &self.token {
            request = request.bearer_auth(token);
        }
        if let Some((name, value)) = extra {
            request = request.header(name, value);
        }
        if let Some(body) = body {
            request = request.json(&body);
        }
        let mut response = request.send().await.map_err(|_| {
            Failure::Unavailable("Sharing server not reachable. Check the address, the connection and its HTTPS certificate.".into())
        })?;
        let status = response.status();
        if status.is_redirection() {
            return Err(Failure::Rejected(
                "The sharing server answered with a redirect: request stopped.".into(),
            ));
        }
        if response
            .content_length()
            .is_some_and(|n| n > MAX_RESPONSE as u64)
        {
            return Err(Failure::Rejected(
                "Answer from the sharing server too large.".into(),
            ));
        }
        let mut bytes = Vec::new();
        while let Some(chunk) = response.chunk().await.map_err(|_| {
            Failure::Unavailable("Connection to the sharing server interrupted.".into())
        })? {
            if bytes.len() + chunk.len() > MAX_RESPONSE {
                return Err(Failure::Rejected(
                    "Answer from the sharing server too large.".into(),
                ));
            }
            bytes.extend_from_slice(&chunk);
        }
        let value = if bytes.is_empty() {
            Value::Null
        } else {
            serde_json::from_slice(&bytes)
                .map_err(|_| Failure::Rejected("Invalid answer from the sharing server.".into()))?
        };
        Ok((status.as_u16(), value))
    }
    async fn call<T: DeserializeOwned>(
        &self,
        method: Method,
        path: &str,
        body: Option<Value>,
    ) -> ApiResult<T> {
        let (status, value) = self.send(method, self.url(path)?, body, None).await?;
        if !(200..300).contains(&status) {
            return Err(failure(status));
        }
        serde_json::from_value(value)
            .map_err(|_| Failure::Rejected("Invalid answer from the sharing server.".into()))
    }

    pub async fn meta(&self) -> ApiResult<Meta> {
        let meta: Meta = self.call(Method::GET, "/api/v1/meta", None).await?;
        if meta.api != "chronexus-sync" {
            return Err(Failure::Rejected(
                "This address is not a Chronexus sharing server.".into(),
            ));
        }
        if meta.version != API_VERSION {
            return Err(Failure::Rejected(format!(
                "The sharing server speaks protocol version {}; this Chronexus needs version {API_VERSION}.",
                meta.version
            )));
        }
        Ok(meta)
    }
    pub async fn login(&self, username: &str, password: &str, device: &str) -> ApiResult<SignedIn> {
        self.signed_in(
            "/api/v1/auth/login",
            json!({"username":username,"password":password,"device":device}),
        )
        .await
    }
    pub async fn redeem(
        &self,
        code: &str,
        username: &str,
        display_name: &str,
        password: &str,
        device: &str,
    ) -> ApiResult<SignedIn> {
        self.signed_in(
            "/api/v1/auth/redeem",
            json!({"inviteCode":code,"username":username,"displayName":display_name,"password":password,"device":device}),
        )
        .await
    }
    async fn signed_in(&self, path: &str, body: Value) -> ApiResult<SignedIn> {
        let s: SignedIn = self.call(Method::POST, path, Some(body)).await?;
        remote_id(&s.account_id)?;
        if s.token.len() < 32
            || s.token.len() > 512
            || !s.token.bytes().all(|b| b.is_ascii_graphic())
        {
            return Err(Failure::Rejected(
                "Invalid answer from the sharing server.".into(),
            ));
        }
        Ok(s)
    }
    pub async fn logout(&self) -> ApiResult<()> {
        let (status, _) = self
            .send(Method::POST, self.url("/api/v1/auth/logout")?, None, None)
            .await?;
        if (200..300).contains(&status) || status == 401 {
            Ok(())
        } else {
            Err(failure(status))
        }
    }
    pub async fn create_campaign(&self, name: &str) -> ApiResult<RemoteCampaign> {
        checked(
            self.call(
                Method::POST,
                "/api/v1/campaigns",
                Some(json!({"name":name})),
            )
            .await?,
        )
    }
    pub async fn campaigns(&self) -> ApiResult<Vec<RemoteCampaign>> {
        let list: Vec<RemoteCampaign> = self.call(Method::GET, "/api/v1/campaigns", None).await?;
        if list.len() > 200 {
            return Err(Failure::Rejected(
                "Invalid answer from the sharing server.".into(),
            ));
        }
        list.into_iter().map(checked).collect()
    }
    pub async fn join(&self, code: &str) -> ApiResult<RemoteCampaign> {
        checked(
            self.call(
                Method::POST,
                "/api/v1/campaigns/join",
                Some(json!({"inviteCode":code})),
            )
            .await?,
        )
    }
    pub async fn invite(&self, campaign: &str, role: &str) -> ApiResult<Invite> {
        remote_id(campaign)?;
        self.call(
            Method::POST,
            &format!("/api/v1/campaigns/{campaign}/invites"),
            Some(json!({"role":role})),
        )
        .await
    }
    fn page(status: u16, value: Value) -> ApiResult<Page> {
        match status {
            200 => {}
            410 => return Err(Failure::CursorExpired),
            _ => return Err(failure(status)),
        }
        let page: Page = serde_json::from_value(value)
            .map_err(|_| Failure::Rejected("Invalid answer from the sharing server.".into()))?;
        if page.cursor.len() > 128 || page.items.len() > MAX_PAGE_ITEMS {
            return Err(Failure::Rejected(
                "Invalid answer from the sharing server.".into(),
            ));
        }
        for c in &page.items {
            kind(&c.kind)?;
            crate::journal::identifier(&c.id)?;
            remote_id(&c.author_id)?;
            if c.revision < 1
                || c.author_name.trim().is_empty()
                || c.author_name.chars().count() > 100
                || !["private", "members"].contains(&c.visibility())
                || (!c.deleted && c.payload.is_none())
            {
                return Err(Failure::Rejected(
                    "Invalid answer from the sharing server.".into(),
                ));
            }
        }
        Ok(page)
    }
    /// Authorized current state of everything that changed since `cursor`.
    pub async fn sync(&self, campaign: &str, cursor: &str) -> ApiResult<Page> {
        remote_id(campaign)?;
        let mut url = self.url(&format!("/api/v1/campaigns/{campaign}/sync"))?;
        url.query_pairs_mut().append_pair("cursor", cursor);
        let (status, value) = self.send(Method::GET, url, None, None).await?;
        Self::page(status, value)
    }
    /// One page of the full current listing, used to resynchronize.
    pub async fn list(&self, campaign: &str, after: &str) -> ApiResult<Page> {
        remote_id(campaign)?;
        let mut url = self.url(&format!("/api/v1/campaigns/{campaign}/content"))?;
        url.query_pairs_mut().append_pair("after", after);
        let (status, value) = self.send(Method::GET, url, None, None).await?;
        if status == 410 {
            return Err(failure(status));
        }
        Self::page(status, value)
    }
    fn content_url(&self, campaign: &str, kind_name: &str, id: &str) -> ApiResult<Url> {
        remote_id(campaign)?;
        kind(kind_name)?;
        crate::journal::identifier(id)?;
        self.url(&format!(
            "/api/v1/campaigns/{campaign}/content/{kind_name}/{id}"
        ))
    }
    #[allow(clippy::too_many_arguments)]
    pub async fn put(
        &self,
        campaign: &str,
        kind_name: &str,
        id: &str,
        request_id: &str,
        base: i64,
        visibility: &str,
        payload: &Value,
    ) -> ApiResult<Write> {
        let url = self.content_url(campaign, kind_name, id)?;
        let (status, value) = self
            .send(
                Method::PUT,
                url,
                Some(json!({"requestId":request_id,"baseRevision":base,"visibility":visibility,"payload":payload})),
                None,
            )
            .await?;
        written(status, value)
    }
    pub async fn delete(
        &self,
        campaign: &str,
        kind_name: &str,
        id: &str,
        request_id: &str,
        base: i64,
    ) -> ApiResult<Write> {
        let mut url = self.content_url(campaign, kind_name, id)?;
        url.query_pairs_mut()
            .append_pair("baseRevision", &base.to_string())
            .append_pair("requestId", request_id);
        let (status, value) = self.send(Method::DELETE, url, None, None).await?;
        written(status, value)
    }

    /// Opens the content-free notification stream. `on_hint` runs for every `ready` or
    /// `changed` frame; the call returns when the stream ends, which the caller treats as
    /// "reconnect after a pause". Frames carry no data, so nothing from them is stored.
    pub async fn listen(&self, campaign: &str, mut on_hint: impl FnMut()) -> ApiResult<()> {
        remote_id(campaign)?;
        let url = self.url(&format!("/api/v1/campaigns/{campaign}/events"))?;
        let mut request = self
            .streaming
            .get(url)
            .header("accept", "text/event-stream");
        if let Some(token) = &self.token {
            request = request.bearer_auth(token);
        }
        let mut response = request.send().await.map_err(|_| {
            Failure::Unavailable("Sharing server not reachable. Check the address, the connection and its HTTPS certificate.".into())
        })?;
        if !response.status().is_success() {
            return Err(failure(response.status().as_u16()));
        }
        let mut reader = LineReader::default();
        let mut event = String::new();
        while let Some(chunk) = response.chunk().await.map_err(|_| {
            Failure::Unavailable("Connection to the sharing server interrupted.".into())
        })? {
            for line in reader.push(&chunk) {
                match line.as_deref() {
                    // Blank line: dispatch the event named by the previous `event:` line.
                    Some("") => {
                        if matches!(event.as_str(), "ready" | "changed") {
                            on_hint();
                        } else if matches!(event.as_str(), "reconnect" | "closed") {
                            return Ok(());
                        }
                        event.clear();
                    }
                    Some(text) => {
                        if let Some(name) = text.strip_prefix("event:") {
                            event = name.trim().chars().take(32).collect();
                        }
                    }
                    // Over-long line: a hostile or broken stream.
                    None => {
                        return Err(Failure::Rejected(
                            "Invalid notification stream from the sharing server.".into(),
                        ))
                    }
                }
            }
        }
        Ok(())
    }
}
fn checked(c: RemoteCampaign) -> ApiResult<RemoteCampaign> {
    remote_id(&c.id)?;
    if !["owner", "player", "reader"].contains(&c.role.as_str()) || c.name.chars().count() > 200 {
        return Err(Failure::Rejected(
            "Invalid answer from the sharing server.".into(),
        ));
    }
    Ok(c)
}
fn written(status: u16, value: Value) -> ApiResult<Write> {
    let invalid = || Failure::Rejected("Invalid answer from the sharing server.".into());
    match status {
        200 | 201 => {
            let current: Current = serde_json::from_value(value).map_err(|_| invalid())?;
            Ok(Write::Accepted {
                revision: current.revision,
            })
        }
        404 => Ok(Write::Missing),
        409 => {
            // A body without `revision` is the server refusing a reused request ID.
            let current: Current = serde_json::from_value(value).map_err(|_| {
                Failure::Rejected(
                    "The server refused a repeated operation identifier. Resynchronize.".into(),
                )
            })?;
            if current.revision < 1 {
                return Err(invalid());
            }
            Ok(Write::Conflict {
                revision: current.revision,
                payload: current.payload,
            })
        }
        410 => Err(Failure::RequestExpired),
        _ => Err(failure(status)),
    }
}
fn failure(status: u16) -> Failure {
    let rejected = |text: &str| Failure::Rejected(text.into());
    match status {
        400 | 422 => rejected("The sharing server rejected the request as invalid."),
        401 => Failure::Unauthorized("Session expired or not valid: sign in again.".into()),
        403 => rejected("Your role in this shared campaign does not allow this operation."),
        404 => rejected("Not found on the sharing server."),
        410 => rejected("The invitation is expired or already used."),
        413 => rejected("Item too large for the sharing server."),
        429 => Failure::Unavailable("Too many requests: waiting before trying again.".into()),
        500..=599 => Failure::Unavailable(format!(
            "The sharing server is not available right now (HTTP {status})."
        )),
        _ => Failure::Rejected(format!(
            "Unexpected answer from the sharing server (HTTP {status})."
        )),
    }
}

/// Splits a byte stream into bounded lines without extra dependencies.
mod lines {
    const MAX_LINE: usize = 512;
    #[derive(Default)]
    pub struct LineReader {
        pending: Vec<u8>,
        too_long: bool,
    }
    impl LineReader {
        /// Complete lines in order; `None` marks a line longer than the limit.
        pub fn push(&mut self, chunk: &[u8]) -> Vec<Option<String>> {
            let mut lines = vec![];
            for &byte in chunk {
                match byte {
                    b'\n' => {
                        if self.too_long {
                            lines.push(None);
                        } else {
                            let text = String::from_utf8_lossy(&self.pending)
                                .trim_end_matches('\r')
                                .to_string();
                            lines.push(Some(text));
                        }
                        self.pending.clear();
                        self.too_long = false;
                    }
                    _ if self.too_long => {}
                    _ if self.pending.len() >= MAX_LINE => {
                        self.pending.clear();
                        self.too_long = true;
                    }
                    _ => self.pending.push(byte),
                }
            }
            lines
        }
    }
}

#[cfg(test)]
mod tests {
    use super::lines::LineReader;

    #[test]
    fn lines_survive_chunk_boundaries_and_overlong_lines_are_flagged() {
        let mut reader = LineReader::default();
        assert!(reader.push(b"event: chan").is_empty());
        assert_eq!(
            reader.push(b"ged\r\ndata: {}\n\n"),
            vec![
                Some("event: changed".into()),
                Some("data: {}".into()),
                Some(String::new())
            ]
        );
        let long = vec![b'x'; 600];
        let mut out = reader.push(&long);
        out.extend(reader.push(b"\nok\n"));
        assert_eq!(out, vec![None, Some("ok".into())]);
    }
}
