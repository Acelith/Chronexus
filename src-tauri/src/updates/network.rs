use crate::journal::AppResult;
use reqwest::{Client, Url};
use tokio_util::sync::CancellationToken;
pub fn url(value: &str) -> AppResult<Url> {
    if value.len() > 2048 {
        return Err("Indirizzo aggiornamenti troppo lungo.".into());
    }
    let u = Url::parse(value)
        .map_err(|_| "Inserisci un indirizzo HTTPS valido per il canale aggiornamenti.")?;
    if u.scheme() != "https"
        || u.host_str().is_none()
        || !u.username().is_empty()
        || u.password().is_some()
        || u.fragment().is_some()
        || u.query().is_some()
    {
        return Err("Usa un indirizzo HTTPS senza credenziali, query o frammenti.".into());
    }
    Ok(u)
}
pub fn artifact(endpoint: &Url, download: &Url) -> AppResult<()> {
    url(download.as_str())?;
    if endpoint.origin() != download.origin() {
        return Err("Il pacchetto deve trovarsi sullo stesso server HTTPS del manifesto.".into());
    }
    Ok(())
}
/// Callers validate the initial URL. Redirects must retain its HTTPS origin.
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
            _ = cancel.cancelled() => return Err("Download annullato.".into()),
            value = client.get(destination.clone()).send() => value.map_err(|_| "Server aggiornamenti non raggiungibile. Verifica connessione e certificato HTTPS.")?,
        };
        if response.status().is_redirection() {
            let location = response
                .headers()
                .get(reqwest::header::LOCATION)
                .and_then(|v| v.to_str().ok())
                .ok_or("Reindirizzamento aggiornamenti non valido.")?;
            destination = destination
                .join(location)
                .map_err(|_| "Reindirizzamento aggiornamenti non valido.")?;
            artifact(&initial, &destination)?;
            continue;
        }
        match response.status().as_u16() {
            204 => return Ok(None),
            401 | 403 | 404 => return Err("Canale aggiornamenti non pubblico o non ancora pubblicato. Verifica che latest.json e l’installer siano scaricabili senza login.".into()),
            200 => {},
            _ => return Err("Il server degli aggiornamenti ha restituito un errore. Riprova più tardi.".into()),
        }
        let total = response.content_length();
        if total.is_some_and(|n| n > limit as u64) {
            return Err("Pacchetto oltre il limite consentito: download bloccato.".into());
        }
        let mut response = response;
        let mut bytes = Vec::new();
        loop {
            let chunk = tokio::select! {
            biased;
                _ = cancel.cancelled() => return Err("Download annullato.".into()),
                value = response.chunk() => value.map_err(|_| "Download interrotto. Riprova: nulla è stato installato.")?,
            };
            let Some(chunk) = chunk else { break };
            if chunk.len() > limit.saturating_sub(bytes.len()) {
                return Err("Pacchetto oltre il limite consentito: download bloccato.".into());
            }
            bytes.extend_from_slice(&chunk);
            progress(bytes.len(), total);
        }
        if bytes.is_empty() || total.is_some_and(|n| n != bytes.len() as u64) {
            return Err("Download incompleto: nessun aggiornamento installato.".into());
        }
        return Ok(Some(bytes));
    }
    Err("Troppi reindirizzamenti nel canale aggiornamenti.".into())
}

/// Accept either a static Tauri manifest or the public Forgejo latest-release API.
pub fn manifest_asset(
    value: &serde_json::Value,
    endpoint: &Url,
) -> AppResult<Option<(Url, String)>> {
    if value.get("platforms").is_some() {
        return Ok(None);
    }
    if value["draft"].as_bool() != Some(false) || value["prerelease"].as_bool() != Some(false) {
        return Err("Il canale non contiene una release pubblicata stabile.".into());
    }
    let tag = value["tag_name"]
        .as_str()
        .filter(|s| !s.is_empty() && s.len() < 100)
        .ok_or("Versione release Forgegit non valida.")?;
    let matches = value["assets"]
        .as_array()
        .ok_or("Allegati release assenti.")?
        .iter()
        .filter(|a| a["name"] == "latest.json")
        .collect::<Vec<_>>();
    if matches.len() != 1 {
        return Err("La release deve contenere un solo allegato pubblico latest.json.".into());
    }
    let download = url(matches[0]["browser_download_url"]
        .as_str()
        .ok_or("Indirizzo manifesto assente.")?)?;
    artifact(endpoint, &download)?;
    Ok(Some((download, tag.into())))
}
