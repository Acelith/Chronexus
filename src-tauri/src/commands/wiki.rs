use crate::{journal::AppResult, wiki, wiki_provider, wikidot, Database};

#[tauri::command]
pub async fn read_wiki_cache(
    db: tauri::State<'_, Database>,
    key: String,
) -> AppResult<Option<wiki::Entry>> {
    db.run(move |c| wiki::read(c, &key)).await
}

#[tauri::command]
pub async fn store_wiki_cache(
    db: tauri::State<'_, Database>,
    state: tauri::State<'_, wikidot::State>,
    key: String,
    payload: serde_json::Value,
    epoch: Option<u64>,
) -> AppResult<wiki::Entry> {
    let current = state.epoch_counter();
    db.run(move |c| {
        // A clear that happened while the request was pending wins over its result.
        if epoch.is_some_and(|e| e != current.load(std::sync::atomic::Ordering::SeqCst)) {
            return Err(CACHE_CLEARED.into());
        }
        wiki::store(c, &key, payload)
    })
    .await
}

pub const CACHE_CLEARED: &str =
    "The wiki cache was cleared during the request: the copy was not saved.";

#[tauri::command]
pub fn wiki_cache_epoch(state: tauri::State<wikidot::State>) -> u64 {
    state.epoch()
}

#[tauri::command]
pub async fn get_wiki_provider(
    db: tauri::State<'_, Database>,
) -> AppResult<wiki_provider::WikiChoice> {
    wiki_provider::read(&db.root()?)
}

#[tauri::command]
pub async fn save_wiki_provider(
    db: tauri::State<'_, Database>,
    provider: String,
) -> AppResult<wiki_provider::WikiChoice> {
    wiki_provider::save(&db.root()?, &provider)
}

#[tauri::command]
pub async fn wiki_cache_summary(
    db: tauri::State<'_, Database>,
) -> AppResult<wikidot::CacheSummary> {
    db.run(wikidot::summary).await
}

#[tauri::command]
pub async fn clear_wiki_cache(
    db: tauri::State<'_, Database>,
    state: tauri::State<'_, wikidot::State>,
    provider: String,
) -> AppResult<wikidot::CacheSummary> {
    if !["open5e", "wikidot", "all"].contains(&provider.as_str()) {
        return Err("Choose which wiki cache to clear.".into());
    }
    state.invalidate();
    db.run(move |c| wikidot::clear(c, &provider)).await
}

#[tauri::command]
pub fn cancel_wikidot(state: tauri::State<wikidot::State>) {
    state.cancel();
}

/// Cached copy first; network only when missing or explicitly refreshed.
pub async fn wikidot_load<T: serde::Serialize + serde::de::DeserializeOwned>(
    db: &Database,
    state: &wikidot::State,
    key: String,
    refresh: bool,
    load: impl std::future::Future<Output = AppResult<T>>,
) -> AppResult<wikidot::Cached<T>> {
    let lookup = key.clone();
    let old = db.run(move |c| wikidot::read_raw(c, &lookup)).await?;
    let decode = |v: serde_json::Value| -> AppResult<T> {
        serde_json::from_value(v).map_err(|_| "Wikidot copy unreadable.".into())
    };
    if let (Some((value, at)), false) = (&old, refresh) {
        return Ok(wikidot::Cached {
            payload: decode(value.clone())?,
            fetched_at: at.clone(),
            cached: true,
            warning: None,
        });
    }
    let epoch = state.epoch();
    match load.await {
        Ok(fresh) => {
            let value = serde_json::to_value(&fresh).map_err(|_| "Invalid Wikidot copy.")?;
            let current = state.epoch_counter();
            let at = db
                .run(move |c| {
                    if current.load(std::sync::atomic::Ordering::SeqCst) != epoch {
                        return Err(CACHE_CLEARED.into());
                    }
                    wikidot::store(c, &key, &value)
                })
                .await?;
            Ok(wikidot::Cached {
                payload: fresh,
                fetched_at: at,
                cached: false,
                warning: None,
            })
        }
        Err(error) => match old {
            Some((value, at)) => Ok(wikidot::Cached {
                payload: decode(value)?,
                fetched_at: at,
                cached: true,
                warning: Some(format!(
                    "{error} Refresh failed: you are reading the local copy."
                )),
            }),
            None => Err(error),
        },
    }
}

