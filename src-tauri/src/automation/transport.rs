use super::{domain, tools, Policy};
use crate::{
    backup::Store,
    journal::{self, AppResult},
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    fs,
    io::{Read, Write},
    net::{TcpListener, TcpStream},
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    thread,
    time::{Duration, Instant},
};
use tempfile::NamedTempFile;
const MAX_BODY: usize = 2_100_000;
const MAX_REPLY: usize = 8_500_000;
pub const DISCOVERY: &str = "automation-connection.json";
#[derive(Clone, Debug)]
pub struct Config {
    pub policy: Policy,
}
impl Config {
    pub fn parse(args: impl IntoIterator<Item = String>) -> AppResult<Option<Self>> {
        let mut enabled = false;
        let mut write = false;
        let mut campaign = None;
        let mut args = args.into_iter();
        while let Some(arg) = args.next() {
            match arg.as_str() {
                "--automation" => enabled = true,
                "--automation-write" => write = true,
                "--automation-campaign" => {
                    if campaign.is_some() {
                        return Err("Campagna duplicata nei parametri automation.".into());
                    }
                    let id = args
                        .next()
                        .ok_or("Manca l'UUID della campagna automation.")?;
                    journal::identifier(&id)?;
                    campaign = Some(id);
                }
                other if other.starts_with("--automation") => {
                    return Err("Parametro automation sconosciuto.".into())
                }
                _ => {}
            }
        }
        if !enabled {
            if write || campaign.is_some() {
                return Err(
                    "Aggiungi --automation per abilitare esplicitamente il collegamento.".into(),
                );
            }
            return Ok(None);
        }
        if write && campaign.is_none() {
            return Err("La scrittura automation richiede --automation-campaign UUID.".into());
        }
        Ok(Some(Self {
            policy: Policy { campaign, write },
        }))
    }
}
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Discovery {
    format: String,
    version: u32,
    endpoint: String,
    token: String,
    campaign_id: Option<String>,
    write: bool,
    app_version: String,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Request {
    tool: String,
    arguments: Value,
}
pub struct Server {
    stop: Arc<AtomicBool>,
    worker: Mutex<Option<thread::JoinHandle<()>>>,
    path: PathBuf,
    token: String,
}
impl Server {
    pub fn start(
        root: &Path,
        config: Config,
        store: Arc<Mutex<Store>>,
        changed: Arc<dyn Fn(String) + Send + Sync>,
    ) -> AppResult<Self> {
        if let Some(id) = &config.policy.campaign {
            journal::require_campaign(
                &store.lock().map_err(|_| "Archivio occupato.")?.connection,
                id,
            )?;
        }
        let path = root.join(DISCOVERY);
        if let Ok(meta) = fs::symlink_metadata(&path) {
            if !meta.is_file() || meta.file_type().is_symlink() || meta.len() > 16_384 {
                return Err("File di collegamento automation non sicuro.".into());
            }
            let previous: Discovery = serde_json::from_slice(
                &fs::read(&path).map_err(|_| "File automation non leggibile.")?,
            )
            .map_err(|_| "File automation sconosciuto: non viene sovrascritto.")?;
            if previous.format != "chronexus-automation" {
                return Err("File automation sconosciuto: non viene sovrascritto.".into());
            }
        }
        let listener = TcpListener::bind("127.0.0.1:0")
            .map_err(|_| "Porta locale automation non disponibile.")?;
        listener
            .set_nonblocking(true)
            .map_err(|_| "Collegamento automation non disponibile.")?;
        let host = listener
            .local_addr()
            .map_err(|_| "Indirizzo automation non disponibile.")?
            .to_string();
        let mut bytes = [0u8; 32];
        getrandom::fill(&mut bytes).map_err(|_| "Impossibile generare il segreto automation.")?;
        let token = bytes
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<String>();
        let discovery = Discovery {
            format: "chronexus-automation".into(),
            version: 1,
            endpoint: format!("http://{host}/automation"),
            token: token.clone(),
            campaign_id: config.policy.campaign.clone(),
            write: config.policy.write,
            app_version: env!("CARGO_PKG_VERSION").into(),
        };
        let raw = serde_json::to_vec_pretty(&discovery)
            .map_err(|_| "Configurazione automation non disponibile.")?;
        let mut file = NamedTempFile::new_in(root)
            .map_err(|_| "Impossibile creare il collegamento automation.")?;
        file.write_all(&raw)
            .and_then(|_| file.as_file().sync_all())
            .map_err(|_| "Impossibile salvare il collegamento automation.")?;
        let stop = Arc::new(AtomicBool::new(false));
        let worker_stop = Arc::clone(&stop);
        let worker_token = token.clone();
        let worker = thread::Builder::new()
            .name("chronexus-external-tools".into())
            .spawn(move || {
                while !worker_stop.load(Ordering::Relaxed) {
                    match listener.accept() {
                        Ok((mut stream, peer)) if peer.ip().is_loopback() => {
                            let _ = serve(
                                &mut stream,
                                &host,
                                &worker_token,
                                &config.policy,
                                &store,
                                &changed,
                            );
                        }
                        Ok(_) => {}
                        Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                            thread::sleep(Duration::from_millis(20))
                        }
                        Err(_) => break,
                    }
                }
            })
            .map_err(|_| "Impossibile avviare il collegamento automation.")?;
        let server = Self {
            stop,
            worker: Mutex::new(Some(worker)),
            path,
            token,
        };
        if file.persist(&server.path).is_err() {
            server.stop.store(true, Ordering::Relaxed);
            return Err("Impossibile pubblicare il collegamento automation.".into());
        }
        // The file contains a per-launch capability; it is outside SQLite and campaign backups.
        Ok(server)
    }
}
impl Server {
    pub fn shutdown(&self) {
        self.stop.store(true, Ordering::Relaxed);
        if let Ok(mut worker) = self.worker.lock() {
            if let Some(worker) = worker.take() {
                let _ = worker.join();
            }
        }
        if fs::read(&self.path)
            .ok()
            .and_then(|v| serde_json::from_slice::<Discovery>(&v).ok())
            .is_some_and(|d| d.token == self.token)
        {
            let _ = fs::remove_file(&self.path);
        }
    }
}
impl Drop for Server {
    fn drop(&mut self) {
        self.shutdown();
    }
}
fn response(stream: &mut TcpStream, status: u16, body: Value) -> std::io::Result<()> {
    let bytes = serde_json::to_vec(&body)?;
    let bytes = if bytes.len() > MAX_REPLY {
        serde_json::to_vec(
            &json!({"error":"Risposta troppo grande. Leggi meno dati; una scrittura potrebbe essere già confermata."}),
        )?
    } else {
        bytes
    };
    write!(stream,"HTTP/1.1 {status} Result\r\nContent-Type: application/json\r\nContent-Length: {}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n",bytes.len())?;
    stream.write_all(&bytes)
}
fn secret_equal(a: &str, b: &str) -> bool {
    let mut difference = a.len() ^ b.len();
    for (i, byte) in b.bytes().enumerate() {
        difference |= (a.as_bytes().get(i).copied().unwrap_or(0) ^ byte) as usize;
    }
    difference == 0
}
fn read_request(stream: &mut TcpStream, host: &str, token: &str) -> Result<Vec<u8>, u16> {
    let begin = Instant::now();
    let mut header = Vec::new();
    while !header.ends_with(b"\r\n\r\n") {
        if header.len() >= 8192 || begin.elapsed() > Duration::from_secs(3) {
            return Err(413);
        }
        let mut byte = [0];
        stream.read_exact(&mut byte).map_err(|_| 400u16)?;
        header.push(byte[0]);
    }
    let header = std::str::from_utf8(&header).map_err(|_| 400u16)?;
    let mut lines = header.split("\r\n");
    if lines.next() != Some("POST /automation HTTP/1.1") {
        return Err(405);
    }
    let mut fields = HashMap::new();
    for line in lines.filter(|v| !v.is_empty()) {
        let (key, value) = line.split_once(':').ok_or(400u16)?;
        if key.is_empty()
            || key.chars().any(|c| !c.is_ascii_alphanumeric() && c != '-')
            || fields
                .insert(key.to_ascii_lowercase(), value.trim())
                .is_some()
        {
            return Err(400);
        }
    }
    if fields.contains_key("origin")
        || fields.get("host") != Some(&host)
        || fields.contains_key("transfer-encoding")
    {
        return Err(403);
    }
    if !fields
        .get("authorization")
        .is_some_and(|value| secret_equal(value, &format!("Bearer {token}")))
    {
        return Err(401);
    }
    if fields
        .get("content-type")
        .is_none_or(|v| v.split(';').next().unwrap_or("").trim() != "application/json")
    {
        return Err(415);
    }
    let size: usize = fields
        .get("content-length")
        .ok_or(411u16)?
        .parse()
        .map_err(|_| 400u16)?;
    if size == 0 || size > MAX_BODY {
        return Err(413);
    }
    let mut body = vec![0; size];
    let mut offset = 0;
    while offset < size {
        if begin.elapsed() > Duration::from_secs(3) {
            return Err(408);
        }
        let count = stream.read(&mut body[offset..]).map_err(|_| 400u16)?;
        if count == 0 {
            return Err(400);
        }
        offset += count;
    }
    Ok(body)
}
fn serve(
    stream: &mut TcpStream,
    host: &str,
    token: &str,
    policy: &Policy,
    store: &Arc<Mutex<Store>>,
    changed: &Arc<dyn Fn(String) + Send + Sync>,
) -> std::io::Result<()> {
    stream.set_read_timeout(Some(Duration::from_secs(1)))?;
    stream.set_write_timeout(Some(Duration::from_secs(1)))?;
    let raw = match read_request(stream, host, token) {
        Ok(raw) => raw,
        Err(status) => {
            return response(
                stream,
                status,
                json!({"error":"Richiesta automation rifiutata."}),
            )
        }
    };
    let request: Request = match serde_json::from_slice(&raw) {
        Ok(v) => v,
        Err(_) => return response(stream, 400, json!({"error":"Richiesta JSON non valida."})),
    };
    if request.tool == "describe" {
        return response(
            stream,
            200,
            match tools(policy) {
                Ok(v) => json!({"result":v}),
                Err(e) => json!({"error":e}),
            },
        );
    }
    let outcome=match store.try_lock(){Ok(store)=>domain::call(&store.connection,policy,&request.tool,&request.arguments),Err(_)=>Err("Archivio occupato: ripeti la lettura più tardi; non ripetere automaticamente una scrittura.".into())};
    match outcome {
        Ok((result, writing)) => {
            if writing {
                if let Some(id) = request.arguments["campaignId"].as_str() {
                    changed(id.into());
                }
            }
            response(stream, 200, json!({"result":result}))
        }
        Err(message) => response(stream, 200, json!({"error":message})),
    }
}
