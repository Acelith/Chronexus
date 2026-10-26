//! M22: guided, explicit setup of a Chronexus-managed Ollama runtime and of the
//! qualified models. Every network action follows a click; nothing runs at launch.
//! Campaign data never enters these requests. Existing runtimes are left intact.
pub mod download;
#[cfg(test)]
mod tests;
use crate::{assistant, journal::AppResult};
use reqwest::Client;
use serde::Serialize;
use serde_json::{json, Value};
use std::{
    fs,
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::Mutex,
    time::Duration,
};
use tokio_util::sync::CancellationToken;

pub const OLLAMA_VERSION: &str = "0.40.10";
pub const OLLAMA_URL: &str =
    "https://github.com/ollama/ollama/releases/download/v0.40.10/ollama-windows-amd64.zip";
/// Official `sha256sum.txt` of the v0.40.10 release, checked on 2026-10-25.
pub const OLLAMA_SHA256: &str = "d52aea2d323bdd324bf66a4b1226844aa5fb665cc5974fbcceceda1ce3d934eb";
pub const OLLAMA_BYTES: u64 = 1_586_229_413;
/// Measured size of the extracted official archive, plus a safety margin below.
pub const OLLAMA_EXTRACTED_BYTES: u64 = 2_230_768_655;
const MARGIN: u64 = 1 << 30;
const RECEIPT: &str = "chronexus-runtime.json";

pub fn base_dir(root: &Path) -> PathBuf {
    root.join("ai-runtime")
}
pub fn runtime_dir(root: &Path) -> PathBuf {
    base_dir(root).join(format!("ollama-{OLLAMA_VERSION}"))
}
pub fn models_dir(root: &Path) -> PathBuf {
    base_dir(root).join("models")
}
/// Executable file name inside the pinned archive for this platform.
pub const EXECUTABLE: &str = if cfg!(windows) {
    "ollama.exe"
} else {
    "ollama"
};
/// Only the Windows x64 archive is pinned; other targets must not download it.
pub const SUPPORTED_PLATFORM: bool = cfg!(all(windows, target_arch = "x86_64"));
fn executable(root: &Path) -> PathBuf {
    runtime_dir(root).join(EXECUTABLE)
}
/// A managed runtime counts only with its receipt and executable: partial
/// downloads or extractions are never reported as installed.
pub fn managed_installed(root: &Path) -> bool {
    let receipt = runtime_dir(root).join(RECEIPT);
    fs::read(&receipt)
        .ok()
        .and_then(|b| serde_json::from_slice::<Value>(&b).ok())
        .is_some_and(|v| v["sha256"] == OLLAMA_SHA256 && v["version"] == OLLAMA_VERSION)
        && executable(root).is_file()
}
pub fn available_space(path: &Path) -> Option<u64> {
    let mut probe = path.to_path_buf();
    while !probe.exists() {
        probe = probe.parent()?.to_path_buf();
    }
    fs4::available_space(&probe).ok()
}

#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ModelState {
    pub role: String,
    pub name: String,
    pub label: String,
    pub download_bytes: u64,
    /// absent | ready | unqualified
    pub state: String,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Gpu {
    pub name: String,
    pub memory_mib: u64,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    pub supported_platform: bool,
    pub managed_installed: bool,
    pub managed_running: bool,
    pub runtime_dir: String,
    pub models_dir: String,
    /// stopped | ready | cloud | unknown
    pub runtime: String,
    pub runtime_version: Option<String>,
    pub models: Vec<ModelState>,
    pub gpus: Vec<Gpu>,
    pub free_bytes: Option<u64>,
    pub runtime_download_bytes: u64,
    pub runtime_install_bytes: u64,
}

