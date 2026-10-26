//! Continuous synchronization of the campaigns the user explicitly activated (and only
//! those: nothing runs for a campaign that was not switched on, and nothing runs while it
//! is paused). Local editing never waits for the network: a save is already durable in the
//! archive and simply becomes "pending" until a pass sends it.
//!
//! A pass starts when the user's work changed something (debounced), when the server hints
//! that something changed, or on a bounded polling timer that also covers a missed hint.
//! Failures back off with jitter; only a refused session stops the loop.
use super::{
    api::{self, Failure},
    engine,
};
use crate::{journal::AppResult, Database};
use serde::Serialize;
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};
use tokio::sync::Notify;
use tokio_util::sync::CancellationToken;

/// How long to wait; tests shrink these.
#[derive(Debug, Clone, Copy)]
pub struct Timing {
    /// Quiet period after the last change before a pass starts.
    pub debounce: Duration,
    /// A pass starts at the latest this long after the first change, however busy the user.
    pub max_debounce: Duration,
    /// Safety-net poll when no hint arrived.
    pub poll: Duration,
    pub backoff_first: Duration,
    pub backoff_max: Duration,
    /// Pause before reopening the notification stream.
    pub reconnect: Duration,
    /// How often local edits are looked for (a local query, no network).
    pub watch: Duration,
}
impl Timing {
    pub const fn production() -> Self {
        Self {
            debounce: Duration::from_millis(1500),
            max_debounce: Duration::from_secs(10),
            poll: Duration::from_secs(30),
            backoff_first: Duration::from_secs(5),
            backoff_max: Duration::from_secs(300),
            reconnect: Duration::from_secs(10),
            watch: Duration::from_secs(2),
        }
    }
}

/// What a signed-in device needs for one pass.
pub struct Backend {
    pub client: api::Client,
    pub account_id: String,
    pub server: String,
}
pub type Factory = Arc<dyn Fn() -> AppResult<Backend> + Send + Sync>;
pub type Sink = Arc<dyn Fn(&Status) + Send + Sync>;

/// The visible save state of one campaign.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    pub campaign_id: String,
    /// off | paused | syncing | saved | pending | offline | conflict | attention
    pub state: String,
    pub pending: usize,
    pub conflicts: usize,
    pub blocked: usize,
    pub last_synced_at: Option<String>,
    /// English diagnostic; the interface chooses its own wording from `state`.
    pub message: Option<String>,
    pub retry_in_seconds: Option<u64>,
}
impl Status {
    fn new(campaign: &str, state: &str) -> Self {
        Self {
            campaign_id: campaign.into(),
            state: state.into(),
            pending: 0,
            conflicts: 0,
            blocked: 0,
            last_synced_at: None,
            message: None,
            retry_in_seconds: None,
        }
    }
}

struct Run {
    stop: CancellationToken,
    wake: Arc<Notify>,
}
struct Inner {
    db: Database,
    factory: Factory,
    sink: Sink,
    timing: Timing,
    runs: Mutex<HashMap<String, Run>>,
    /// One pass at a time per campaign, whether automatic or requested by the user.
    passes: Mutex<HashMap<String, Arc<tokio::sync::Mutex<()>>>>,
    status: Mutex<HashMap<String, Status>>,
}
#[derive(Clone)]
pub struct Auto(Arc<Inner>);

