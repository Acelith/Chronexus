//! Bounded download of the official Ollama archive, SHA-256 verification and
//! staged extraction. Partial files never become an installed runtime.
use super::{base_dir, margin, runtime_dir, write_receipt, Progress};
use crate::journal::AppResult;
use reqwest::{Client, Url};
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::{self, Read, Write},
    path::Path,
    time::Duration,
};
use tokio_util::sync::CancellationToken;

const REDIRECT_HOSTS: [&str; 2] = [
    "release-assets.githubusercontent.com",
    "objects.githubusercontent.com",
];
const MAX_ENTRIES: usize = 10_000;
const MAX_UNPACKED: u64 = 6 << 30;

pub struct Source<'a> {
    pub url: &'a str,
    pub sha256: &'a str,
    pub bytes: u64,
    pub unpacked: u64,
    /// Tests only: plain-HTTP loopback servers stand in for GitHub.
    pub loopback_test: bool,
}
pub fn allowed(url: &Url, initial: &Url, loopback_test: bool) -> bool {
    if loopback_test {
        return url.host_str() == Some("127.0.0.1") && url.port() == initial.port();
    }
    url.scheme() == "https"
        && url.username().is_empty()
        && url.password().is_none()
        && url.fragment().is_none()
        && (url.as_str() == initial.as_str()
            || url.host_str().is_some_and(|h| REDIRECT_HOSTS.contains(&h)))
}
fn client(loopback_test: bool) -> AppResult<Client> {
    Client::builder()
        .https_only(!loopback_test)
        .no_proxy()
        .redirect(reqwest::redirect::Policy::none())
        .connect_timeout(Duration::from_secs(20))
        .read_timeout(Duration::from_secs(60))
        .user_agent(concat!(
            "Chronexus/",
            env!("CARGO_PKG_VERSION"),
            " (explicit runtime setup)"
        ))
        .build()
        .map_err(|_| "Connection for the Ollama download not available.".into())
}
fn cleanup(path: &Path) {
    if path.is_dir() {
        let _ = fs::remove_dir_all(path);
    } else {
        let _ = fs::remove_file(path);
    }
}
pub async fn install(
    root: &Path,
    source: &Source<'_>,
    token: &CancellationToken,
    mut progress: impl FnMut(Progress),
) -> AppResult<()> {
    let target = runtime_dir(root);
    if target.exists() {
        return Err("A managed runtime folder already exists: remove it from the settings before reinstalling.".into());
    }
    let base = base_dir(root);
    fs::create_dir_all(&base).map_err(|_| "Cannot create the runtime folder.")?;
    let need = source.bytes + source.unpacked + margin();
    if super::available_space(&base).is_some_and(|free| free < need) {
        return Err(format!(
            "Not enough space: about {:.1} GB free are needed.",
            need as f64 / 1e9
        ));
    }
    let id = uuid::Uuid::new_v4();
    let archive = base.join(format!(".download-{id}.zip.part"));
    let staging = base.join(format!(".staging-{id}"));
    let result = async {
        download(source, &archive, token, &mut progress).await?;
        progress(Progress {
            phase: "extract".into(),
            done: 0,
            total: None,
            detail: None,
        });
        let archive2 = archive.clone();
        let staging2 = staging.clone();
        let unpacked = source.unpacked;
        let files = tokio::task::spawn_blocking(move || extract(&archive2, &staging2, unpacked))
            .await
            .map_err(|_| "Ollama extraction interrupted.".to_string())??;
        if token.is_cancelled() {
            return Err("Ollama installation cancelled.".to_string());
        }
        write_receipt(&staging, files)?;
        fs::rename(&staging, &target)
            .map_err(|_| "Cannot complete the runtime installation.".to_string())?;
        Ok(())
    }
    .await;
    cleanup(&archive);
    if result.is_err() {
        cleanup(&staging);
    }
    result
}
async fn download(
    source: &Source<'_>,
    path: &Path,
    token: &CancellationToken,
    progress: &mut impl FnMut(Progress),
) -> AppResult<()> {
    let initial = Url::parse(source.url).map_err(|_| "Invalid Ollama address.")?;
    let client = client(source.loopback_test)?;
    let mut url = initial.clone();
    let mut response = None;
    for _ in 0..4 {
        if !allowed(&url, &initial, source.loopback_test) {
            return Err(
                "The Ollama download was redirected outside the official hosts: stopped.".into(),
            );
        }
        let r = tokio::select! {
            biased;
            _ = token.cancelled() => return Err("Ollama download cancelled.".into()),
            r = client.get(url.clone()).send() => r.map_err(|_| "GitHub not reachable. Check the connection and try again.")?,
        };
        if r.status().is_redirection() {
            url = r
                .headers()
                .get(reqwest::header::LOCATION)
                .and_then(|v| v.to_str().ok())
                .and_then(|l| url.join(l).ok())
                .ok_or("Invalid download redirect.")?;
            continue;
        }
        if !r.status().is_success() {
            return Err(format!(
                "Ollama download failed (HTTP {}).",
                r.status().as_u16()
            ));
        }
        response = Some(r);
        break;
    }
    let mut response = response.ok_or("Too many redirects in the Ollama download.")?;
    if response.content_length().is_some_and(|n| n != source.bytes) {
        return Err("Unexpected Ollama archive size: download stopped.".into());
    }
    let mut file = fs::File::create(path).map_err(|_| "Cannot write the download.")?;
    let mut hash = Sha256::new();
    let mut done = 0u64;
    let mut last = 0u64;
    loop {
        let chunk = tokio::select! {
            biased;
            _ = token.cancelled() => return Err("Ollama download cancelled.".into()),
            c = response.chunk() => c.map_err(|_| "Ollama download interrupted. Try again.")?,
        };
        let Some(chunk) = chunk else { break };
        done += chunk.len() as u64;
        if done > source.bytes {
            return Err("Ollama archive larger than expected: download stopped.".into());
        }
        hash.update(&chunk);
        file.write_all(&chunk)
            .map_err(|_| "Writing the download failed: check free space.")?;
        if done - last >= 4 << 20 || done == source.bytes {
            last = done;
            progress(Progress {
                phase: "download".into(),
                done,
                total: Some(source.bytes),
                detail: None,
            });
        }
    }
    file.sync_all().map_err(|_| "Download not saved.")?;
    progress(Progress {
        phase: "verify".into(),
        done,
        total: Some(source.bytes),
        detail: None,
    });
    if done != source.bytes || format!("{:x}", hash.finalize()) != source.sha256 {
        return Err("The downloaded archive does not match the official Ollama digest: it was not installed.".into());
    }
    Ok(())
}
fn extract(archive: &Path, staging: &Path, limit: u64) -> AppResult<usize> {
    let file = fs::File::open(archive).map_err(|_| "Ollama archive not readable.")?;
    let mut zip = zip::ZipArchive::new(file).map_err(|_| "Invalid Ollama archive.")?;
    if zip.len() > MAX_ENTRIES {
        return Err("Ollama archive contains too many files.".into());
    }
    let budget = limit.max(1).saturating_mul(2).min(MAX_UNPACKED);
    let mut written = 0u64;
    let mut files = 0;
    fs::create_dir_all(staging).map_err(|_| "Cannot prepare the extraction.")?;
    for i in 0..zip.len() {
        let mut entry = zip.by_index(i).map_err(|_| "Invalid archive entry.")?;
        let relative = entry
            .enclosed_name()
            .ok_or("Unsafe path in the Ollama archive.")?;
        let out = staging.join(relative);
        if entry.is_dir() {
            fs::create_dir_all(&out).map_err(|_| "Cannot create a runtime folder.")?;
            continue;
        }
        if let Some(parent) = out.parent() {
            fs::create_dir_all(parent).map_err(|_| "Cannot create a runtime folder.")?;
        }
        let mut target = fs::File::create(&out).map_err(|_| "Cannot write a runtime file.")?;
        let copied = io::copy(&mut (&mut entry).take(budget - written + 1), &mut target)
            .map_err(|_| "Ollama extraction failed: check free space.")?;
        written += copied;
        if written > budget {
            return Err("Ollama archive larger than expected after extraction.".into());
        }
        files += 1;
    }
    if !staging.join(super::EXECUTABLE).is_file() {
        return Err("The archive does not contain the expected Ollama executable.".into());
    }
    Ok(files)
}
