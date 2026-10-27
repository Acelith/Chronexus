use crate::{
    ai_setup, assistant,
    journal::{self, AppResult},
    wikidot, Database,
};
use tauri::Manager;

#[tauri::command]
pub async fn probe_local_ai() -> AppResult<assistant::runtime::Runtime> {
    let client = assistant::runtime::client()?;
    assistant::runtime::probe_at(&client, assistant::runtime::BASE).await
}

#[tauri::command]
pub async fn get_ai_settings(
    db: tauri::State<'_, Database>,
    campaign_id: Option<String>,
) -> AppResult<assistant::store::Settings> {
    db.run(move |c| match campaign_id {
        Some(id) => Ok(assistant::campaign::get(c, &id)?.settings),
        None => assistant::store::settings(c),
    })
    .await
}

#[tauri::command]
pub async fn configure_local_ai(
    db: tauri::State<'_, Database>,
    state: tauri::State<'_, assistant::service::State>,
    enabled: bool,
    model: String,
    multilingual_consent: bool,
    campaign_id: Option<String>,
) -> AppResult<assistant::store::Settings> {
    if assistant::service::busy(&state)? {
        return Err("Cancel the generation before changing the AI configuration.".into());
    }
    if !enabled {
        return db
            .run(move |c| {
                let mut s = match &campaign_id {
                    Some(id) => assistant::campaign::get(c, id)?.settings,
                    None => assistant::store::settings(c)?,
                };
                s.enabled = false;
                if let Some(id) = &campaign_id {
                    let mut p = assistant::campaign::get(c, id)?;
                    p.settings = s.clone();
                    assistant::campaign::write(c, id, &p)?;
                    Ok(s)
                } else {
                    assistant::store::set_settings(c, &s)
                }
            })
            .await;
    }
    if !multilingual_consent {
        return Err("Confirm the multilingual model with local sources; the D&D candidate did not pass the evaluation.".into());
    }
    let (owner, name) = (campaign_id.clone(), model.clone());
    db.run(move |c| assistant::training::model_owned(c, owner.as_deref(), &name))
        .await?;
    assistant::runtime::check_model_name(&model)?;
    assistant::models::options(&model)?;
    let client = assistant::runtime::client()?;
    let runtime = assistant::runtime::probe_at(&client, assistant::runtime::BASE).await?;
    let selected=runtime.models.into_iter().find(|m|m.name==model&&!m.dnd_specialized&&m.weight_digest.is_some()).ok_or("Choose a verifiable local multilingual GGUF model. The test D&D model is not qualified.")?;
    assistant::models::verify(&selected.name, selected.weight_digest.as_deref())?;
    db.run(move |c| {
        let settings = assistant::store::Settings {
            enabled: true,
            model: selected.name,
            digest: selected.digest,
            specialization: "multilingual-rag".into(),
        };
        if let Some(id) = &campaign_id {
            let mut p = assistant::campaign::get(c, id)?;
            p.settings = settings.clone();
            assistant::campaign::write(c, id, &p)?;
            Ok(settings)
        } else {
            assistant::store::set_settings(c, &settings)
        }
    })
    .await
}

#[tauri::command]
pub async fn get_training_overview(
    db: tauri::State<'_, Database>,
    campaign_id: String,
) -> AppResult<assistant::training::Overview> {
    db.run_store(move |s| assistant::training::overview(&s.connection, &s.root, &campaign_id))
        .await
}

#[tauri::command]
pub async fn start_campaign_training(
    app: tauri::AppHandle,
    campaign_id: String,
    id: String,
    dataset_hash: String,
    events: tauri::ipc::Channel<serde_json::Value>,
) -> AppResult<assistant::training::Job> {
    assistant::training::start(app, campaign_id, id, dataset_hash, events).await
}