impl Auto {
    pub fn new(db: Database, factory: Factory, sink: Sink, timing: Timing) -> Self {
        Self(Arc::new(Inner {
            db,
            factory,
            sink,
            timing,
            runs: Mutex::new(HashMap::new()),
            passes: Mutex::new(HashMap::new()),
            status: Mutex::new(HashMap::new()),
        }))
    }
    fn publish(&self, status: Status) {
        if let Ok(mut all) = self.0.status.lock() {
            if all.get(&status.campaign_id) == Some(&status) {
                return;
            }
            all.insert(status.campaign_id.clone(), status.clone());
        }
        (self.0.sink)(&status);
    }
    /// The current state: counts always come fresh from the archive; while a loop is
    /// running, what it is doing right now (syncing, offline, needs attention) wins.
    pub async fn status(&self, campaign: &str) -> AppResult<Status> {
        let mut status = self.idle_status(campaign).await?;
        let running = self
            .0
            .runs
            .lock()
            .map(|runs| runs.contains_key(campaign))
            .unwrap_or(false);
        let known = self
            .0
            .status
            .lock()
            .ok()
            .and_then(|s| s.get(campaign).cloned());
        if let Some(known) = known
            .filter(|k| running && ["syncing", "offline", "attention"].contains(&k.state.as_str()))
        {
            status.state = known.state;
            status.message = known.message;
            status.retry_in_seconds = known.retry_in_seconds;
        }
        Ok(status)
    }
    async fn idle_status(&self, campaign: &str) -> AppResult<Status> {
        let id = campaign.to_string();
        let (link, counts) = self
            .0
            .db
            .run(move |c| {
                let link = engine::require_link(c, &id)?;
                let counts = engine::counts(c, &id)?;
                Ok((link, counts))
            })
            .await?;
        let state = if link.access_lost {
            "attention"
        } else if !link.auto {
            "off"
        } else if link.paused {
            "paused"
        } else if counts.conflicts > 0 {
            "conflict"
        } else if counts.pending + counts.in_flight > 0 {
            "pending"
        } else {
            "saved"
        };
        Ok(Status {
            pending: counts.pending + counts.in_flight,
            conflicts: counts.conflicts,
            blocked: counts.blocked,
            last_synced_at: link.synced_at,
            message: link.last_error,
            ..Status::new(campaign, state)
        })
    }
    /// Starts, restarts or stops the loops so they match the archive. Called at startup,
    /// after sign-in or sign-out, an unlink, a restore and whenever the user switches
    /// continuous synchronization on, off or to paused.
    pub async fn reload(&self) {
        let links = self.0.db.run(engine::all_links).await.unwrap_or_default();
        let signed_in = (self.0.factory)().is_ok();
        let wanted: Vec<String> = links
            .iter()
            .filter(|l| l.auto && !l.paused && !l.access_lost && signed_in)
            .map(|l| l.campaign_id.clone())
            .collect();
        let stale: Vec<String> = self
            .0
            .runs
            .lock()
            .map(|runs| {
                runs.keys()
                    .filter(|id| !wanted.contains(id))
                    .cloned()
                    .collect()
            })
            .unwrap_or_default();
        for id in stale {
            self.stop(&id);
        }
        for link in &links {
            if wanted.contains(&link.campaign_id) {
                self.start(&link.campaign_id);
            } else if let Ok(mut status) = self.idle_status(&link.campaign_id).await {
                if link.auto && !link.paused && !signed_in {
                    status.state = "attention".into();
                    status.message = Some("Sign in to the sharing server to continue.".into());
                }
                self.publish(status);
            }
        }
    }
    fn start(&self, campaign: &str) {
        let Ok(mut runs) = self.0.runs.lock() else {
            return;
        };
        if runs.contains_key(campaign) {
            return;
        }
        let stop = CancellationToken::new();
        let wake = Arc::new(Notify::new());
        runs.insert(
            campaign.to_string(),
            Run {
                stop: stop.clone(),
                wake: wake.clone(),
            },
        );
        let (this, id) = (self.clone(), campaign.to_string());
        tauri::async_runtime::spawn(async move {
            this.run(id, stop, wake).await;
        });
    }
    fn stop(&self, campaign: &str) {
        if let Some(run) = self.0.runs.lock().ok().and_then(|mut r| r.remove(campaign)) {
            run.stop.cancel();
        }
    }
    pub fn stop_all(&self) {
        let ids: Vec<String> = self
            .0
            .runs
            .lock()
            .map(|r| r.keys().cloned().collect())
            .unwrap_or_default();
        for id in ids {
            self.stop(&id);
        }
    }
    /// Something changed locally: look at every active campaign soon.
    pub fn touch(&self) {
        if let Ok(runs) = self.0.runs.lock() {
            for run in runs.values() {
                run.wake.notify_one();
            }
        }
    }
    fn pass_lock(&self, campaign: &str) -> Arc<tokio::sync::Mutex<()>> {
        self.0
            .passes
            .lock()
            .map(|mut all| all.entry(campaign.to_string()).or_default().clone())
            .unwrap_or_default()
    }
    /// One complete pass, shared by the loop and the user's "Synchronize now".
    pub async fn sync_once(&self, campaign: &str) -> Result<engine::Report, Failure> {
        let lock = self.pass_lock(campaign);
        let _one_at_a_time = lock.lock().await;
        let backend = (self.0.factory)()?;
        let id = campaign.to_string();
        let link = self.0.db.run(move |c| engine::require_link(c, &id)).await?;
        if link.account_id != backend.account_id || link.server != backend.server {
            return Err(Failure::Rejected(
                "This campaign is linked with another account or server. Sign in with that account, or unlink it.".into(),
            ));
        }
        engine::sync_now(&self.0.db, &backend.client, campaign.to_string()).await
    }