#[tauri::command]
pub async fn wikidot_search(
    db: tauri::State<'_, Database>,
    state: tauri::State<'_, wikidot::State>,
    category: String,
    query: String,
    refresh: bool,
) -> AppResult<wikidot::SearchResult> {
    wikidot::index_path(&category)?;
    if query.chars().count() > 100 || query.contains('\0') {
        return Err("Enter at most 100 characters.".into());
    }
    let token = state.token();
    let client = wikidot::client()?;
    let base = wikidot::base();
    let index = wikidot_load(
        &db,
        &state,
        format!("index/{category}"),
        refresh,
        wikidot::fetch_index(&client, &state, &base, &category, &token),
    )
    .await?;
    let (total, rows) = wikidot::filter(&index.payload, &query);
    Ok(wikidot::SearchResult {
        category,
        url: index.payload.url,
        fetched_at: index.fetched_at,
        cached: index.cached,
        warning: index.warning,
        index_size: index.payload.rows.len(),
        total,
        rows,
    })
}

#[tauri::command]
pub async fn wikidot_entry(
    db: tauri::State<'_, Database>,
    state: tauri::State<'_, wikidot::State>,
    page: String,
    refresh: bool,
) -> AppResult<wikidot::Cached<wikidot::Entry>> {
    if wikidot::category_of(&page).is_none() {
        return Err("Wikidot page not allowed.".into());
    }
    let token = state.token();
    let client = wikidot::client()?;
    let base = wikidot::base();
    wikidot_load(
        &db,
        &state,
        format!("entry/{page}"),
        refresh,
        wikidot::fetch_entry(&client, &state, &base, &page, &token),
    )
    .await
}

#[cfg(test)]
mod wiki_load_tests {
    use super::*;
    use crate::backup;
    use std::sync::{Arc, Mutex};
    fn entry(page: &str) -> wikidot::Entry {
        let html = r#"<div class="page-title"><span>T</span></div><div id="page-content"><p>Source: S</p><p>Text</p></div>"#;
        wikidot::parse::entry(html, page).unwrap()
    }
    #[tokio::test]
    async fn pending_result_is_not_cached_after_a_clear_and_cache_wins_offline() {
        let dir = tempfile::tempdir().unwrap();
        let db = Database::new(Ok(Arc::new(Mutex::new(
            backup::Store::open(dir.path()).unwrap(),
        ))));
        let state = wikidot::State::default();
        let key = "entry/feat:alert".to_string();
        // The clear happens while the network request is still pending.
        let late = async {
            state.invalidate();
            Ok(entry("feat:alert"))
        };
        let error = wikidot_load(&db, &state, key.clone(), false, late)
            .await
            .unwrap_err();
        assert_eq!(error, CACHE_CLEARED);
        assert!(db.with(|c| wikidot::read_raw(c, &key)).unwrap().is_none());
        let fresh = wikidot_load(&db, &state, key.clone(), false, async {
            Ok(entry("feat:alert"))
        })
        .await
        .unwrap();
        assert!(!fresh.cached);
        // Cached copies answer without touching the network; failed refresh falls back visibly.
        let unused = async { Err::<wikidot::Entry, String>("network must not run".into()) };
        assert!(
            wikidot_load(&db, &state, key.clone(), false, unused)
                .await
                .unwrap()
                .cached
        );
        let offline = async { Err::<wikidot::Entry, String>("Wikidot not reachable.".into()) };
        let stale = wikidot_load(&db, &state, key, true, offline).await.unwrap();
        assert!(stale.cached && stale.warning.unwrap().contains("local copy"));
    }
}