#[tauri::command]
pub async fn activate_campaign_training(
    app: tauri::AppHandle,
    campaign_id: String,
    id: String,
) -> AppResult<assistant::campaign::Profile> {
    assistant::training::activate_with_restore(app, campaign_id, id).await
}

#[tauri::command]
pub async fn get_campaign_ai(
    db: tauri::State<'_, Database>,
    campaign_id: String,
) -> AppResult<assistant::campaign::Overview> {
    db.run(move |c| assistant::campaign::overview(c, &campaign_id))
        .await
}

#[tauri::command]
pub async fn save_campaign_ai(
    db: tauri::State<'_, Database>,
    state: tauri::State<'_, assistant::service::State>,
    campaign_id: String,
    profile: assistant::campaign::Profile,
) -> AppResult<assistant::campaign::Profile> {
    if assistant::service::busy(&state)? {
        return Err("Wait for or cancel the AI operation before changing sources.".into());
    }
    db.run(move |c| assistant::campaign::save_preferences(c, &campaign_id, &profile))
        .await
}

/// The campaign's sharing server and what its optional AI offers. Network only on request.
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerAiView {
    pub server: String,
    pub status: crate::sync::api::ServerAiStatus,
}
async fn server_client(
    db: &Database,
    campaign: &str,
) -> AppResult<(String, String, crate::sync::api::Client)> {
    let (current, session, client) = crate::commands::sync::signed_in(db)?;
    let server = current.server.clone().unwrap_or_default();
    let link = crate::commands::sync::linked(db, campaign, &session, &server)
        .await
        .map_err(|_| {
            "Server AI needs this campaign to be linked to your sharing server (Sharing view)."
                .to_string()
        })?;
    Ok((server, link.remote_id, client))
}
#[tauri::command]
pub async fn server_ai_status(
    db: tauri::State<'_, Database>,
    campaign_id: String,
) -> AppResult<ServerAiView> {
    let (server, _, client) = server_client(&db, &campaign_id).await?;
    let status = client.ai_status().await.map_err(String::from)?;
    Ok(ServerAiView { server, status })
}
/// Explicit choice of where questions about this campaign run. Switching never moves
/// notes, models or history.
#[tauri::command]
pub async fn set_campaign_ai_execution(
    db: tauri::State<'_, Database>,
    state: tauri::State<'_, assistant::service::State>,
    campaign_id: String,
    execution: String,
    server_model: String,
) -> AppResult<assistant::campaign::Profile> {
    if assistant::service::busy(&state)? {
        return Err("Wait for or cancel the AI operation before changing where it runs.".into());
    }
    db.run(move |c| {
        let mut p = assistant::campaign::get(c, &campaign_id)?;
        p.execution = execution;
        p.server_model = server_model;
        assistant::campaign::write(c, &campaign_id, &p)
    })
    .await
}
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerAiAnswer {
    pub server: String,
    pub answer: crate::sync::api::ServerAnswer,
}
/// Asks the campaign's server. The question and the model name go to that server only; it
/// answers from what this account may read there. Nothing is written to the archive.
#[tauri::command]
pub async fn ask_server_ai(
    db: tauri::State<'_, Database>,
    campaign_id: String,
    question: String,
    locale: Option<String>,
) -> AppResult<ServerAiAnswer> {
    assistant::store::question(&question)?;
    let id = campaign_id.clone();
    let profile = db.run(move |c| assistant::campaign::get(c, &id)).await?;
    if profile.execution != "server" {
        return Err("This campaign's assistant runs on this computer. Choose the server in Campaign settings first.".into());
    }
    if profile.server_model.is_empty() {
        return Err("Choose a server model in Campaign settings first.".into());
    }
    let locale = locale.filter(|l| l.len() <= 16);
    let (server, remote, client) = server_client(&db, &campaign_id).await?;
    let answer = client
        .ai_answer(
            &remote,
            question.trim(),
            &profile.server_model,
            locale.as_deref(),
        )
        .await
        .map_err(String::from)?;
    Ok(ServerAiAnswer { server, answer })
}