    async fn run(self, campaign: String, stop: CancellationToken, wake: Arc<Notify>) {
        let timing = self.0.timing;
        let mut failures = 0u32;
        let mut failed_at: Option<Instant> = None;
        // What the last failed pass said, so the visible state survives the idle refresh.
        let mut failure = ("offline", String::new());
        // The notification stream only ever wakes the loop; it never carries data.
        let listener = {
            let (this, id, wake, stop) =
                (self.clone(), campaign.clone(), wake.clone(), stop.clone());
            tauri::async_runtime::spawn(async move { this.listen(id, wake, stop).await })
        };
        // Local edits are noticed by comparing a cheap fingerprint of the archive, so every
        // write path (editor autosave, imports, the external assistant, a restore) counts
        // without each command having to announce itself.
        let watcher = {
            let (this, id, wake, stop) =
                (self.clone(), campaign.clone(), wake.clone(), stop.clone());
            tauri::async_runtime::spawn(async move { this.watch(id, wake, stop).await })
        };
        let mut first = true;
        'life: loop {
            // Right after activation or startup anything pending runs at once; afterwards a
            // pass follows a local change, a server hint or the polling timer.
            let delay = if first {
                Duration::ZERO
            } else if failures > 0 {
                backoff(&timing, failures)
            } else {
                timing.poll
            };
            if let Ok(mut status) = self.idle_status(&campaign).await {
                if failures > 0 {
                    status.state = failure.0.into();
                    status.message = Some(failure.1.clone());
                    status.retry_in_seconds = Some(delay.as_secs());
                }
                self.publish(status);
            }
            let woken = tokio::select! {
                _ = stop.cancelled() => break 'life,
                _ = wake.notified() => true,
                _ = tokio::time::sleep(delay) => false,
            };
            if woken && !first {
                // Debounce: keep waiting while the user keeps changing things, but not forever.
                let started = Instant::now();
                loop {
                    let remaining = timing.max_debounce.saturating_sub(started.elapsed());
                    if remaining.is_zero() {
                        break;
                    }
                    tokio::select! {
                        _ = stop.cancelled() => break 'life,
                        _ = wake.notified() => {}
                        _ = tokio::time::sleep(timing.debounce.min(remaining)) => break,
                    }
                }
                // A failing server is not asked again before its backoff has elapsed.
                if let Some(at) = failed_at.filter(|_| failures > 0) {
                    let wait = backoff(&timing, failures).saturating_sub(at.elapsed());
                    tokio::select! {
                        _ = stop.cancelled() => break 'life,
                        _ = tokio::time::sleep(wait) => {}
                    }
                }
            }
            first = false;
            let mut status = self
                .status(&campaign)
                .await
                .unwrap_or_else(|_| Status::new(&campaign, "syncing"));
            status.state = "syncing".into();
            status.retry_in_seconds = None;
            self.publish(status);
            match self.sync_once(&campaign).await {
                Ok(_) => {
                    failures = 0;
                    failed_at = None;
                }
                Err(error) => {
                    let message = error.message();
                    let (id, note) = (campaign.clone(), message.clone());
                    let _ = self
                        .0
                        .db
                        .run(move |c| engine::set_error(c, &id, Some(&note)))
                        .await;
                    let mut status = self
                        .idle_status(&campaign)
                        .await
                        .unwrap_or_else(|_| Status::new(&campaign, "offline"));
                    status.message = Some(message);
                    if error.transient() {
                        failures += 1;
                        failed_at = Some(Instant::now());
                        failure = ("offline", status.message.clone().unwrap_or_default());
                        status.state = "offline".into();
                        self.publish(status);
                    } else if matches!(error, Failure::Unauthorized(_) | Failure::AccessLost(_)) {
                        // A refused session, or a campaign that is gone: stop asking.
                        status.state = "attention".into();
                        self.publish(status);
                        break;
                    } else {
                        // Refused for good: wait long, never hammer the server.
                        failures = failures.max(8);
                        failed_at = Some(Instant::now());
                        failure = ("attention", status.message.clone().unwrap_or_default());
                        status.state = "attention".into();
                        self.publish(status);
                    }
                }
            }
        }
        listener.abort();
        watcher.abort();
    }
    async fn watch(self, campaign: String, wake: Arc<Notify>, stop: CancellationToken) {
        let mut last: Option<String> = None;
        loop {
            let id = campaign.clone();
            if let Ok(now) = self.0.db.run(move |c| engine::fingerprint(c, &id)).await {
                if last.as_ref().is_some_and(|before| *before != now) {
                    wake.notify_one();
                }
                last = Some(now);
            }
            tokio::select! {
                _ = stop.cancelled() => return,
                _ = tokio::time::sleep(self.0.timing.watch) => {}
            }
        }
    }
    /// Keeps a notification stream open and turns every hint into a wake-up.
    async fn listen(self, campaign: String, wake: Arc<Notify>, stop: CancellationToken) {
        let timing = self.0.timing;
        loop {
            if stop.is_cancelled() {
                return;
            }
            let pause = match (self.0.factory)() {
                Ok(backend) => {
                    let id = campaign.clone();
                    let remote = self
                        .0
                        .db
                        .run(move |c| engine::require_link(c, &id))
                        .await
                        .map(|l| l.remote_id);
                    match remote {
                        Ok(remote) => {
                            // No stream on a server that does not offer one: polling covers it.
                            if !backend
                                .client
                                .meta()
                                .await
                                .is_ok_and(|meta| meta.supports_notifications())
                            {
                                tokio::select! {
                                    _ = stop.cancelled() => return,
                                    _ = tokio::time::sleep(timing.backoff_max) => {}
                                }
                                continue;
                            }
                            let outcome = tokio::select! {
                                _ = stop.cancelled() => return,
                                outcome = backend.client.listen(&remote, || wake.notify_one()) => outcome,
                            };
                            match outcome {
                                Ok(()) => timing.reconnect,
                                // A server without notifications (or a refusal): try rarely.
                                Err(Failure::Rejected(_)) => timing.backoff_max,
                                Err(_) => timing.reconnect,
                            }
                        }
                        Err(_) => return,
                    }
                }
                Err(_) => timing.backoff_max,
            };
            tokio::select! {
                _ = stop.cancelled() => return,
                _ = tokio::time::sleep(pause) => {}
            }
        }
    }
}
/// Exponential backoff with deterministic-enough jitter from the clock.
fn backoff(timing: &Timing, failures: u32) -> Duration {
    let base = timing
        .backoff_first
        .saturating_mul(1u32 << failures.saturating_sub(1).min(10))
        .min(timing.backoff_max);
    let jitter = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.subsec_millis())
        .unwrap_or(0) as u64
        % 1000;
    base + base.checked_div(10).unwrap_or_default() * (jitter as u32) / 1000
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn backoff_grows_is_bounded_and_never_below_the_first_delay() {
        let timing = Timing::production();
        let delays: Vec<Duration> = (1..=12).map(|n| backoff(&timing, n)).collect();
        assert!(delays[0] >= timing.backoff_first);
        assert!(delays
            .windows(2)
            .all(|w| w[1] >= w[0] || w[1] >= timing.backoff_max));
        assert!(delays
            .iter()
            .all(|d| *d <= timing.backoff_max + timing.backoff_max / 10));
    }
}
