use crate::journal::AppResult;
use reqwest::{Client, Response};
use serde::Serialize;
use serde_json::{json, Value};
use std::time::Duration;
pub const BASE: &str = "http://127.0.0.1:11434";
pub const DND_WEIGHT: &str = "3cc578dabc0e30a8e7d51d2b27d5e46f5abd118e16fe0e67123ea064fe17b77e";
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Model {
    pub name: String,
    pub digest: String,
    pub quantization: String,
    pub weight_digest: Option<String>,
    pub dnd_specialized: bool,
    pub resident_bytes: u64,
    pub gpu_bytes: u64,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Runtime {
    pub version: String,
    pub cloud_disabled: bool,
    pub models: Vec<Model>,
}
pub fn client() -> AppResult<Client> {
    Client::builder()
        .no_proxy()
        .redirect(reqwest::redirect::Policy::none())
        .connect_timeout(Duration::from_secs(2))
        .timeout(Duration::from_secs(120))
        .pool_max_idle_per_host(0)
        .build()
        .map_err(|_| "Cannot prepare the local AI connection.".into())
}
pub async fn json_response(mut response: Response) -> AppResult<Value> {
    if !response.status().is_success() {
        return Err(format!(
            "Local AI runtime: response {}. Check model and configuration.",
            response.status().as_u16()
        ));
    }
    let mut data = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| "Local AI connection interrupted.")?
    {
        if data.len() + chunk.len() > 1_048_576 {
            return Err("AI runtime response over the limit.".into());
        }
        data.extend_from_slice(&chunk)
    }
    serde_json::from_slice(&data).map_err(|_| "Invalid AI runtime response.".into())
}
pub async fn get(client: &Client, base: &str, path: &str) -> AppResult<Value> {
    json_response(
        client
            .get(format!("{base}{path}"))
            .send()
            .await
            .map_err(|_| {
                "Ollama not available on this computer. Start it in local mode without cloud."
            })?,
    )
    .await
}
pub async fn post(client: &Client, base: &str, path: &str, payload: Value) -> AppResult<Value> {
    json_response(
        client
            .post(format!("{base}{path}"))
            .json(&payload)
            .send()
            .await
            .map_err(|_| "Request to the local AI runtime failed.")?,
    )
    .await
}
pub fn check_cloud(status: &Value) -> AppResult<()> {
    if status.pointer("/cloud/disabled").and_then(Value::as_bool) != Some(true) {
        return Err("The runtime does not confirm that the cloud is disabled. Set OLLAMA_NO_CLOUD=1 and restart Ollama; no notes were sent.".into());
    }
    Ok(())
}
pub fn check_model_name(name: &str) -> AppResult<()> {
    if name.is_empty()
        || name.len() > 160
        || !name
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || b"-_.:/".contains(&c))
        || name.contains("..")
        || name.contains("cloud")
        || name.contains("/")
    {
        return Err("Choose an installed local model, without cloud references or URLs.".into());
    }
    Ok(())
}
pub fn check_local(show: &Value) -> AppResult<()> {
    for key in ["remote_host", "remote_model"] {
        if show
            .get(key)
            .is_some_and(|v| !v.is_null() && v.as_str() != Some(""))
        {
            return Err(
                "This model forwards requests to a remote service and cannot be used.".into(),
            );
        }
    }
    if show.pointer("/details/format").and_then(Value::as_str) != Some("gguf") {
        return Err("This version needs a verifiable local GGUF model.".into());
    }
    Ok(())
}
pub fn weight_digest(show: &Value) -> Option<String> {
    show["modelfile"]
        .as_str()?
        .lines()
        .find(|line| line.starts_with("FROM "))
        .and_then(|line| line.rsplit("sha256-").next())
        .map(|s| s.trim_matches(['\"', ' ', '\r']).to_string())
        .filter(|s| s.len() == 64 && s.bytes().all(|c| c.is_ascii_hexdigit()))
}
pub async fn probe_at(client: &Client, base: &str) -> AppResult<Runtime> {
    check_cloud(&get(client, base, "/api/status").await?)?;
    let version = get(client, base, "/api/version").await?["version"]
        .as_str()
        .ok_or("Runtime version missing.")?
        .to_string();
    let tags = get(client, base, "/api/tags").await?;
    let rows = tags["models"].as_array().ok_or("Invalid model list.")?;
    if rows.len() > 100 {
        return Err("Too many models in the runtime; this version supports up to 100.".into());
    }
    let resident = get(client, base, "/api/ps").await?;
    let mut models = Vec::new();
    for row in rows {
        let name = row["name"].as_str().ok_or("Model name missing.")?;
        if check_model_name(name).is_err() {
            continue;
        }
        let show = post(client, base, "/api/show", json!({"model":name})).await?;
        if check_local(&show).is_err() {
            continue;
        }
        let digest = row["digest"]
            .as_str()
            .ok_or("Model identity missing.")?
            .to_string();
        if digest.len() != 64 || !digest.bytes().all(|b| b.is_ascii_hexdigit()) {
            continue;
        }
        let weight = weight_digest(&show);
        if !super::models::allowed(name, weight.as_deref()) && weight.as_deref() != Some(DND_WEIGHT)
        {
            continue;
        }
        let loaded = resident["models"]
            .as_array()
            .and_then(|m| m.iter().find(|r| r["digest"].as_str() == Some(&digest)));
        models.push(Model {
            name: name.into(),
            digest,
            quantization: show["details"]["quantization_level"]
                .as_str()
                .unwrap_or("not given")
                .into(),
            dnd_specialized: weight.as_deref() == Some(DND_WEIGHT),
            weight_digest: weight,
            resident_bytes: loaded.and_then(|v| v["size"].as_u64()).unwrap_or(0),
            gpu_bytes: loaded.and_then(|v| v["size_vram"].as_u64()).unwrap_or(0),
        });
    }
    Ok(Runtime {
        version,
        cloud_disabled: true,
        models,
    })
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn privacy_checks_fail_closed() {
        for s in [json!({}), json!({"cloud":{"disabled":false}})] {
            assert!(check_cloud(&s).is_err())
        }
        assert!(check_cloud(&json!({"cloud":{"disabled":true}})).is_ok());
        for n in [
            "http://evil/llm",
            "qwen:cloud",
            "../model",
            "cloud:model",
            "user/model",
        ] {
            assert!(check_model_name(n).is_err())
        }
        assert!(check_model_name("chronexus-dnd-unified:1.5b-q4km").is_ok());
        assert!(check_local(
            &json!({"details":{"format":"gguf"},"remote_host":"https://ollama.com"})
        )
        .is_err());
        assert!(check_local(&json!({"details":{"format":"gguf"}})).is_ok());
    }
    fn server(status: u16, body: String, extra: &str) -> (String, std::thread::JoinHandle<String>) {
        use std::{
            io::{Read, Write},
            net::TcpListener,
        };
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = format!("http://{}", listener.local_addr().unwrap());
        let extra = extra.to_string();
        let thread = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            stream
                .set_read_timeout(Some(Duration::from_secs(3)))
                .unwrap();
            let mut buf = [0u8; 8192];
            let count = stream.read(&mut buf).unwrap();
            let request = String::from_utf8_lossy(&buf[..count]).to_string();
            let header=format!("HTTP/1.1 {status} Test\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n{extra}\r\n",body.len());
            let _ = stream.write_all(header.as_bytes());
            let _ = stream.write_all(body.as_bytes());
            request
        });
        (address, thread)
    }
    #[tokio::test]
    async fn cloud_unconfirmed_stops_probe_before_any_model_or_context_request() {
        let (base, server) = server(200, "{\"cloud\":{\"disabled\":false}}".into(), "");
        assert!(probe_at(&client().unwrap(), &base)
            .await
            .unwrap_err()
            .contains("cloud"));
        let request = server.join().unwrap();
        assert!(request.starts_with("GET /api/status "));
        assert!(!request.contains("sources"));
    }
    #[tokio::test]
    async fn redirects_invalid_json_oversized_responses_and_runtime_errors_are_rejected() {
        for (status, body, headers) in [
            (302, "{}".into(), "Location: https://example.com/\r\n"),
            (200, "not json".into(), ""),
            (200, "x".repeat(1_048_577), ""),
            (500, "{\"error\":\"out of memory\"}".into(), ""),
        ] {
            let (base, server) = server(status, body, headers);
            assert!(get(&client().unwrap(), &base, "/api/status").await.is_err());
            server.join().unwrap();
        }
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let base = format!("http://{}", listener.local_addr().unwrap());
        drop(listener);
        assert!(get(&client().unwrap(), &base, "/api/status")
            .await
            .unwrap_err()
            .contains("not available"));
    }
}