#[derive(Default)]
pub struct State {
    pub(crate) gate: tokio::sync::Mutex<()>,
    child: Mutex<Option<Child>>,
    cancel: Mutex<Option<CancellationToken>>,
}
impl State {
    pub fn cancel(&self) {
        if let Ok(c) = self.cancel.lock() {
            if let Some(t) = c.as_ref() {
                t.cancel();
            }
        }
    }
    pub(crate) fn token(&self) -> CancellationToken {
        let token = CancellationToken::new();
        if let Ok(mut c) = self.cancel.lock() {
            *c = Some(token.clone());
        }
        token
    }
    pub fn managed_running(&self) -> bool {
        self.child
            .lock()
            .ok()
            .and_then(|mut c| c.as_mut().map(|p| matches!(p.try_wait(), Ok(None))))
            .unwrap_or(false)
    }
    /// The managed runtime lives only as long as Chronexus: stop it on exit.
    pub fn shutdown(&self) {
        if let Ok(mut c) = self.child.lock() {
            if let Some(mut p) = c.take() {
                let _ = p.kill();
                let _ = p.wait();
            }
        }
    }
}

/// Compare installed qualified models with the M18 policy, by weight digest.
pub async fn model_states(client: &Client, base: &str) -> AppResult<Vec<ModelState>> {
    let policy = assistant::models::policy()?;
    let tags = assistant::runtime::get(client, base, "/api/tags").await?;
    let names: Vec<String> = tags["models"]
        .as_array()
        .map(|rows| {
            rows.iter()
                .filter_map(|r| r["name"].as_str().map(String::from))
                .take(200)
                .collect()
        })
        .unwrap_or_default();
    let mut out = vec![];
    for (role, spec) in [
        ("primary", &policy.primary),
        ("secondary", &policy.secondary),
    ] {
        let state = if names.iter().any(|n| n == &spec.name) {
            let show =
                assistant::runtime::post(client, base, "/api/show", json!({"model": spec.name}))
                    .await?;
            let local = assistant::runtime::check_local(&show).is_ok();
            let weight = assistant::runtime::weight_digest(&show);
            if local && weight.as_deref() == Some(spec.weight_digest.as_str()) {
                "ready"
            } else {
                "unqualified"
            }
        } else {
            "absent"
        };
        out.push(ModelState {
            role: role.into(),
            name: spec.name.clone(),
            label: spec.label.clone(),
            download_bytes: spec.download_bytes,
            state: state.into(),
        });
    }
    Ok(out)
}
fn gpus() -> Vec<Gpu> {
    // Fixed local query; absence of the tool simply means "not detected".
    let mut command = Command::new("nvidia-smi");
    command
        .args([
            "--query-gpu=name,memory.total",
            "--format=csv,noheader,nounits",
        ])
        .stdin(Stdio::null())
        .stderr(Stdio::null());
    hide_window(&mut command);
    let Ok(output) = command.output() else {
        return vec![];
    };
    String::from_utf8_lossy(&output.stdout)
        .lines()
        .take(8)
        .filter_map(|line| {
            let (name, memory) = line.rsplit_once(',')?;
            Some(Gpu {
                name: name.trim().chars().take(100).collect(),
                memory_mib: memory.trim().parse().ok()?,
            })
        })
        .collect()
}
#[cfg(windows)]
fn hide_window(command: &mut Command) {
    use std::os::windows::process::CommandExt;
    command.creation_flags(0x0800_0000);
}
#[cfg(not(windows))]
fn hide_window(_: &mut Command) {}

