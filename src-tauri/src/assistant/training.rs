use super::{
    campaign::{self, Stamp},
    runtime, service, store,
};
use crate::{
    journal::{identifier, require_campaign, storage, AppResult},
    Database,
};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::Read,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    time::{Duration, Instant},
};
use tauri::{ipc::Channel, Manager};
use uuid::Uuid;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Job {
    pub id: String,
    pub campaign_id: String,
    pub status: String,
    pub created_at: String,
    pub base_digest: String,
    pub weight_digest: String,
    pub model: String,
    pub digest: String,
    pub manifest: Vec<Stamp>,
    pub policy_hash: String,
    pub adapter: String,
    pub adapter_hash: String,
    pub config: String,
    pub config_hash: String,
    pub metrics: Value,
    pub error: String,
}
fn persist(c: &Connection, job: &Job) -> AppResult<Job> {
    let changed=c.execute("INSERT INTO campaign_ai_training(id,campaign_id,payload) VALUES(?1,?2,?3) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload WHERE campaign_ai_training.campaign_id=excluded.campaign_id",params![job.id,job.campaign_id,serde_json::to_string(job).map_err(|_|"Stato addestramento non serializzabile.")?]).map_err(storage)?;
    if changed != 1 {
        return Err("Identità addestramento già appartenente a un'altra campagna.".into());
    }
    Ok(job.clone())
}
pub fn all(c: &Connection, campaign: &str) -> AppResult<Vec<Job>> {
    require_campaign(c, campaign)?;
    let mut q = c
        .prepare(
            "SELECT payload FROM campaign_ai_training WHERE campaign_id=?1 ORDER BY rowid DESC",
        )
        .map_err(storage)?;
    let raw = q
        .query_map([campaign], |r| r.get::<_, String>(0))
        .map_err(storage)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(storage)?;
    raw.into_iter()
        .map(|s| {
            serde_json::from_str(&s).map_err(|_| "Cronologia addestramento illeggibile.".into())
        })
        .collect()
}
pub fn history(c: &Connection, campaign: &str) -> AppResult<Vec<Job>> {
    Ok(all(c, campaign)?.into_iter().take(20).collect())
}
pub fn recover(c: &Connection) -> AppResult<()> {
    for campaign in crate::journal::list_campaigns(c)? {
        for mut j in all(c, &campaign.id)? {
            if j.status == "running" {
                j.status = "interrupted".into();
                j.error = "Operazione interrotta: il modello precedente resta attivo.".into();
                persist(c, &j)?;
            }
        }
    }
    Ok(())
}
pub fn policy(p: &campaign::Profile) -> String {
    store::hash(&json!({"edition":p.edition,"kinds":p.include_kinds,"excluded":p.excluded_ids,"rules":p.rule_keys}).to_string())
}
pub fn model_owned(c: &Connection, campaign: Option<&str>, model: &str) -> AppResult<()> {
    if model.starts_with("chronexus-12b-") {
        let id = model
            .strip_prefix("chronexus-12b-")
            .unwrap_or("")
            .trim_end_matches(":latest");
        identifier(id)?;
        let campaign =
            campaign.ok_or("Gli adapter possono essere attivati soltanto dalla loro campagna.")?;
        let raw: String = c
            .query_row(
                "SELECT payload FROM campaign_ai_training WHERE id=?1 AND campaign_id=?2",
                params![id, campaign],
                |r| r.get(0),
            )
            .map_err(|_| "Questo adapter non appartiene alla campagna.")?;
        let j: Job = serde_json::from_str(&raw).map_err(|_| "Adapter illeggibile.")?;
        if j.status != "ready" || j.model != model {
            return Err("Adapter non validato per questa campagna.".into());
        }
        let p = campaign::get(c, campaign)?;
        if j.policy_hash != policy(&p)
            || j.manifest != campaign::stamps(&campaign::snapshot(c, campaign, &p)?)
        {
            return Err("Le fonti sono cambiate: riaddestra prima di attivare questo adapter oppure scegli il modello base.".into());
        }
    }
    Ok(())
}
pub fn home(root: &Path) -> PathBuf {
    #[cfg(debug_assertions)]
    if let Some(path) = std::env::var_os("CHRONEXUS_TRAINING_HOME") {
        return PathBuf::from(path);
    }
    root.join("ai-training")
}
fn python(home: &Path) -> PathBuf {
    if cfg!(windows) {
        home.join("venv/Scripts/python.exe")
    } else {
        home.join("venv/bin/python")
    }
}
fn worker(app: &tauri::AppHandle) -> AppResult<PathBuf> {
    #[cfg(debug_assertions)]
    {
        let _ = app;
        Ok(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../scripts/ai/train.py"))
    }
    #[cfg(not(debug_assertions))]
    {
        Ok(app
            .path()
            .resource_dir()
            .map_err(|_| "Risorse addestramento mancanti.")?
            .join("ai/train.py"))
    }
}
fn hash_file(path: &Path) -> AppResult<String> {
    hash_cancel(path, None)
}
fn hash_cancel(
    path: &Path,
    cancel: Option<&tokio::sync::watch::Receiver<bool>>,
) -> AppResult<String> {
    let meta = fs::symlink_metadata(path).map_err(|_| "File AI locale mancante.")?;
    if !meta.is_file() || meta.file_type().is_symlink() {
        return Err("File AI simbolici o speciali non consentiti.".into());
    }
    let mut f = fs::File::open(path).map_err(|_| "File AI non leggibile.")?;
    let mut h = Sha256::new();
    let mut buf = [0u8; 65536];
    loop {
        if cancel.is_some_and(|c| *c.borrow()) {
            return Err("Verifica pesi annullata.".into());
        }
        let n = f.read(&mut buf).map_err(|_| "Lettura pesi interrotta.")?;
        if n == 0 {
            break;
        }
        h.update(&buf[..n]);
    }
    Ok(format!("{:x}", h.finalize()))
}
async fn hash_large(
    path: PathBuf,
    cancel: tokio::sync::watch::Receiver<bool>,
) -> AppResult<String> {
    tokio::task::spawn_blocking(move || hash_cancel(&path, Some(&cancel)))
        .await
        .map_err(|_| "Verifica pesi interrotta.")?
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Overview {
    pub jobs: Vec<Job>,
    pub dataset_hash: String,
    pub dataset_bytes: usize,
    pub sources: usize,
    pub blocked: usize,
    pub added: usize,
    pub changed: usize,
    pub removed: usize,
    pub backend_installed: bool,
}
pub fn overview(c: &Connection, root: &Path, campaign: &str) -> AppResult<Overview> {
    let p = campaign::get(c, campaign)?;
    let sources = campaign::snapshot(c, campaign, &p)?;
    let stamps = campaign::stamps(&sources);
    let jobs = history(c, campaign)?;
    let baseline = jobs
        .iter()
        .find(|j| j.status == "ready")
        .map(|j| j.manifest.as_slice())
        .unwrap_or(&[]);
    let added = stamps
        .iter()
        .filter(|s| !baseline.iter().any(|o| o.key == s.key))
        .count();
    let changed = stamps
        .iter()
        .filter(|s| baseline.iter().any(|o| o.key == s.key && o.hash != s.hash))
        .count();
    let removed = baseline
        .iter()
        .filter(|o| !stamps.iter().any(|s| s.key == o.key))
        .count();
    let dataset_hash = store::hash(&json!({"manifest":stamps,"policy":policy(&p)}).to_string());
    let root = home(root);
    Ok(Overview {
        jobs,
        dataset_hash,
        dataset_bytes: serde_json::to_vec(&sources)
            .map_err(|_| "Dataset non serializzabile.")?
            .len(),
        sources: sources.len(),
        blocked: sources
            .iter()
            .filter(|s| service::instruction_risk(&s.text) || service::instruction_risk(&s.title))
            .count(),
        added,
        changed,
        removed,
        backend_installed: python(&root).is_file()
            && root.join("hf-base/model.safetensors").is_file(),
    })
}
struct LocalChild(std::process::Child);
impl std::ops::Deref for LocalChild {
    type Target = std::process::Child;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}
impl std::ops::DerefMut for LocalChild {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.0
    }
}
impl Drop for LocalChild {
    fn drop(&mut self) {
        let _ = self.0.kill();
        let _ = self.0.wait();
    }
}
async fn execute(
    app: &tauri::AppHandle,
    home: &Path,
    input: &Path,
    out: &Path,
    merge: bool,
    cancel: &mut tokio::sync::watch::Receiver<bool>,
    events: &Channel<Value>,
) -> AppResult<Value> {
    fs::create_dir_all(out).map_err(|_| "Spazio o permessi insufficienti per l'addestramento.")?;
    let mut cmd = Command::new(python(home));
    cmd.arg("-I")
        .arg("-B")
        .arg(worker(app)?)
        .arg("--input")
        .arg(input)
        .arg("--output")
        .arg(out);
    if merge {
        cmd.arg("--merge");
    }
    cmd.env("HF_HUB_OFFLINE", "1")
        .env("TRANSFORMERS_OFFLINE", "1")
        .env("HF_HUB_DISABLE_TELEMETRY", "1")
        .env("WANDB_DISABLED", "true");
    let log = fs::File::create(out.join("worker.log"))
        .map_err(|_| "Impossibile creare il registro locale.")?;
    cmd.stdin(Stdio::null())
        .stdout(Stdio::from(
            log.try_clone().map_err(|_| "Registro non disponibile.")?,
        ))
        .stderr(Stdio::from(log));
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }
    let mut child=LocalChild(cmd.spawn().map_err(|_|"Backend QLoRA locale non disponibile. Prepara l'ambiente di addestramento; nessun download automatico.")?);
    let started = Instant::now();
    let mut last = String::new();
    loop {
        if *cancel.borrow() || started.elapsed() > Duration::from_secs(7200) {
            let _ = child.kill();
            let _ = child.wait();
            return Err(
                "Operazione annullata o oltre il limite di due ore. Modello attivo invariato."
                    .into(),
            );
        }
        let path = out.join("status.json");
        if fs::metadata(&path).is_ok_and(|m| m.len() <= 16384) {
            if let Ok(raw) = fs::read_to_string(path) {
                if raw != last {
                    if let Ok(v) = serde_json::from_str::<Value>(&raw) {
                        let _ = events.send(v);
                    }
                    last = raw;
                }
            }
        }
        if let Some(status) = child
            .try_wait()
            .map_err(|_| "Stato del processo di addestramento non disponibile.")?
        {
            // Observe the final atomic status after process exit, even if the
            // publication raced with the preceding progress poll.
            let final_path = out.join("status.json");
            if fs::metadata(&final_path).is_ok_and(|m| m.len() <= 16384) {
                last = fs::read_to_string(final_path).map_err(|_| "Esito finale non leggibile.")?;
            }
            let value: Value = serde_json::from_str(&last).map_err(|_| {
                "Il backend non ha prodotto un esito valido; consulta il registro locale."
            })?;
            if !status.success() || value["phase"] != "complete" {
                return Err(format!(
                    "Addestramento non completato: {}",
                    value["message"]
                        .as_str()
                        .unwrap_or("errore del backend; consulta worker.log")
                ));
            }
            return Ok(value);
        }
        tokio::time::sleep(Duration::from_millis(200)).await;
    }
}
pub async fn start(
    app: tauri::AppHandle,
    campaign: String,
    id: String,
    expected: String,
    events: Channel<Value>,
) -> AppResult<Job> {
    identifier(&id)?;
    let state = app.state::<service::State>();
    let mut cancel = {
        let mut g = state.running.lock().map_err(|_| "Stato AI occupato.")?;
        if g.is_some() {
            return Err("Attendi o annulla l'operazione AI in corso.".into());
        }
        let (tx, rx) = tokio::sync::watch::channel(false);
        *g = Some((id.clone(), tx));
        rx
    };
    let result = run(&app, &campaign, &id, &expected, &events, &mut cancel).await;
    if let Ok(mut g) = state.running.lock() {
        *g = None;
    }
    result
}
async fn run(
    app: &tauri::AppHandle,
    campaign: &str,
    id: &str,
    expected: &str,
    events: &Channel<Value>,
    cancel: &mut tokio::sync::watch::Receiver<bool>,
) -> AppResult<Job> {
    let db = app.state::<Database>();
    let (generation,root,p,sources,mut j)=db.with_store(|s|{
        let v=overview(&s.connection,&s.root,campaign)?;
        if v.dataset_hash!=expected{return Err("Le fonti sono cambiate: ricarica l'anteprima prima di riaddestrare.".into());}
        if !v.backend_installed{return Err("Backend QLoRA locale non installato. Consulta docs/AI_TRAINING.md; nessun training simulato.".into());}
        if v.blocked>0{return Err("Alcuni estratti contengono possibili istruzioni al modello: escludili o separali dal testo narrativo prima di addestrare.".into());}
        if v.sources==0{return Err("Nessun estratto approvato da addestrare.".into());}
        let exists:bool=s.connection.query_row("SELECT EXISTS(SELECT 1 FROM campaign_ai_training WHERE id=?1)",[id],|r|r.get(0)).map_err(storage)?;
        if exists{return Err("Identità addestramento già usata: ricarica prima di riprovare.".into());}
        let p=campaign::get(&s.connection,campaign)?;
        if !p.settings.enabled || !(p.settings.model=="gemma4:12b" || p.settings.model.starts_with("chronexus-12b-")){return Err("Seleziona e attiva prima Gemma 4 12B nelle impostazioni della campagna.".into());}
        let sources=campaign::snapshot(&s.connection,campaign,&p)?;
        let created_at=s.connection.query_row("SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now')",[],|r|r.get(0)).map_err(storage)?;
        let j=Job{id:id.into(),campaign_id:campaign.into(),status:"running".into(),created_at,base_digest:String::new(),weight_digest:String::new(),model:format!("chronexus-12b-{id}:latest"),digest:String::new(),manifest:campaign::stamps(&sources),policy_hash:policy(&p),adapter:String::new(),adapter_hash:String::new(),config:String::new(),config_hash:String::new(),metrics:json!({}),error:String::new()};
        persist(&s.connection,&j)?;Ok((s.directory.clone(),home(&s.root),p,sources,j))
    })?;
    let mut stop = cancel.clone();
    let work = async {
        let client = runtime::client()?;
        let info = runtime::probe_at(&client, runtime::BASE).await?;
        let base = info
            .models
            .iter()
            .find(|m| m.name == "gemma4:12b")
            .ok_or("Gemma 4 12B locale non installato in Ollama.")?;
        j.base_digest = base.digest.clone();
        j.weight_digest = base
            .weight_digest
            .clone()
            .ok_or("Pesi base non verificabili.")?;
        if j.weight_digest != "bb722270d54346adc198f213851dbe0207e87c3ecf2a0aff4d92262726215391" {
            return Err("I pesi Gemma installati differiscono dalla versione qualificata per QLoRA. Richiedono una nuova valutazione.".into());
        }
        let show = runtime::post(
            &client,
            runtime::BASE,
            "/api/show",
            json!({"model":"gemma4:12b"}),
        )
        .await?;
        let gguf = show["modelfile"]
            .as_str()
            .and_then(|s| s.lines().find_map(|l| l.strip_prefix("FROM ")))
            .map(|s| PathBuf::from(s.trim_matches(['\"', '\r', ' '])))
            .ok_or("Percorso GGUF non disponibile.")?;
        if !gguf.is_absolute()
            || gguf.file_name().and_then(|s| s.to_str())
                != Some(&format!("sha256-{}", j.weight_digest))
            || show.pointer("/details/family").and_then(Value::as_str) != Some("gemma4")
        {
            return Err("Identità o percorso base Gemma non valido.".into());
        }
        if show
            .pointer("/model_info/gemma4.block_count")
            .and_then(Value::as_u64)
            != Some(48)
        {
            return Err("Il modello non corrisponde a Gemma 4 12B.".into());
        }
        if hash_large(gguf.clone(), cancel.clone()).await? != j.weight_digest {
            return Err("I byte GGUF base non corrispondono all'impronta qualificata.".into());
        }
        for model in [&p.settings.model, "gemma4:12b"] {
            runtime::post(
                &client,
                runtime::BASE,
                "/api/generate",
                json!({"model":model,"keep_alive":0}),
            )
            .await?;
        }
        let work = root.join("jobs").join(id);
        fs::create_dir_all(&work).map_err(|_| "Cartella addestramento non disponibile.")?;
        let input = work.join("input.json");
        fs::write(
            &input,
            serde_json::to_vec(&json!({"base":root.join("hf-base"),"sources":sources}))
                .map_err(|_| "Dataset non serializzabile.")?,
        )
        .map_err(|_| "Dataset non salvabile.")?;
        let output = work.join("train");
        j.metrics = execute(app, &root, &input, &output, false, cancel, events).await?;
        if *cancel.borrow() {
            return Err("Addestramento annullato.".into());
        }
        let adapter = output.join("adapter/adapter_model.safetensors");
        let config = output.join("adapter/adapter_config.json");
        for path in [&adapter, &config] {
            if fs::metadata(path).map_err(|_| "Adapter incompleto.")?.len() > 64 * 1024 * 1024 {
                return Err("Adapter oltre il limite di 64 MiB.".into());
            }
        }
        j.adapter_hash = hash_file(&adapter)?;
        j.config_hash = hash_file(&config)?;
        let attachment_dir = generation.join("attachments").join(campaign);
        fs::create_dir_all(&attachment_dir).map_err(|_| "Cartella adapter non disponibile.")?;
        j.adapter = format!("attachments/{campaign}/{}.safetensors", Uuid::new_v4());
        j.config = format!("attachments/{campaign}/{}.json", Uuid::new_v4());
        fs::copy(adapter, generation.join(&j.adapter)).map_err(|_| "Adapter non salvato.")?;
        fs::copy(config, generation.join(&j.config))
            .map_err(|_| "Configurazione adapter non salvata.")?;
        let merge_input = work.join("merge.json");
        fs::write(
            &merge_input,
            serde_json::to_vec(&json!({"gguf":gguf,"adapter":output.join("adapter")}))
                .map_err(|_| "Configurazione merge non valida.")?,
        )
        .map_err(|_| "Configurazione merge non salvabile.")?;
        let merged = work.join("merged");
        execute(app, &root, &merge_input, &merged, true, cancel, events).await?;
        let path = merged.join("model.gguf");
        let merged_hash = hash_file(&path)?;
        // Upload only to fixed loopback; the runtime already confirmed cloud-off.
        let file = tokio::fs::File::open(&path)
            .await
            .map_err(|_| "Pesi derivati non leggibili.")?;
        let upload = client
            .post(format!("{}/api/blobs/sha256:{merged_hash}", runtime::BASE))
            .body(reqwest::Body::wrap_stream(
                tokio_util::io::ReaderStream::with_capacity(file, 1048576),
            ))
            .send();
        let response = tokio::select! {r=upload=>r.map_err(|_|"Importazione locale dei pesi interrotta.")?,_=cancel.changed()=>return Err("Importazione annullata.".into())};
        if !response.status().is_success() {
            return Err("Importazione dei pesi nel runtime locale non riuscita.".into());
        }
        runtime::post(&client,runtime::BASE,"/api/create",json!({"model":j.model,"files":{"model.gguf":format!("sha256:{merged_hash}")},"stream":false})).await?;
        let validated = qualify(&client, &j.model).await?;
        j.metrics["validation"] = validated;
        let info = runtime::probe_at(&client, runtime::BASE).await?;
        j.digest = info
            .models
            .iter()
            .find(|m| m.name == j.model)
            .ok_or("Modello derivato non trovato.")?
            .digest
            .clone();
        j.status = "ready".into();
        Ok::<(), String>(())
    };
    let work = tokio::select! {r=work=>r,_=stop.changed()=>Err("Operazione annullata. Modello attivo invariato.".into())};
    if let Err(e) = work {
        j.status = if *cancel.borrow() {
            "cancelled"
        } else {
            "error"
        }
        .into();
        j.error = e;
    }
    db.with_store(|s| {
        if s.directory != generation {
            return Err("Archivio cambiato: nessun risultato scritto nel nuovo profilo.".into());
        }
        persist(&s.connection, &j)
    })
}
async fn qualify(client: &reqwest::Client, model: &str) -> AppResult<Value> {
    let mut results = vec![];
    for (question, text, keyword) in [
        (
            "Cosa dice Mirna di custodire?",
            "Mirna dice di custodire una chiave di ottone.",
            "ottone",
        ),
        (
            "Dove si trova Neral?",
            "Neral si trova a Portoluce.",
            "Portoluce",
        ),
        (
            "Quanti fratelli ha Mirna?",
            "Mirna dice di custodire una chiave di ottone.",
            "Non risulta",
        ),
    ] {
        let r=runtime::post(client,runtime::BASE,"/api/chat",json!({"model":model,"stream":false,"think":false,"keep_alive":"2m","messages":[{"role":"system","content":service::system_prompt("campaign",None)},{"role":"user","content":json!({"question":question,"sources":[{"key":"S1","text":text}]}).to_string()}],"options":{"num_ctx":4096,"num_predict":150,"num_gpu":99,"temperature":0.0}})).await?;
        let answer = r["message"]["content"]
            .as_str()
            .ok_or("Validazione priva di risposta.")?;
        if !answer.to_lowercase().contains(&keyword.to_lowercase())
            || (keyword != "Non risulta" && !answer.contains("[S1]"))
        {
            return Err("Il modello addestrato non supera la verifica di risposte/citazioni. Non è stato attivato.".into());
        }
        results.push(json!({"question":question,"answer":answer}));
    }
    let resident = runtime::get(client, runtime::BASE, "/api/ps").await?;
    if !resident["models"].as_array().is_some_and(|rows| {
        rows.iter()
            .any(|r| r["name"] == model && r["size_vram"].as_u64().unwrap_or(0) > 0)
    }) {
        return Err("Validazione GPU del modello addestrato non riuscita.".into());
    }
    Ok(json!({"checks":results,"gpuConfirmed":true}))
}
pub fn activate(c: &Connection, campaign: &str, id: &str) -> AppResult<campaign::Profile> {
    let j = history(c, campaign)?
        .into_iter()
        .find(|j| j.id == id)
        .ok_or("Addestramento non trovato.")?;
    model_owned(c, Some(campaign), &j.model)?;
    let mut p = campaign::get(c, campaign)?;
    p.settings = store::Settings {
        enabled: true,
        model: j.model,
        digest: j.digest,
        specialization: "multilingual-rag".into(),
    };
    campaign::write(c, campaign, &p)
}
pub async fn activate_with_restore(
    app: tauri::AppHandle,
    campaign: String,
    id: String,
) -> AppResult<campaign::Profile> {
    identifier(&id)?;
    let state = app.state::<service::State>();
    let mut cancel = {
        let mut g = state.running.lock().map_err(|_| "Stato AI occupato.")?;
        if g.is_some() {
            return Err("Attendi o annulla l'operazione AI in corso.".into());
        }
        let (tx, rx) = tokio::sync::watch::channel(false);
        *g = Some((id.clone(), tx));
        rx
    };
    let mut stop = cancel.clone();
    let work = async {
        let db = app.state::<Database>();
        let (generation, root, mut job) = db.with_store(|s| {
            let j = all(&s.connection, &campaign)?
                .into_iter()
                .find(|j| j.id == id)
                .ok_or("Adapter non trovato nella campagna.")?;
            model_owned(&s.connection, Some(&campaign), &j.model)?;
            validate_files(&s.connection, &s.directory)?;
            Ok((s.directory.clone(), home(&s.root), j))
        })?;
        let client = runtime::client()?;
        let runtime = runtime::probe_at(&client, runtime::BASE).await?;
        if !runtime
            .models
            .iter()
            .any(|m| m.name == job.model && m.digest == job.digest)
        {
            let show = runtime::post(
                &client,
                runtime::BASE,
                "/api/show",
                json!({"model":"gemma4:12b"}),
            )
            .await?;
            runtime::check_local(&show)?;
            if runtime::weight_digest(&show).as_deref() != Some(&job.weight_digest) {
                return Err("Installa gli stessi pesi base Gemma 4 12B usati nell'addestramento; nessun download automatico.".into());
            }
            let gguf = show["modelfile"]
                .as_str()
                .and_then(|s| s.lines().find_map(|l| l.strip_prefix("FROM ")))
                .map(|s| PathBuf::from(s.trim_matches(['\"', '\r', ' '])))
                .ok_or("Percorso GGUF mancante.")?;
            if !gguf.is_absolute()
                || gguf.file_name().and_then(|s| s.to_str())
                    != Some(&format!("sha256-{}", job.weight_digest))
            {
                return Err("Percorso dei pesi base non valido.".into());
            }
            if hash_large(gguf.clone(), cancel.clone()).await? != job.weight_digest {
                return Err("I byte GGUF base non corrispondono all'impronta salvata.".into());
            }
            let work = root.join("restored").join(Uuid::new_v4().to_string());
            let adapter = work.join("adapter");
            fs::create_dir_all(&adapter)
                .map_err(|_| "Cartella di ricostruzione non disponibile.")?;
            fs::copy(
                generation.join(&job.adapter),
                adapter.join("adapter_model.safetensors"),
            )
            .map_err(|_| "Adapter non leggibile.")?;
            fs::copy(
                generation.join(&job.config),
                adapter.join("adapter_config.json"),
            )
            .map_err(|_| "Configurazione adapter non leggibile.")?;
            let input = work.join("input.json");
            fs::write(
                &input,
                serde_json::to_vec(&json!({"gguf":gguf,"adapter":adapter}))
                    .map_err(|_| "Configurazione non valida.")?,
            )
            .map_err(|_| "Configurazione non salvabile.")?;
            let out = work.join("merged");
            execute(
                &app,
                &root,
                &input,
                &out,
                true,
                &mut cancel,
                &Channel::new(|_| Ok(())),
            )
            .await?;
            let path = out.join("model.gguf");
            let hash = hash_large(path.clone(), cancel.clone()).await?;
            let file = tokio::fs::File::open(path)
                .await
                .map_err(|_| "Pesi derivati mancanti.")?;
            let r = client
                .post(format!("{}/api/blobs/sha256:{hash}", runtime::BASE))
                .body(reqwest::Body::wrap_stream(
                    tokio_util::io::ReaderStream::with_capacity(file, 1048576),
                ))
                .send()
                .await
                .map_err(|_| "Importazione locale non riuscita.")?;
            if !r.status().is_success() {
                return Err("Importazione dei pesi ricostruiti non riuscita.".into());
            }
            runtime::post(&client,runtime::BASE,"/api/create",json!({"model":job.model,"files":{"model.gguf":format!("sha256:{hash}")},"stream":false})).await?;
            job.metrics["restoreValidation"] = qualify(&client, &job.model).await?;
            let info = runtime::probe_at(&client, runtime::BASE).await?;
            job.digest = info
                .models
                .iter()
                .find(|m| m.name == job.model)
                .ok_or("Modello ricostruito mancante.")?
                .digest
                .clone();
        }
        if *cancel.borrow() {
            return Err("Attivazione annullata.".into());
        }
        db.with_store(|s| {
            if s.directory != generation {
                return Err("Archivio cambiato: attivazione annullata.".into());
            }
            persist(&s.connection, &job)?;
            activate(&s.connection, &campaign, &id)
        })
    };
    let result = tokio::select! {r=work=>r,_=stop.changed()=>Err("Attivazione annullata. Modello precedente invariato.".into())};
    if let Ok(mut g) = state.running.lock() {
        *g = None;
    }
    result
}
pub fn validate_archive(c: &Connection) -> AppResult<()> {
    for campaign in crate::journal::list_campaigns(c)? {
        for j in all(c, &campaign.id)? {
            identifier(&j.id)?;
            if j.campaign_id != campaign.id
                || !["running", "ready", "error", "cancelled", "interrupted"]
                    .contains(&j.status.as_str())
                || j.manifest.len() > 4000
                || j.error.len() > 4000
            {
                return Err("Cronologia addestramento non valida.".into());
            }
            for path in [&j.adapter, &j.config] {
                if !path.is_empty()
                    && (!crate::backup::attachment_path(path)
                        || !path.starts_with(&format!("attachments/{}/", campaign.id)))
                {
                    return Err("Percorso adapter non valido.".into());
                }
            }
        }
    }
    Ok(())
}
pub fn validate_files(c: &Connection, directory: &Path) -> AppResult<()> {
    for campaign in crate::journal::list_campaigns(c)? {
        for j in all(c, &campaign.id)? {
            if j.status == "ready" {
                for (path, hash) in [(&j.adapter, &j.adapter_hash), (&j.config, &j.config_hash)] {
                    if hash_file(&directory.join(path))? != *hash {
                        return Err(
                            "Adapter mancante o modificato: backup/ripristino fermato.".into()
                        );
                    }
                }
            }
        }
    }
    Ok(())
}

#[cfg(test)]
#[path = "training_tests.rs"]
mod tests;
