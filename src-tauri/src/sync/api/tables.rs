//! Fixed table routes. Table state is transient and never enters the journal Store.
use super::{read_capped, remote_id, ApiResult, Client, Failure};
use reqwest::Method;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Serialize)]
pub struct TableError {
    pub status: u16,
}
impl From<String> for TableError {
    fn from(_: String) -> Self {
        Self { status: 401 }
    }
}
impl From<Failure> for TableError {
    fn from(f: Failure) -> Self {
        Self {
            status: match f {
                Failure::Unauthorized(_) => 401,
                Failure::AccessLost(_) => 403,
                Failure::Unavailable(_) => 503,
                _ => 400,
            },
        }
    }
}
impl Client {
    pub async fn upload_table_portrait(
        &self,
        table: &str,
        bytes: Vec<u8>,
        mime: &str,
    ) -> Result<String, TableError> {
        let value = self
            .upload_table_image(table, "portraits", bytes, mime, 8 * 1024 * 1024)
            .await?;
        Ok(value["id"].as_str().unwrap_or_default().into())
    }
    /// GM map or library image: the server validates and stores the original bytes.
    pub async fn upload_table_map(
        &self,
        table: &str,
        bytes: Vec<u8>,
        mime: &str,
    ) -> Result<Value, TableError> {
        let value = self
            .upload_table_image(table, "maps", bytes, mime, 32 * 1024 * 1024)
            .await?;
        for key in ["width", "height"] {
            if value[key].as_u64().is_none_or(|n| n == 0 || n > 16384) {
                return Err(TableError { status: 400 });
            }
        }
        Ok(value)
    }
    async fn upload_table_image(
        &self,
        table: &str,
        route: &str,
        bytes: Vec<u8>,
        mime: &str,
        limit: usize,
    ) -> Result<Value, TableError> {
        remote_id(table).map_err(TableError::from)?;
        if bytes.is_empty()
            || bytes.len() > limit
            || !["image/png", "image/jpeg", "image/webp"].contains(&mime)
        {
            return Err(TableError { status: 400 });
        }
        let mut request = self
            .http
            .post(
                self.url(&format!("/api/v1/tables/{table}/{route}"))
                    .map_err(TableError::from)?,
            )
            .header("content-type", mime)
            .body(bytes);
        if let Some(token) = &self.token {
            request = request.bearer_auth(token);
        }
        let mut response = request
            .send()
            .await
            .map_err(|_| TableError { status: 503 })?;
        let status = response.status().as_u16();
        if status != 200 {
            return Err(TableError { status });
        }
        let out = read_capped(&mut response, 4096).await?;
        let value: Value = serde_json::from_slice(&out).map_err(|_| TableError { status: 400 })?;
        let id = value["id"].as_str().ok_or(TableError { status: 400 })?;
        remote_id(id).map_err(TableError::from)?;
        Ok(value)
    }
    pub async fn table_call(
        &self,
        method: Method,
        table: &str,
        suffix: &str,
        body: Option<Value>,
    ) -> Result<Value, TableError> {
        remote_id(table).map_err(TableError::from)?;
        let path = format!("/api/v1/tables/{table}{suffix}");
        let (status, value) = self
            .send(
                method,
                self.url(&path).map_err(TableError::from)?,
                body,
                None,
            )
            .await
            .map_err(TableError::from)?;
        if !(200..300).contains(&status) {
            return Err(TableError { status });
        }
        Ok(value)
    }
    pub async fn table_image(
        &self,
        table: &str,
        id: &str,
        map: bool,
    ) -> Result<String, TableError> {
        use base64::{engine::general_purpose::STANDARD, Engine};
        remote_id(table).map_err(TableError::from)?;
        remote_id(id).map_err(TableError::from)?;
        let mut request = self.http.get(
            self.url(&format!("/api/v1/tables/{table}/maps/{id}"))
                .map_err(TableError::from)?,
        );
        if let Some(token) = &self.token {
            request = request.bearer_auth(token);
        }
        let mut response = request
            .send()
            .await
            .map_err(|_| TableError { status: 503 })?;
        let status = response.status().as_u16();
        if status != 200 {
            return Err(TableError { status });
        }
        let mime = response
            .headers()
            .get("content-type")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("")
            .to_owned();
        if !["image/png", "image/jpeg", "image/webp"].contains(&mime.as_str()) {
            return Err(TableError { status: 400 });
        }
        let bytes = read_capped(&mut response, 32 * 1024 * 1024).await?;
        tokio::task::spawn_blocking(move || {
            use image::ImageDecoder;
            let mut reader = image::ImageReader::new(std::io::Cursor::new(&bytes))
                .with_guessed_format()
                .map_err(|_| TableError { status: 400 })?;
            let expected = match reader.format() {
                Some(image::ImageFormat::Png) => "image/png",
                Some(image::ImageFormat::Jpeg) => "image/jpeg",
                Some(image::ImageFormat::WebP) => "image/webp",
                _ => return Err(TableError { status: 400 }),
            };
            if expected != mime {
                return Err(TableError { status: 400 });
            }
            let mut limits = image::Limits::default();
            limits.max_image_width = Some(16384);
            limits.max_image_height = Some(16384);
            limits.max_alloc = Some(256 * 1024 * 1024);
            reader.limits(limits);
            let decoder = reader
                .into_decoder()
                .map_err(|_| TableError { status: 400 })?;
            let (w, h) = decoder.dimensions();
            if u64::from(w) * u64::from(h) > 64_000_000 {
                return Err(TableError { status: 400 });
            }
            let size = if map { 2048 } else { 256 };
            let image = image::DynamicImage::from_decoder(decoder)
                .map_err(|_| TableError { status: 400 })?
                .thumbnail(size, size);
            let mut out = std::io::Cursor::new(Vec::new());
            image
                .write_to(&mut out, image::ImageFormat::Png)
                .map_err(|_| TableError { status: 400 })?;
            Ok(format!(
                "data:image/png;base64,{}",
                STANDARD.encode(out.into_inner())
            ))
        })
        .await
        .map_err(|_| TableError { status: 400 })?
    }
    pub async fn table_stream(
        &self,
        table: &str,
        gm: bool,
        mut frame: impl FnMut(Value) -> bool,
        cancel: tokio_util::sync::CancellationToken,
        outgoing: &mut tokio::sync::mpsc::Receiver<Value>,
    ) -> ApiResult<()> {
        use futures_util::{SinkExt, StreamExt};
        #[derive(Deserialize)]
        struct Ticket {
            ticket: String,
        }
        remote_id(table)?;
        let ticket: Ticket = self
            .call(
                Method::POST,
                &format!("/api/v1/tables/{table}/live-ticket"),
                None,
            )
            .await?;
        if ticket.ticket.len() != 64 || !ticket.ticket.bytes().all(|b| b.is_ascii_hexdigit()) {
            return Err(Failure::Rejected("Invalid table ticket.".into()));
        }
        let mut url = self.url(&format!("/api/v1/tables/{table}/live"))?;
        let scheme = if url.scheme() == "https" { "wss" } else { "ws" };
        url.set_scheme(scheme)
            .map_err(|_| Failure::Rejected("Invalid table address.".into()))?;
        url.query_pairs_mut().append_pair("ticket", &ticket.ticket);
        let config = tokio_tungstenite::tungstenite::protocol::WebSocketConfig::default()
            .max_message_size(Some(8 * 1024 * 1024))
            .max_frame_size(Some(8 * 1024 * 1024));
        let connector = if url.scheme() == "wss" {
            Some(table_tls()?)
        } else {
            None
        };
        let (mut socket, _) = tokio::time::timeout(
            std::time::Duration::from_secs(15),
            tokio_tungstenite::connect_async_tls_with_config(
                url.as_str(),
                Some(config),
                false,
                connector,
            ),
        )
        .await
        .map_err(|_| Failure::Unavailable("Table connection unavailable.".into()))?
        .map_err(|_| Failure::Unavailable("Table connection unavailable.".into()))?;
        loop {
            tokio::select! {
                _=cancel.cancelled()=>return Ok(()),
                _=tokio::time::sleep(std::time::Duration::from_secs(45))=>return Err(Failure::Unavailable("Table connection interrupted.".into())),
                outgoing=outgoing.recv()=>{
                    if let Some(value)=outgoing{socket.send(tokio_tungstenite::tungstenite::Message::Text(value.to_string().into())).await.map_err(|_|Failure::Unavailable("Table connection interrupted.".into()))?;}else{return Ok(());}
                }
                message=socket.next()=>{
                    let Some(Ok(message))=message else{return Err(Failure::Unavailable("Table connection interrupted.".into()));};
                    if message.is_close(){return Err(Failure::Unavailable("Table connection interrupted.".into()));}
                    if message.is_text(){let text=message.to_text().map_err(|_|Failure::Rejected("Invalid table frame.".into()))?;let mut value:Value=serde_json::from_str(text).map_err(|_|Failure::Rejected("Invalid table frame.".into()))?;
                    if value["type"]=="state"{
                        if value["events"].as_array().is_none_or(|a|a.len()>1000||a.iter().any(|e|e["text"].as_str().is_none_or(|s|s.chars().count()>2000))){return Err(Failure::Rejected("Invalid table frame.".into()));}
                        value["board"]=validate_board(value["board"].take(),gm).map_err(|_|Failure::Rejected("Invalid table frame.".into()))?;
                    }
                        if !frame(value){return Ok(());}
                    }
                }
            }
        }
    }
    pub async fn table_operation(
        &self,
        table: &str,
        operation: Value,
    ) -> Result<Value, TableError> {
        self.table_call(Method::POST, table, "/board/operations", Some(operation))
            .await
    }
}
fn table_tls() -> ApiResult<tokio_tungstenite::Connector> {
    let mut roots = rustls::RootCertStore::empty();
    for certificate in rustls_native_certs::load_native_certs().certs {
        let _ = roots.add(certificate);
    }
    #[cfg(debug_assertions)]
    if let Some(path) = std::env::var_os("NODEX_DEV_SYNC_ROOT_CA") {
        use rustls::pki_types::pem::PemObject;
        if let Ok(bytes) = std::fs::read(path) {
            if bytes.len() <= 1024 * 1024 {
                for cert in rustls::pki_types::CertificateDer::pem_slice_iter(&bytes).flatten() {
                    let _ = roots.add(cert);
                }
            }
        }
    }
    let config = rustls::ClientConfig::builder_with_provider(std::sync::Arc::new(
        rustls::crypto::aws_lc_rs::default_provider(),
    ))
    .with_safe_default_protocol_versions()
    .map_err(|_| Failure::Rejected("Table TLS unavailable.".into()))?
    .with_root_certificates(roots)
    .with_no_client_auth();
    Ok(tokio_tungstenite::Connector::Rustls(std::sync::Arc::new(
        config,
    )))
}

