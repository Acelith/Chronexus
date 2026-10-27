use crate::journal::AppResult;
use reqwest::{Client, Url};
use tokio_util::sync::CancellationToken;
pub fn url(value: &str) -> AppResult<Url> {
    if value.len() > 2048 {
        return Err("Update address too long.".into());
    }
    let u = Url::parse(value).map_err(|_| "Enter a valid HTTPS address for the update channel.")?;
    if u.scheme() != "https"
        || u.host_str().is_none()
        || !u.username().is_empty()
        || u.password().is_some()
        || u.fragment().is_some()
        || u.query().is_some()
    {
        return Err("Use an HTTPS address without credentials, query or fragment.".into());
    }
    Ok(u)
}
pub fn artifact(endpoint: &Url, download: &Url) -> AppResult<()> {
    url(download.as_str())?;
    if github_source(endpoint) {
        return if github_asset(download) {
            Ok(())
        } else {
            Err("The package must be on the same HTTPS server as the manifest.".into())
        };
    }
    if endpoint.origin() != download.origin() {
        return Err("The package must be on the same HTTPS server as the manifest.".into());
    }
    Ok(())
}
fn github_asset(value: &Url) -> bool {
    value.scheme() == "https"
        && value.port_or_known_default() == Some(443)
        && value.host_str() == Some("github.com")
        && (value
            .path()
            .starts_with("/Acelith/Chronexus/releases/download/")
            || value
                .path()
                .starts_with("/Acelith/Chronexus/releases/latest/download/"))
}
fn github_source(value: &Url) -> bool {
    github_asset(value)
        || (value.scheme() == "https"
            && value.port_or_known_default() == Some(443)
            && value.host_str() == Some("api.github.com")
            && value.path() == "/repos/Acelith/Chronexus/releases/latest")
}
/// Only the fixed GitHub release channel can redirect to GitHub's signed asset CDN.
/// Custom channels retain the original same-origin policy. No credentials are sent.
pub fn redirect(initial: &Url, destination: &Url) -> AppResult<()> {
    if github_source(initial)
        && destination.scheme() == "https"
        && destination.host_str() == Some("release-assets.githubusercontent.com")
        && destination.port_or_known_default() == Some(443)
        && destination.username().is_empty()
        && destination.password().is_none()
        && destination.fragment().is_none()
        && destination.as_str().len() <= 8192
        && destination
            .path()
            .starts_with("/github-production-release-asset/")
    {
        return Ok(());
    }
    artifact(initial, destination)
}
/// Callers validate the initial URL; each redirect is checked before requesting it.
pub async fn fetch(
    client: &Client,
    initial: Url,
    limit: usize,
    cancel: &CancellationToken,
    mut progress: impl FnMut(usize, Option<u64>),
) -> AppResult<Option<Vec<u8>>> {
    let mut destination = initial.clone();
    for _ in 0..=5 {
        let response = tokio::select! {
            biased;
            _ = cancel.cancelled() => return Err("Download cancelled.".into()),
            value = client.get(destination.clone()).send() => value.map_err(|_| "Update server not reachable. Check the connection and the HTTPS certificate.")?,
        };
        if response.status().is_redirection() {
            let location = response
                .headers()
                .get(reqwest::header::LOCATION)
                .and_then(|v| v.to_str().ok())
                .ok_or("Invalid update redirect.")?;
            destination = destination
                .join(location)
                .map_err(|_| "Invalid update redirect.")?;
            redirect(&initial, &destination)?;
            continue;
        }
        match response.status().as_u16() {
            204 => return Ok(None),
            401 | 403 | 404 => return Err("Update channel not public or not published yet. Check that latest.json and the installer can be downloaded without signing in.".into()),
            200 => {},
            _ => return Err("The update server returned an error. Try again later.".into()),
        }
        let total = response.content_length();
        if total.is_some_and(|n| n > limit as u64) {
            return Err("Package over the allowed limit: download blocked.".into());
        }
        let mut response = response;
        let mut bytes = Vec::new();
        loop {
            let chunk = tokio::select! {
            biased;
                _ = cancel.cancelled() => return Err("Download cancelled.".into()),
                value = response.chunk() => value.map_err(|_| "Download interrupted. Try again: nothing was installed.")?,
            };
            let Some(chunk) = chunk else { break };
            if chunk.len() > limit.saturating_sub(bytes.len()) {
                return Err("Package over the allowed limit: download blocked.".into());
            }
            bytes.extend_from_slice(&chunk);
            progress(bytes.len(), total);
        }
        if bytes.is_empty() || total.is_some_and(|n| n != bytes.len() as u64) {
            return Err("Incomplete download: no update installed.".into());
        }
        return Ok(Some(bytes));
    }
    Err("Too many redirects in the update channel.".into())
}

/// Accept either a static Tauri manifest or a public latest-release API response.
pub fn manifest_asset(
    value: &serde_json::Value,
    endpoint: &Url,
) -> AppResult<Option<(Url, String)>> {
    if value.get("platforms").is_some() {
        return Ok(None);
    }
    if value["draft"].as_bool() != Some(false) || value["prerelease"].as_bool() != Some(false) {
        return Err("The channel does not contain a published stable release.".into());
    }
    let tag = value["tag_name"]
        .as_str()
        .filter(|s| !s.is_empty() && s.len() < 100)
        .ok_or("Invalid GitHub release version.")?;
    let matches = value["assets"]
        .as_array()
        .ok_or("Release assets missing.")?
        .iter()
        .filter(|a| a["name"] == "latest.json")
        .collect::<Vec<_>>();
    if matches.len() != 1 {
        return Err("The release must contain exactly one public latest.json asset.".into());
    }
    let download = url(matches[0]["browser_download_url"]
        .as_str()
        .ok_or("Manifest address missing.")?)?;
    artifact(endpoint, &download)?;
    Ok(Some((download, tag.into())))
}
