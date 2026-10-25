//! Explicit, signed application updates. Never exposed through automation tools.
pub mod herald;
mod network;
mod safety;
#[cfg(test)]
mod tests;
use crate::{assistant, journal::AppResult, Database};
use serde::{Deserialize, Serialize};
use std::{
    path::PathBuf,
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};
use tauri::{ipc::Channel, Manager};
use tauri_plugin_updater::{Update, UpdaterExt};
use tokio_util::sync::CancellationToken;

pub const DEFAULT_ENDPOINT: &str =
    "https://api.github.com/repos/Acelith/Chronexus/releases/latest";
const MAX_MANIFEST: usize = 1_000_000;
const MAX_PACKAGE: usize = 256 * 1024 * 1024;
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Settings {
    pub endpoint: String,
}
impl Default for Settings {
    fn default() -> Self {
        Self {
            endpoint: DEFAULT_ENDPOINT.into(),
        }
    }
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Overview {
    pub settings: Settings,
    pub current_version: String,
    pub backup_directory: String,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Offer {
    pub id: String,
    pub version: String,
    pub notes: String,
}
#[derive(Clone)]
struct Pending {
    offer: Offer,
    update: Update,
    bytes: Option<Arc<Vec<u8>>>,
}
#[derive(Default)]
struct Inner {
    pending: Option<Pending>,
    cancel: Option<CancellationToken>,
}
#[derive(Default)]
pub struct State {
    gate: tokio::sync::Mutex<()>,
    inner: Mutex<Inner>,
    automatic_checked: std::sync::atomic::AtomicBool,
}
impl State {
    pub fn shutdown(&self) {
        if let Ok(mut inner) = self.inner.lock() {
            if let Some(cancel) = inner.cancel.take() {
                cancel.cancel();
            }
            inner.pending = None;
        }
    }
    fn lock_inner(&self) -> AppResult<std::sync::MutexGuard<'_, Inner>> {
        self.inner
            .lock()
            .map_err(|_| "Stato aggiornamenti non disponibile. Riavvia l’app.".into())
    }
    fn pending(&self, id: &str) -> AppResult<Pending> {
        self.lock_inner()?
            .pending
            .as_ref()
            .filter(|p| p.offer.id == id)
            .cloned()
            .ok_or("Aggiornamento scaduto: controlla nuovamente la versione disponibile.".into())
    }
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Progress {
    pub phase: String,
    pub downloaded: usize,
    pub total: Option<u64>,
    pub backup_path: Option<String>,
    /// M19: why the backup went to the data folder instead of Documents.
    pub backup_notice: Option<String>,
}
fn root(app: &tauri::AppHandle) -> AppResult<PathBuf> {
    app.state::<Database>().with_store(|s| Ok(s.root.clone()))
}
fn emit(
    events: &Channel<Progress>,
    phase: &str,
    downloaded: usize,
    total: Option<u64>,
    backup: Option<String>,
) {
    let _ = events.send(Progress {
        phase: phase.into(),
        downloaded,
        total,
        backup_path: backup,
        backup_notice: None,
    });
}
fn client() -> AppResult<reqwest::Client> {
    reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .https_only(true)
        .connect_timeout(Duration::from_secs(15))
        .read_timeout(Duration::from_secs(30))
        .timeout(Duration::from_secs(300))
        .user_agent("Chronexus-Updater")
        .build()
        .map_err(|_| "Connessione agli aggiornamenti non disponibile.".into())
}
#[tauri::command]
pub fn get_update_settings(app: tauri::AppHandle) -> AppResult<Overview> {
    let root = root(&app)?;
    Ok(Overview {
        settings: safety::read_settings(&root)?,
        current_version: app.package_info().version.to_string(),
        backup_directory: crate::backup_folder::planned_update_folder(
            crate::backup_folder::commands::documents(&app).as_deref(),
        )
        .map_or_else(
            || root.join("update-backups").display().to_string(),
            |p| crate::backup_folder::shown(&p),
        ),
    })
}
#[tauri::command]
pub fn save_update_settings(app: tauri::AppHandle, settings: Settings) -> AppResult<Settings> {
    let state = app.state::<State>();
    let _gate = state
        .gate
        .try_lock()
        .map_err(|_| "Attendi il completamento dell’aggiornamento in corso.")?;
    network::url(&settings.endpoint)?;
    safety::write_settings(&root(&app)?, &settings)?;
    state.lock_inner()?.pending = None;
    Ok(settings)
}
#[tauri::command]
pub async fn check_app_update(app: tauri::AppHandle) -> AppResult<Option<Offer>> {
    let state = app.state::<State>();
    let _gate = state
        .gate
        .try_lock()
        .map_err(|_| "È già in corso un’operazione di aggiornamento.")?;
    check(&app).await
}
fn now() -> chrono::DateTime<chrono::Utc> {
    chrono::DateTime::<chrono::Utc>::from(std::time::SystemTime::now())
}
#[tauri::command]
pub fn get_herald_settings(app: tauri::AppHandle) -> AppResult<herald::HeraldSettings> {
    Ok(herald::settings(&herald::read(&root(&app)?)?))
}
#[tauri::command]
pub fn save_herald_settings(
    app: tauri::AppHandle,
    settings: herald::HeraldSettings,
) -> AppResult<herald::HeraldSettings> {
    let root = root(&app)?;
    let mut value = herald::read(&root).unwrap_or_default();
    value.startup_check = settings.startup_check;
    value.sound = settings.sound;
    herald::write(&root, &value)?;
    Ok(herald::settings(&value))
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Announcement {
    pub offer: Offer,
    pub sound: bool,
}
/// The only automatic network request of the app: one bounded check per session
/// and per interval, never when disabled. Failures stay silent: no false alarm.
#[tauri::command]
pub async fn startup_update_check(app: tauri::AppHandle) -> AppResult<Option<Announcement>> {
    let state = app.state::<State>();
    if state
        .automatic_checked
        .swap(true, std::sync::atomic::Ordering::SeqCst)
    {
        return Ok(None);
    }
    let root = root(&app)?;
    let mut prefs = herald::read(&root)?;
    if !herald::should_check(&prefs, now()) {
        return Ok(None);
    }
    // Debug-only QA fixture on an isolated profile; absent from release builds.
    #[cfg(debug_assertions)]
    if let (Ok(version), Some(_)) = (
        std::env::var("NODEX_DEV_HERALD_VERSION"),
        std::env::var_os("NODEX_DEV_DATA_DIR"),
    ) {
        herald::record_check(&mut prefs, now());
        herald::write(&root, &prefs)?;
        return Ok(
            herald::should_announce(&prefs, &version, now()).then(|| Announcement {
                offer: Offer {
                    id: "qa-fixture".into(),
                    version,
                    notes: "Collaudo sintetico M15a: nessun pacchetto reale.".into(),
                },
                sound: prefs.sound,
            }),
        );
    }
    let Ok(_gate) = state.gate.try_lock() else {
        return Ok(None);
    };
    let found = match check(&app).await {
        Ok(found) => found,
        Err(_) => return Ok(None),
    };
    herald::record_check(&mut prefs, now());
    herald::write(&root, &prefs)?;
    Ok(found
        .filter(|offer| herald::should_announce(&prefs, &offer.version, now()))
        .map(|offer| Announcement {
            offer,
            sound: prefs.sound,
        }))
}
#[tauri::command]
pub fn record_update_announcement(
    app: tauri::AppHandle,
    version: String,
    choice: String,
) -> AppResult<()> {
    let root = root(&app)?;
    let mut prefs = herald::read(&root)?;
    herald::record_choice(&mut prefs, &version, &choice, now())?;
    herald::write(&root, &prefs)
}
/// Local only: lets the herald wait while AI, training or an update is running.
#[tauri::command]
pub fn update_announcement_blocked(app: tauri::AppHandle) -> AppResult<bool> {
    let state = app.state::<State>();
    let updating = state.gate.try_lock().is_err();
    Ok(updating || assistant::service::busy(&app.state::<assistant::service::State>())?)
}
async fn check(app: &tauri::AppHandle) -> AppResult<Option<Offer>> {
    let state = app.state::<State>();
    state.lock_inner()?.pending = None;
    let endpoint = network::url(&safety::read_settings(&root(app)?)?.endpoint)?;
    let cancel = CancellationToken::new();
    let raw = tokio::time::timeout(
        Duration::from_secs(25),
        network::fetch(
            &client()?,
            endpoint.clone(),
            MAX_MANIFEST,
            &cancel,
            |_, _| {},
        ),
    )
    .await
    .map_err(|_| "Il server degli aggiornamenti non risponde. Riprova più tardi.")??;
    let Some(raw) = raw else { return Ok(None) };
    let mut manifest: serde_json::Value = serde_json::from_slice(&raw)
        .map_err(|_| "Il server non ha restituito un canale aggiornamenti valido.")?;
    if let Some((url, version)) = network::manifest_asset(&manifest, &endpoint)? {
        let raw = tokio::time::timeout(
            Duration::from_secs(25),
            network::fetch(&client()?, url, MAX_MANIFEST, &cancel, |_, _| {}),
        )
        .await
        .map_err(|_| "Il manifesto aggiornamenti non risponde.")??
        .ok_or("Manifesto aggiornamenti assente nella release.")?;
        manifest =
            serde_json::from_slice(&raw).map_err(|_| "Manifesto aggiornamenti non valido.")?;
        if manifest["version"]
            .as_str()
            .map(|v| v.trim_start_matches('v'))
            != Some(version.trim_start_matches('v'))
        {
            return Err("La versione del manifesto non corrisponde alla release Forgegit.".into());
        }
    }
    let exit_handle = app.clone();
    let updater = app
        .updater_builder()
        .endpoints(vec![endpoint.clone()])
        .map_err(|_| "Endpoint aggiornamenti non valido.")?
        .restart_after_install(false)
        .on_before_exit(move || {
            if let Some(server) = exit_handle.try_state::<crate::automation::Server>() {
                server.shutdown();
            }
        })
        .build()
        .map_err(|_| "Configurazione della firma aggiornamenti non valida.")?;
    let Some(update) = updater
        .restore_update(manifest)
        .map_err(|_| "Manifesto non valido o aggiornamento non disponibile per questo sistema.")?
    else {
        return Ok(None);
    };
    if update.version.contains('-') {
        return Err("Il canale stabile non accetta versioni di anteprima.".into());
    }
    network::artifact(&endpoint, &update.download_url)?;
    let offer = Offer {
        id: uuid::Uuid::new_v4().to_string(),
        version: update.version.clone(),
        notes: update.body.clone().unwrap_or_default(),
    };
    state.lock_inner()?.pending = Some(Pending {
        offer: offer.clone(),
        update,
        bytes: None,
    });
    Ok(Some(offer))
}
#[tauri::command]
pub fn cancel_app_update(app: tauri::AppHandle) -> AppResult<()> {
    if let Some(cancel) = &app.state::<State>().lock_inner()?.cancel {
        cancel.cancel();
    }
    Ok(())
}
#[tauri::command]
pub async fn download_app_update(
    app: tauri::AppHandle,
    id: String,
    events: Channel<Progress>,
) -> AppResult<()> {
    let state = app.state::<State>();
    let _gate = state
        .gate
        .try_lock()
        .map_err(|_| "È già in corso un’operazione di aggiornamento.")?;
    let pending = state.pending(&id)?;
    let download_client = client()?;
    let cancel = CancellationToken::new();
    state.lock_inner()?.cancel = Some(cancel.clone());
    let mut last = Instant::now();
    emit(&events, "download", 0, None, None);
    let result = network::fetch(
        &download_client,
        pending.update.download_url.clone(),
        MAX_PACKAGE,
        &cancel,
        |n, total| {
            if last.elapsed() >= Duration::from_millis(100) {
                emit(&events, "download", n, total, None);
                last = Instant::now();
            }
        },
    )
    .await;
    state.lock_inner()?.cancel = None;
    let bytes = result?.ok_or("Il server non ha fornito il pacchetto di aggiornamento.")?;
    if cancel.is_cancelled() {
        return Err("Download annullato. La versione installata non è cambiata.".into());
    }
    emit(
        &events,
        "verify",
        bytes.len(),
        Some(bytes.len() as u64),
        None,
    );
    pending.update.verify(&bytes).map_err(|_| {
        "Firma del pacchetto non valida o versione firmata diversa: installazione bloccata."
    })?;
    state
        .lock_inner()?
        .pending
        .as_mut()
        .filter(|p| p.offer.id == id)
        .ok_or("Aggiornamento scaduto.")?
        .bytes = Some(Arc::new(bytes));
    emit(&events, "ready", 0, None, None);
    Ok(())
}
#[tauri::command]
pub async fn install_app_update(
    app: tauri::AppHandle,
    id: String,
    events: Channel<Progress>,
) -> AppResult<String> {
    let state = app.state::<State>();
    let _gate = state
        .gate
        .try_lock()
        .map_err(|_| "È già in corso un’operazione di aggiornamento.")?;
    let pending = state.pending(&id)?;
    let bytes = pending
        .bytes
        .ok_or("Scarica e verifica prima il pacchetto.")?;
    // Holding the AI slot prevents new inference/training during snapshot and exit.
    let handle = app.clone();
    let documents = crate::backup_folder::commands::documents(&app);
    tauri::async_runtime::spawn_blocking(move || {
        pending.update.verify(&bytes).map_err(|_| "Il pacchetto non supera la verifica della firma.")?;
        emit(&events, "backup", 0, None, None);
        handle.state::<Database>().with_store(|store| {
            // Match the existing Store -> AI order; never wait on the AI mutex.
            let ai = handle.state::<assistant::service::State>();
            let slot = ai.running.try_lock().map_err(|_| "Attendi la conclusione dell’operazione AI prima di aggiornare.")?;
            if slot.is_some() { return Err("Ferma la risposta o l’addestramento AI prima di installare l’aggiornamento.".into()) }
            // Keep the same archive lock across the snapshot and installer handoff.
            safety::before_install(store, documents.as_deref(), &pending.offer.version, |receipt, notice| {
                let _ = events.send(Progress { phase: "install".into(), downloaded: 0, total: None, backup_path: Some(receipt.path.clone()), backup_notice: notice.map(str::to_string) });
                pending.update.install(bytes.as_slice()).map_err(|_| format!("Installazione non avviata. Backup conservato in {}. Riprova o usa l’installer firmato manualmente.", receipt.path))?;
                Ok(receipt.path.clone())
            })
        })
    }).await.map_err(|_| "Aggiornamento interrotto. Controlla i backup prima di riprovare.".to_string())?
}