/// Paths for people: drop the Windows verbatim prefix of canonical paths.
fn shown(path: &Path) -> String {
    let text = path.display().to_string();
    text.strip_prefix(r"\\?\").map(String::from).unwrap_or(text)
}
pub async fn status(root: &Path, state: &State, base: &str) -> AppResult<Status> {
    let client = assistant::runtime::client()?;
    let (runtime, version, models) =
        match assistant::runtime::get(&client, base, "/api/status").await {
            Err(_) => ("stopped".to_string(), None, vec![]),
            Ok(s) if assistant::runtime::check_cloud(&s).is_err() => {
                ("cloud".to_string(), None, vec![])
            }
            Ok(_) => {
                let version = assistant::runtime::get(&client, base, "/api/version")
                    .await
                    .ok()
                    .and_then(|v| v["version"].as_str().map(String::from));
                match model_states(&client, base).await {
                    Ok(m) => ("ready".to_string(), version, m),
                    Err(_) => ("unknown".to_string(), version, vec![]),
                }
            }
        };
    let models = if models.is_empty() {
        let policy = assistant::models::policy()?;
        [
            ("primary", &policy.primary),
            ("secondary", &policy.secondary),
        ]
        .into_iter()
        .map(|(role, s)| ModelState {
            role: role.into(),
            name: s.name.clone(),
            label: s.label.clone(),
            download_bytes: s.download_bytes,
            state: "unknown".into(),
        })
        .collect()
    } else {
        models
    };
    Ok(Status {
        supported_platform: SUPPORTED_PLATFORM,
        managed_installed: managed_installed(root),
        managed_running: state.managed_running(),
        runtime_dir: shown(&runtime_dir(root)),
        models_dir: shown(&models_dir(root)),
        runtime,
        runtime_version: version,
        models,
        gpus: tokio::task::spawn_blocking(gpus).await.unwrap_or_default(),
        free_bytes: available_space(&base_dir(root)),
        runtime_download_bytes: OLLAMA_BYTES,
        runtime_install_bytes: OLLAMA_BYTES + OLLAMA_EXTRACTED_BYTES,
    })
}

/// Start the managed copy only when the port is free; never touch another runtime.
pub async fn start(root: &Path, state: &State, base: &str) -> AppResult<String> {
    if !managed_installed(root) {
        return Err("Install Ollama from the settings first.".into());
    }
    let client = assistant::runtime::client()?;
    if let Ok(s) = assistant::runtime::get(&client, base, "/api/status").await {
        return if assistant::runtime::check_cloud(&s).is_ok() {
            Ok("A local Ollama runtime is already running with cloud disabled: Chronexus uses it without starting another one.".into())
        } else {
            Err("The Ollama port is occupied by a runtime without cloud disabled. Close it or configure it with OLLAMA_NO_CLOUD=1; Chronexus does not modify it.".into())
        };
    }
    if tokio::net::TcpStream::connect("127.0.0.1:11434")
        .await
        .is_ok()
    {
        return Err("Port 11434 is occupied by another program. Close it and try again.".into());
    }
    let models = models_dir(root);
    fs::create_dir_all(&models).map_err(|_| "Cannot create the models folder.")?;
    let log = |name: &str| {
        fs::File::create(base_dir(root).join(name))
            .map(Stdio::from)
            .unwrap_or_else(|_| Stdio::null())
    };
    let mut command = Command::new(executable(root));
    command
        .arg("serve")
        .env("OLLAMA_NO_CLOUD", "1")
        .env("OLLAMA_HOST", "127.0.0.1:11434")
        .env("OLLAMA_MODELS", &models)
        .env("OLLAMA_NUM_PARALLEL", "1")
        .env("OLLAMA_CONTEXT_LENGTH", "4096")
        .stdin(Stdio::null())
        .stdout(log("server-out.log"))
        .stderr(log("server-err.log"));
    hide_window(&mut command);
    let child = command
        .spawn()
        .map_err(|_| "Cannot start Ollama. Check antivirus settings and permissions.")?;
    if let Ok(mut c) = state.child.lock() {
        *c = Some(child);
    }
    for _ in 0..40 {
        tokio::time::sleep(Duration::from_millis(500)).await;
        if let Ok(s) = assistant::runtime::get(&client, base, "/api/status").await {
            assistant::runtime::check_cloud(&s).inspect_err(|_| state.shutdown())?;
            return Ok("Ollama is running locally with cloud disabled. It stays running while Chronexus is open.".into());
        }
        if !state.managed_running() {
            break;
        }
    }
    state.shutdown();
    Err(
        "Ollama did not respond within 20 seconds. See server-err.log in the runtime folder."
            .into(),
    )
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Progress {
    pub phase: String,
    pub done: u64,
    pub total: Option<u64>,
    pub detail: Option<String>,
}

/// Ask the running local runtime to pull one qualified model, then verify its
/// weight digest against the M18 policy before reporting it ready.
pub async fn pull(
    base: &str,
    role: &str,
    token: &CancellationToken,
    mut progress: impl FnMut(Progress),
) -> AppResult<ModelState> {
    let policy = assistant::models::policy()?;
    let spec = match role {
        "primary" => &policy.primary,
        "secondary" => &policy.secondary,
        _ => return Err("Choose the primary or secondary model.".into()),
    };
    let status_client = assistant::runtime::client()?;
    assistant::runtime::check_cloud(
        &assistant::runtime::get(&status_client, base, "/api/status").await?,
    )?;
    let client = Client::builder()
        .no_proxy()
        .redirect(reqwest::redirect::Policy::none())
        .connect_timeout(Duration::from_secs(3))
        .read_timeout(Duration::from_secs(300))
        .build()
        .map_err(|_| "Cannot prepare the local AI connection.")?;
    let mut response = tokio::select! {
        biased;
        _ = token.cancelled() => return Err("Model download cancelled.".into()),
        r = client.post(format!("{base}/api/pull")).json(&json!({"model": spec.name, "stream": true})).send() =>
            r.map_err(|_| "The local runtime did not accept the download request.")?,
    };
    if !response.status().is_success() {
        return Err(format!(
            "The local runtime rejected the download (HTTP {}).",
            response.status().as_u16()
        ));
    }
    let mut pending = Vec::new();
    let mut success = false;
    loop {
        let chunk = tokio::select! {
            biased;
            _ = token.cancelled() => return Err("Model download cancelled. Partial files remain managed by Ollama and are not a ready model.".into()),
            c = response.chunk() => c.map_err(|_| "Model download interrupted. Try again when the network is available.")?,
        };
        let Some(chunk) = chunk else { break };
        pending.extend_from_slice(&chunk);
        if pending.len() > 1 << 20 {
            return Err("Risposta del runtime oltre il limite.".into());
        }
        while let Some(end) = pending.iter().position(|b| *b == b'\n') {
            let line: Vec<u8> = pending.drain(..=end).collect();
            let Ok(event) = serde_json::from_slice::<Value>(&line) else {
                continue;
            };
            if let Some(error) = event["error"].as_str() {
                return Err(format!(
                    "Model download failed: {}",
                    error.chars().take(200).collect::<String>()
                ));
            }
            let status = event["status"].as_str().unwrap_or("").to_string();
            success |= status == "success";
            progress(Progress {
                phase: "pull".into(),
                done: event["completed"].as_u64().unwrap_or(0),
                total: event["total"].as_u64(),
                detail: Some(status.chars().take(120).collect()),
            });
        }
    }
    if !success {
        return Err("The model download did not finish. Try again: no model was activated.".into());
    }
    progress(Progress {
        phase: "verify".into(),
        done: 0,
        total: None,
        detail: None,
    });
    let states = model_states(&status_client, base).await?;
    let state = states
        .into_iter()
        .find(|m| m.role == role)
        .ok_or("Model not found after download.")?;
    if state.state != "ready" {
        return Err("The downloaded model does not match the qualified weights: it was not activated. Check the runtime version.".into());
    }
    Ok(state)
}

/// Removes only the Chronexus-managed runtime folder, never models or other runtimes.
pub fn remove_runtime(root: &Path, state: &State) -> AppResult<()> {
    if state.managed_running() {
        return Err("Stop the managed runtime first.".into());
    }
    let dir = runtime_dir(root);
    let meta = fs::symlink_metadata(&dir).map_err(|_| "No managed runtime to remove.")?;
    if !meta.is_dir() || meta.file_type().is_symlink() || !dir.join(RECEIPT).is_file() {
        return Err(
            "The folder does not belong to a runtime managed by Chronexus: it will not be removed."
                .into(),
        );
    }
    fs::remove_dir_all(&dir)
        .map_err(|_| "Cannot remove the runtime. Close Ollama and try again.".into())
}
pub(crate) fn write_receipt(dir: &Path, files: usize) -> AppResult<()> {
    let receipt = json!({"version": OLLAMA_VERSION, "source": OLLAMA_URL, "sha256": OLLAMA_SHA256, "files": files, "license": "MIT (OLLAMA_LICENSE nel pacchetto ufficiale)"});
    fs::write(
        dir.join(RECEIPT),
        serde_json::to_vec_pretty(&receipt).unwrap_or_default(),
    )
    .map_err(|_| "Cannot register the installed runtime.".into())
}
pub(crate) const fn margin() -> u64 {
    MARGIN
}