/// Bounds a received board. GM preparation data (monster and encounter library, images,
/// fog editor) is kept only for a table where the server reported this account as GM; it
/// stays in memory for the open table and is never stored on the device.
pub fn validate_board(mut value: Value, gm: bool) -> Result<Value, TableError> {
    let invalid = || TableError { status: 400 };
    let scenes = value["scenes"].as_array().ok_or_else(invalid)?;
    if scenes.len() > 50 || value["revision"].as_i64().is_none_or(|n| n < 1) {
        return Err(invalid());
    }
    for s in scenes {
        for key in ["width", "height"] {
            if s[key].as_u64().is_none_or(|n| n == 0 || n > 16384) {
                return Err(invalid());
            }
        }
        let g = &s["grid"];
        if g["pixels"]
            .as_f64()
            .is_none_or(|n| !(8.0..=1024.0).contains(&n))
            || !["square", "hexFlat", "hexPointy", "none"]
                .contains(&g["kind"].as_str().unwrap_or(""))
            || g["distance"]["value"]
                .as_f64()
                .is_none_or(|n| !(0.01..=10000.0).contains(&n))
        {
            return Err(invalid());
        }
        if s["difficult"].as_array().is_none_or(|a| a.len() > 10000) {
            return Err(invalid());
        }
    }
    for (key, max) in [
        ("tokens", 1000),
        ("templates", 100),
        ("fog", 50),
        ("vitals", 1000),
        ("combatLog", 200),
    ] {
        if value[key].as_array().is_none_or(|a| a.len() > max) {
            return Err(invalid());
        }
    }
    for f in value["fog"].as_array().ok_or_else(invalid)? {
        let cols = f["columns"].as_u64().ok_or_else(invalid)?;
        let rows = f["rows"].as_u64().ok_or_else(invalid)?;
        if cols == 0
            || cols > 64
            || rows == 0
            || rows > 64
            || f["visible"].as_array().is_none_or(|a| {
                a.len() > 4096
                    || a.iter()
                        .any(|n| n.as_u64().is_none_or(|n| n >= cols * rows))
            })
        {
            return Err(invalid());
        }
    }
    let gm_lists = [
        ("fogEditor", 50),
        ("monsters", 200),
        ("encounters", 200),
        ("assets", 200),
    ];
    for (key, max) in gm_lists {
        let keep = gm
            && value
                .get(key)
                .is_some_and(|v| v.as_array().is_some_and(|a| a.len() <= max));
        if !keep {
            value.as_object_mut().ok_or_else(invalid)?.remove(key);
        }
    }
    value
        .as_object_mut()
        .ok_or_else(invalid)?
        .remove("geometry");
    Ok(value)
}