#[tauri::command]
pub async fn refresh_campaign_ai(
    db: tauri::State<'_, Database>,
    campaign_id: String,
) -> AppResult<assistant::campaign::Overview> {
    db.run(move |c| assistant::campaign::refresh(c, &campaign_id))
        .await
}

#[tauri::command]
pub async fn ask_local_ai(
    db: tauri::State<'_, Database>,
    state: tauri::State<'_, assistant::service::State>,
    request: assistant::service::Request,
    events: tauri::ipc::Channel<assistant::service::Event>,
) -> AppResult<assistant::store::Turn> {
    assistant::service::ask(&db, &state, request, events).await
}

#[tauri::command]
pub fn cancel_local_ai(
    state: tauri::State<assistant::service::State>,
    id: String,
) -> AppResult<()> {
    assistant::service::cancel(&state, &id)
}

#[tauri::command]
pub async fn list_ai_history(
    app: tauri::AppHandle,
    db: tauri::State<'_, Database>,
    campaign_id: String,
    offset: u32,
) -> AppResult<Vec<assistant::store::Turn>> {
    // Checked under the Store lock: a question starting meanwhile must not have
    // its running turn recovered as interrupted.
    db.run(move |c| {
        if !assistant::service::busy(&app.state::<assistant::service::State>())? {
            assistant::store::recover(c)?
        }
        assistant::store::history(c, &campaign_id, offset)
    })
    .await
}

#[tauri::command]
pub async fn delete_ai_turn(
    db: tauri::State<'_, Database>,
    state: tauri::State<'_, assistant::service::State>,
    campaign_id: String,
    id: String,
) -> AppResult<()> {
    if assistant::service::busy(&state)? {
        return Err("Cancel the generation in progress first.".into());
    }
    db.run(move |c| assistant::store::delete(c, &campaign_id, &id))
        .await
}

#[tauri::command]
pub async fn check_ai_source(
    db: tauri::State<'_, Database>,
    campaign_id: String,
    turn_id: String,
    key: String,
) -> AppResult<serde_json::Value> {
    db.run(move |c| assistant::store::source_state(c, &campaign_id, &turn_id, &key))
        .await
}

#[tauri::command]
pub async fn list_ai_rule_sources(
    db: tauri::State<'_, Database>,
    edition: String,
) -> AppResult<serde_json::Value> {
    db.run(move |c|{let mut q=c.prepare("SELECT key,payload FROM wiki_cache WHERE key LIKE 'entry/%' ORDER BY fetched_at DESC").map_err(journal::storage)?;let rows=q.query_map([],|r|Ok((r.get::<_,String>(0)?,r.get::<_,String>(1)?))).map_err(journal::storage)?.collect::<rusqlite::Result<Vec<_>>>().map_err(journal::storage)?;let mut out=Vec::new();for (key,raw) in rows{let value:serde_json::Value=serde_json::from_str(&raw).map_err(|_|"Wiki source unreadable.")?;if value["document"]["gamesystem"]["key"].as_str()==Some(&edition){out.push(serde_json::json!({"key":key,"title":value["entry"]["name"],"document":value["document"]["name"]}))}}
        if edition == wikidot::EDITION {
            let mut q = c.prepare("SELECT substr(key,7) FROM wikidot_cache WHERE key LIKE 'entry/%' ORDER BY fetched_at DESC").map_err(journal::storage)?;
            let pages = q.query_map([], |r| r.get::<_, String>(0)).map_err(journal::storage)?.collect::<rusqlite::Result<Vec<_>>>().map_err(journal::storage)?;
            for page in pages {
                if let Some((e, _)) = wikidot::read_entry(c, &page)? {
                    let document = format!("Wikidot D&D 5e · {}", e.source.as_deref().unwrap_or("source not specified"));
                    out.push(serde_json::json!({"key":format!("wikidot/{page}"),"title":e.title,"document":document}));
                }
            }
        }
        Ok(serde_json::json!(out))}).await
}

