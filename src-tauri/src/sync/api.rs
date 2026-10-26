//! HTTP client for the versioned Chronexus server contract (docs/SYNC_API.md).
//! Responses are untrusted data: bounded, parsed into typed values, validated.
use super::{kind, remote_id, API_VERSION};
use crate::journal::AppResult;
use reqwest::{Method, Url};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::Duration;

const MAX_RESPONSE: usize = 8 * 1024 * 1024;

pub struct Client {
    http: reqwest::Client,
    base: Url,
    token: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Meta {
    pub api: String,
    pub version: u32,
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
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Changes {
    pub items: Vec<Change>,
    pub cursor: String,
    #[serde(default)]
    pub more: bool,
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
        let http = reqwest::Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .https_only(!allow_loopback_http)
            .connect_timeout(Duration::from_secs(10))
            .read_timeout(Duration::from_secs(30))
            .timeout(Duration::from_secs(60))
            .user_agent(concat!("Chronexus/", env!("CARGO_PKG_VERSION")))
            .build()
            .map_err(|_| "Connection to the sharing server not available.")?;
        Ok(Self { http, base, token })
    }
    fn url(&self, path: &str) -> AppResult<Url> {
        self.base
            .join(path)
            .map_err(|_| "Invalid sharing server address.".into())
    }
    async fn send(&self, method: Method, url: Url, body: Option<Value>) -> AppResult<(u16, Value)> {
        let mut request = self.http.request(method, url);
        if let Some(token) = &self.token {
            request = request.bearer_auth(token);
        }
        if let Some(body) = body {
            request = request.json(&body);
        }
        let mut response = request
            .send()
            .await
            .map_err(|_| "Sharing server not reachable. Check the address, the connection and its HTTPS certificate.")?;
        let status = response.status();
        if status.is_redirection() {
            return Err("The sharing server answered with a redirect: request stopped.".into());
        }
        if response
            .content_length()
            .is_some_and(|n| n > MAX_RESPONSE as u64)
        {
            return Err("Answer from the sharing server too large.".into());
        }
        let mut bytes = Vec::new();
        while let Some(chunk) = response
            .chunk()
            .await
            .map_err(|_| "Connection to the sharing server interrupted.")?
        {
            if bytes.len() + chunk.len() > MAX_RESPONSE {
                return Err("Answer from the sharing server too large.".into());
            }
            bytes.extend_from_slice(&chunk);
        }
        let value = if bytes.is_empty() {
            Value::Null
        } else {
            serde_json::from_slice(&bytes).map_err(|_| "Invalid answer from the sharing server.")?
        };
        Ok((status.as_u16(), value))
    }
    async fn call<T: DeserializeOwned>(
        &self,
        method: Method,
        path: &str,
        body: Option<Value>,
    ) -> AppResult<T> {
        let (status, value) = self.send(method, self.url(path)?, body).await?;
        if !(200..300).contains(&status) {
            return Err(failure(status));
        }
        serde_json::from_value(value).map_err(|_| "Invalid answer from the sharing server.".into())
    }

    pub async fn meta(&self) -> AppResult<Meta> {
        let meta: Meta = self.call(Method::GET, "/api/v1/meta", None).await?;
        if meta.api != "chronexus-sync" {
            return Err("This address is not a Chronexus sharing server.".into());
        }
        if meta.version != API_VERSION {
            return Err(format!(
                "The sharing server speaks protocol version {}; this Chronexus needs version {API_VERSION}.",
                meta.version
            ));
        }
        Ok(meta)
    }
    pub async fn login(&self, username: &str, password: &str, device: &str) -> AppResult<SignedIn> {
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
    ) -> AppResult<SignedIn> {
        self.signed_in(
            "/api/v1/auth/redeem",
            json!({"inviteCode":code,"username":username,"displayName":display_name,"password":password,"device":device}),
        )
        .await
    }
    async fn signed_in(&self, path: &str, body: Value) -> AppResult<SignedIn> {
        let s: SignedIn = self.call(Method::POST, path, Some(body)).await?;
        remote_id(&s.account_id)?;
        if s.token.len() < 32
            || s.token.len() > 512
            || !s.token.bytes().all(|b| b.is_ascii_graphic())
        {
            return Err("Invalid answer from the sharing server.".into());
        }
        Ok(s)
    }
    pub async fn logout(&self) -> AppResult<()> {
        let (status, _) = self
            .send(Method::POST, self.url("/api/v1/auth/logout")?, None)
            .await?;
        if (200..300).contains(&status) || status == 401 {
            Ok(())
        } else {
            Err(failure(status))
        }
    }
    pub async fn create_campaign(&self, name: &str) -> AppResult<RemoteCampaign> {
        checked(
            self.call(
                Method::POST,
                "/api/v1/campaigns",
                Some(json!({"name":name})),
            )
            .await?,
        )
    }
    pub async fn join(&self, code: &str) -> AppResult<RemoteCampaign> {
        checked(
            self.call(
                Method::POST,
                "/api/v1/campaigns/join",
                Some(json!({"inviteCode":code})),
            )
            .await?,
        )
    }
    pub async fn invite(&self, campaign: &str, role: &str) -> AppResult<Invite> {
        remote_id(campaign)?;
        self.call(
            Method::POST,
            &format!("/api/v1/campaigns/{campaign}/invites"),
            Some(json!({"role":role})),
        )
        .await
    }
    pub async fn changes(&self, campaign: &str, cursor: &str) -> AppResult<Changes> {
        remote_id(campaign)?;
        let mut url = self.url(&format!("/api/v1/campaigns/{campaign}/changes"))?;
        url.query_pairs_mut().append_pair("since", cursor);
        let (status, value) = self.send(Method::GET, url, None).await?;
        if status != 200 {
            return Err(failure(status));
        }
        let changes: Changes =
            serde_json::from_value(value).map_err(|_| "Invalid answer from the sharing server.")?;
        if changes.cursor.len() > 128 || changes.items.len() > 1000 {
            return Err("Invalid answer from the sharing server.".into());
        }
        for c in &changes.items {
            kind(&c.kind)?;
            crate::journal::identifier(&c.id)?;
            remote_id(&c.author_id)?;
            if c.revision < 1
                || c.author_name.trim().is_empty()
                || c.author_name.chars().count() > 100
                || (!c.deleted && c.payload.is_none())
            {
                return Err("Invalid answer from the sharing server.".into());
            }
        }
        Ok(changes)
    }
    fn item_url(&self, campaign: &str, kind_name: &str, id: &str) -> AppResult<Url> {
        remote_id(campaign)?;
        kind(kind_name)?;
        crate::journal::identifier(id)?;
        self.url(&format!(
            "/api/v1/campaigns/{campaign}/items/{kind_name}/{id}"
        ))
    }
    pub async fn put_item(
        &self,
        campaign: &str,
        kind_name: &str,
        id: &str,
        base: i64,
        payload: &Value,
    ) -> AppResult<Write> {
        let url = self.item_url(campaign, kind_name, id)?;
        let (status, value) = self
            .send(
                Method::PUT,
                url,
                Some(json!({"baseRevision":base,"payload":payload})),
            )
            .await?;
        written(status, value)
    }
    pub async fn delete_item(
        &self,
        campaign: &str,
        kind_name: &str,
        id: &str,
        base: i64,
    ) -> AppResult<Write> {
        let mut url = self.item_url(campaign, kind_name, id)?;
        url.query_pairs_mut()
            .append_pair("baseRevision", &base.to_string());
        let (status, value) = self.send(Method::DELETE, url, None).await?;
        written(status, value)
    }
}
fn checked(c: RemoteCampaign) -> AppResult<RemoteCampaign> {
    remote_id(&c.id)?;
    if !["owner", "player", "reader"].contains(&c.role.as_str()) || c.name.chars().count() > 200 {
        return Err("Invalid answer from the sharing server.".into());
    }
    Ok(c)
}
fn written(status: u16, value: Value) -> AppResult<Write> {
    match status {
        200 | 201 => {
            let current: Current = serde_json::from_value(value)
                .map_err(|_| "Invalid answer from the sharing server.")?;
            Ok(Write::Accepted {
                revision: current.revision,
            })
        }
        404 => Ok(Write::Missing),
        409 => {
            let current: Current = serde_json::from_value(value)
                .map_err(|_| "Invalid answer from the sharing server.")?;
            if current.revision < 1 {
                return Err("Invalid answer from the sharing server.".into());
            }
            Ok(Write::Conflict {
                revision: current.revision,
                payload: current.payload,
            })
        }
        _ => Err(failure(status)),
    }
}
fn failure(status: u16) -> String {
    match status {
        400 | 422 => "The sharing server rejected the request as invalid.".into(),
        401 => "Session expired or not valid: sign in again.".into(),
        403 => "Your role in this shared campaign does not allow this operation.".into(),
        404 => "Not found on the sharing server.".into(),
        410 => "The invitation is expired or already used.".into(),
        413 => "Item too large for the sharing server.".into(),
        429 => "Too many requests: wait a moment before trying again.".into(),
        500..=599 => format!("The sharing server is not available right now (HTTP {status})."),
        _ => format!("Unexpected answer from the sharing server (HTTP {status})."),
    }
}