/// Board commands a GM may send from the desktop; the server re-checks the role of every one.
const GM_COMMANDS: [&str; 16] = [
    "importVision",
    "saveAsset",
    "saveMonster",
    "saveEncounter",
    "removeLibrary",
    "deployEncounter",
    "placeMonster",
    "saveFog",
    "saveScene",
    "importScene",
    "activateScene",
    "saveToken",
    "removeToken",
    "move",
    "saveTemplate",
    "removeTemplate",
];
const GM_COMBAT: [&str; 12] = [
    "start",
    "end",
    "initiative",
    "order",
    "next",
    "delay",
    "add",
    "remove",
    "setVitals",
    "setCondition",
    "removeCondition",
    "roll",
];

pub fn validate_operation(op: &Value, gm: bool) -> Result<(), TableError> {
    let invalid = || TableError { status: 400 };
    let id = op["operationId"].as_str().ok_or_else(invalid)?;
    if uuid::Uuid::parse_str(id).map_or(true, |u| u.get_version_num() != 7)
        || op["baseRevision"].as_i64().is_none_or(|r| r < 1)
        || op.to_string().len() > 256 * 1024
    {
        return Err(invalid());
    }
    let kind = op["command"]["type"].as_str().ok_or_else(invalid)?;
    if gm {
        let combat = op["command"]["action"]["type"].as_str().unwrap_or("");
        return if GM_COMMANDS.contains(&kind) || (kind == "combat" && GM_COMBAT.contains(&combat)) {
            Ok(())
        } else {
            Err(invalid())
        };
    }
    if !["move", "saveTemplate", "removeTemplate", "combat"].contains(&kind) {
        return Err(invalid());
    }
    if kind == "combat" {
        let action = op["command"]["action"]["type"]
            .as_str()
            .ok_or_else(invalid)?;
        if ![
            "initiative",
            "setVitals",
            "setCondition",
            "removeCondition",
            "roll",
        ]
        .contains(&action)
        {
            return Err(invalid());
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn desktop_commands_cannot_edit_gm_state_or_upload_arbitrary_payloads() {
        let mut op = json!({"operationId":uuid::Uuid::now_v7().to_string(),"baseRevision":1,"command":{"type":"move","tokenId":uuid::Uuid::new_v4().to_string(),"path":[{"x":1,"y":1}]}});
        assert!(validate_operation(&op, false).is_ok());
        for kind in [
            "saveScene",
            "saveToken",
            "saveFog",
            "saveMonster",
            "deployEncounter",
            "projectToken",
        ] {
            op["command"]["type"] = json!(kind);
            assert!(validate_operation(&op, false).is_err());
        }
        op["command"] = json!({"type":"combat","action":{"type":"next"}});
        assert!(validate_operation(&op, false).is_err());
        op["command"]["action"]["type"] = json!("setVitals");
        assert!(validate_operation(&op, false).is_ok());
        op["baseRevision"] = json!(-1);
        assert!(validate_operation(&op, false).is_err());
    }
    #[test]
    fn transient_view_discards_gm_libraries_and_rejects_unbounded_masks() {
        let mut b = json!({"revision":1,"scenes":[],"tokens":[],"templates":[],"fog":[],"vitals":[],"combatLog":[],"monsters":["SECRET"],"geometry":"SECRET","fogEditor":"SECRET"});
        assert!(!validate_board(b.clone(), false)
            .unwrap()
            .to_string()
            .contains("SECRET"));
        b["fog"] = json!([{"columns":0,"rows":32,"visible":[]}]);
        assert!(validate_board(b, false).is_err());
    }
    #[test]
    fn gm_view_keeps_bounded_preparation_data_and_drops_vision_geometry() {
        let mut b = json!({"revision":1,"scenes":[],"tokens":[],"templates":[],"fog":[],"vitals":[],"combatLog":[],"monsters":[{"name":"Synthetic"}],"encounters":[],"assets":[],"fogEditor":[],"geometry":"SECRET"});
        let kept = validate_board(b.clone(), true).unwrap();
        assert_eq!(kept["monsters"][0]["name"], "Synthetic");
        assert!(kept.get("assets").is_some() && kept.get("fogEditor").is_some());
        assert!(kept.get("geometry").is_none());
        b["monsters"] = json!(vec![json!({}); 201]);
        b["assets"] = json!("not a list");
        let bounded = validate_board(b, true).unwrap();
        assert!(bounded.get("monsters").is_none() && bounded.get("assets").is_none());
    }
    #[test]
    fn gm_commands_need_the_server_reported_gm_role() {
        let mut op = json!({"operationId":uuid::Uuid::now_v7().to_string(),"baseRevision":1,"command":{"type":"placeMonster","sceneId":"s","spawn":{}}});
        assert!(validate_operation(&op, false).is_err());
        assert!(validate_operation(&op, true).is_ok());
        for kind in ["saveScene", "activateScene", "saveAsset", "deployEncounter"] {
            op["command"]["type"] = json!(kind);
            assert!(validate_operation(&op, true).is_ok(), "{kind}");
        }
        for kind in ["projectToken", "dropDatabase"] {
            op["command"]["type"] = json!(kind);
            assert!(validate_operation(&op, true).is_err(), "{kind}");
        }
        op["command"] = json!({"type":"combat","action":{"type":"next"}});
        assert!(validate_operation(&op, true).is_ok());
        op["command"]["action"]["type"] = json!("rewind");
        assert!(validate_operation(&op, true).is_err());
        op["operationId"] = json!(uuid::Uuid::new_v4().to_string());
        op["command"]["action"]["type"] = json!("next");
        assert!(validate_operation(&op, true).is_err());
    }
    #[test]
    fn native_tls_configuration_uses_a_verifying_connector() {
        assert!(matches!(
            table_tls().unwrap(),
            tokio_tungstenite::Connector::Rustls(_)
        ));
    }
}