pub fn data_root(db: &Database) -> AppResult<std::path::PathBuf> {
    db.root()
}

pub const AI_SETUP_BUSY: &str = "An AI component operation is already running.";

#[tauri::command]
pub async fn ai_setup_status(
    db: tauri::State<'_, Database>,
    state: tauri::State<'_, ai_setup::State>,
) -> AppResult<ai_setup::Status> {
    ai_setup::status(&data_root(&db)?, &state, assistant::runtime::BASE).await
}

#[tauri::command]
pub async fn ai_install_runtime(
    db: tauri::State<'_, Database>,
    state: tauri::State<'_, ai_setup::State>,
    accept: bool,
    events: tauri::ipc::Channel<ai_setup::Progress>,
) -> AppResult<()> {
    if !accept {
        return Err("Confirm size, origin and license before installing Ollama.".into());
    }
    if !ai_setup::SUPPORTED_PLATFORM {
        return Err("Guided installation is currently available only on Windows x64.".into());
    }
    let _gate = state.gate.try_lock().map_err(|_| AI_SETUP_BUSY)?;
    let token = state.token();
    let source = ai_setup::download::Source {
        url: ai_setup::OLLAMA_URL,
        sha256: ai_setup::OLLAMA_SHA256,
        bytes: ai_setup::OLLAMA_BYTES,
        unpacked: ai_setup::OLLAMA_EXTRACTED_BYTES,
        loopback_test: false,
    };
    ai_setup::download::install(&data_root(&db)?, &source, &token, |p| {
        let _ = events.send(p);
    })
    .await
}

#[tauri::command]
pub async fn ai_start_runtime(
    db: tauri::State<'_, Database>,
    state: tauri::State<'_, ai_setup::State>,
) -> AppResult<String> {
    let _gate = state.gate.try_lock().map_err(|_| AI_SETUP_BUSY)?;
    ai_setup::start(&data_root(&db)?, &state, assistant::runtime::BASE).await
}

#[tauri::command]
pub fn ai_stop_runtime(
    state: tauri::State<ai_setup::State>,
    service: tauri::State<assistant::service::State>,
) -> AppResult<()> {
    if assistant::service::busy(&service)? {
        return Err("Wait for or cancel the AI answer before stopping the runtime.".into());
    }
    state.shutdown();
    Ok(())
}

#[tauri::command]
pub async fn ai_pull_model(
    state: tauri::State<'_, ai_setup::State>,
    role: String,
    accept: bool,
    events: tauri::ipc::Channel<ai_setup::Progress>,
) -> AppResult<ai_setup::ModelState> {
    if !accept {
        return Err("Confirm the model size and origin before downloading.".into());
    }
    let _gate = state.gate.try_lock().map_err(|_| AI_SETUP_BUSY)?;
    let token = state.token();
    ai_setup::pull(assistant::runtime::BASE, &role, &token, |p| {
        let _ = events.send(p);
    })
    .await
}

#[tauri::command]
pub fn ai_cancel_setup(state: tauri::State<ai_setup::State>) {
    state.cancel();
}

#[tauri::command]
pub async fn ai_remove_runtime(app: tauri::AppHandle, accept: bool) -> AppResult<()> {
    if !accept {
        return Err("Confirm removal of the managed runtime.".into());
    }
    // Deleting a multi-GB runtime folder must not block the UI thread.
    crate::blocking(
        app,
        "Removal interrupted. Check the runtime folder before trying again.",
        move |app| {
            let state = app.state::<ai_setup::State>();
            let _gate = state.gate.try_lock().map_err(|_| AI_SETUP_BUSY)?;
            ai_setup::remove_runtime(&data_root(&app.state::<Database>())?, &state)
        },
    )
    .await
}
