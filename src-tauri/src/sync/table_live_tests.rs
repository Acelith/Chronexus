//! Three independent player clients against the real server, with synthetic data only.
use super::{
    api::{self, tables::validate_board},
    server_url,
};
use serde_json::{json, Value};
use std::{
    process::{Child, Command, Stdio},
    time::Duration,
};
use tokio_util::sync::CancellationToken;
struct Server {
    child: Child,
    _dir: tempfile::TempDir,
    base: String,
    bin: std::path::PathBuf,
    path: std::path::PathBuf,
}
impl Drop for Server {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}
impl Server {
    async fn start() -> Self {
        let bin = std::env::var_os("CHRONEXUS_SERVER_BIN")
            .map(std::path::PathBuf::from)
            .unwrap_or_else(|| {
                std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
                    .join("../../Chronexus-Server/target/debug")
                    .join(if cfg!(windows) {
                        "chronexus-server.exe"
                    } else {
                        "chronexus-server"
                    })
            });
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("table.sqlite3");
        let probe = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let port = probe.local_addr().unwrap().port();
        drop(probe);
        let base = format!("http://127.0.0.1:{port}");
        let child = Command::new(&bin)
            .arg("serve")
            .env("CHRONEXUS_LISTEN", format!("127.0.0.1:{port}"))
            .env("CHRONEXUS_PUBLIC_ORIGIN", &base)
            .env("CHRONEXUS_ALLOW_LOOPBACK_HTTP", "true")
            .env("CHRONEXUS_DATABASE", &path)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .expect("build Chronexus-Server and set CHRONEXUS_SERVER_BIN");
        let this = Self {
            child,
            _dir: dir,
            base,
            bin,
            path,
        };
        for _ in 0..100 {
            if reqwest::get(format!("{}/health/ready", this.base))
                .await
                .is_ok()
            {
                return this;
            }
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
        panic!("Synthetic server did not start");
    }
    fn gm_invite(&self) -> String {
        let output = Command::new(&self.bin)
            .args(["invite", "--gm"])
            .env("CHRONEXUS_DATABASE", &self.path)
            .output()
            .unwrap();
        assert!(output.status.success());
        String::from_utf8(output.stdout).unwrap().trim().to_owned()
    }
    fn client(&self, token: Option<String>) -> api::Client {
        api::Client::new(server_url(&self.base, true).unwrap(), token, true).unwrap()
    }
}
async fn operation(client: &api::Client, table: &str, command: Value) -> Value {
    let board = client.table_board(table).await.unwrap();
    client.table_operation(table,json!({"operationId":uuid::Uuid::now_v7().to_string(),"baseRevision":board["revision"],"command":command})).await.unwrap()
}
#[tokio::test]
#[ignore = "needs the real Chronexus-Server binary (CHRONEXUS_SERVER_BIN)"]
async fn three_players_reconnect_move_and_receive_filtered_combat_and_fog() {
    let server = Server::start().await;
    let gm = server
        .client(None)
        .redeem(
            &server.gm_invite(),
            "table-gm",
            "Synthetic GM",
            "synthetic-password-123",
            "test",
        )
        .await
        .unwrap();
    let gm_client = server.client(Some(gm.token.clone()));
    let table: Value = reqwest::Client::new()
        .post(format!("{}/api/v1/tables", server.base))
        .bearer_auth(&gm.token)
        .json(&json!({"name":"Synthetic integration"}))
        .send()
        .await
        .unwrap()
        .json()
        .await
        .unwrap();
    let id = table["id"].as_str().unwrap();
    let mut players = Vec::new();
    for n in 0..3 {
        let invite = gm_client
            .table_call(
                reqwest::Method::POST,
                id,
                "/invites",
                Some(json!({"role":"player"})),
            )
            .await
            .unwrap();
        let signed = server
            .client(None)
            .redeem(
                invite["code"].as_str().unwrap(),
                &format!("player-{n}"),
                &format!("Synthetic {n}"),
                "synthetic-password-123",
                "test",
            )
            .await
            .unwrap();
        let client = server.client(Some(signed.token.clone()));
        assert_eq!(client.tables().await.unwrap().len(), 1);
        players.push((signed, client));
    }
    let scene = uuid::Uuid::new_v4().to_string();
    operation(&gm_client,id,json!({"type":"saveScene","scene":{"id":scene,"name":"Synthetic room","width":1000,"height":700,"mapId":null,"grid":{"kind":"square","pixels":50,"offset":{"x":0,"y":0},"color":"#cab582","opacity":0.4,"distance":{"value":5,"unit":"ft"},"diagonal":"equal","conversion":"table"},"freeMove":true,"difficult":[]}})).await;
    operation(
        &gm_client,
        id,
        json!({"type":"activateScene","sceneId":scene}),
    )
    .await;
    let mut tokens = Vec::new();
    for (n, (player, _)) in players.iter().enumerate() {
        let token = uuid::Uuid::new_v4().to_string();
        operation(&gm_client,id,json!({"type":"saveToken","token":{"id":token,"sceneId":scene,"ownerId":player.account_id,"name":format!("Hero {n}"),"position":{"x":1+n,"y":1},"size":1,"speed":{"value":30,"unit":"ft"},"hidden":false,"portraitId":null,"characterId":null,"spent":0,"diagonals":0}})).await;
        tokens.push(token);
    }
    let mut channels = Vec::new();
    for (player, _) in &players {
        let client = server.client(Some(player.token.clone()));
        let table = id.to_owned();
        let cancel = CancellationToken::new();
        let cancelled = cancel.clone();
        let (out, mut incoming) = tokio::sync::mpsc::channel(4);
        let (frames, receive) = tokio::sync::mpsc::unbounded_channel();
        let task = tokio::spawn(async move {
            client
                .table_stream(
                    &table,
                    move |frame| frames.send(frame).is_ok(),
                    cancelled,
                    &mut incoming,
                )
                .await
        });
        channels.push((cancel, out, receive, task));
    }
    for (_, _, frames, _) in &mut channels {
        let frame = tokio::time::timeout(Duration::from_secs(5), frames.recv())
            .await
            .unwrap()
            .unwrap();
        assert_eq!(frame["type"], "state");
        assert_eq!(frame["board"]["tokens"].as_array().unwrap().len(), 3);
    }
    // Pings and server-rolled chat dice use the same desktop stream; a secret roll
    // reaches its author (and the GM) only.
    channels[0]
        .1
        .send(json!({"type":"ping","sceneId":scene,"x":10.0,"y":10.0}))
        .await
        .unwrap();
    let base = gm_client.table_board(id).await.unwrap()["revision"].clone();
    channels[0].1.send(json!({"operationId":uuid::Uuid::now_v7().to_string(),"baseRevision":base,"audience":"public","text":"/gr 2d20kh1+3"})).await.unwrap();
    let rolled = base.as_i64().unwrap() + 1;
    for (n, (_, _, frames, _)) in channels.iter_mut().enumerate() {
        let (mut pinged, mut committed, mut saw_roll) = (false, false, false);
        while !(pinged && committed) {
            let frame = tokio::time::timeout(Duration::from_secs(5), frames.recv())
                .await
                .unwrap()
                .unwrap();
            if frame["type"] == "ping" {
                assert_eq!(frame["authorId"], players[0].0.account_id);
                pinged = true;
            }
            if frame["type"] == "state" && frame["revision"].as_i64() >= Some(rolled) {
                committed = true;
                saw_roll |= frame["events"].as_array().unwrap().iter().any(|e| {
                    e["roll"]["total"]
                        .as_i64()
                        .is_some_and(|t| (4..=23).contains(&t))
                });
            }
        }
        assert_eq!(saw_roll, n == 0, "secret roll visible only to its author");
    }
    operation(
        &players[0].1,
        id,
        json!({"type":"move","tokenId":tokens[0],"path":[{"x":2,"y":1}]}),
    )
    .await;
    assert!(players[1].1.table_operation(id,json!({"operationId":uuid::Uuid::now_v7().to_string(),"baseRevision":gm_client.table_board(id).await.unwrap()["revision"],"command":{"type":"move","tokenId":tokens[0],"path":[{"x":3,"y":1}]}})).await.is_err());
    operation(
        &gm_client,
        id,
        json!({"type":"combat","action":{"type":"start","sceneId":scene,"tokenIds":tokens}}),
    )
    .await;
    for (n, (_, client)) in players.iter().enumerate() {
        operation(client,id,json!({"type":"combat","action":{"type":"initiative","tokenId":tokens[n],"value":20-n,"roll":false,"secret":false}})).await;
    }
    operation(
        &gm_client,
        id,
        json!({"type":"combat","action":{"type":"order","tokenIds":tokens}}),
    )
    .await;
    for _ in 0..9 {
        operation(
            &gm_client,
            id,
            json!({"type":"combat","action":{"type":"next"}}),
        )
        .await;
    }
    assert!(
        gm_client.table_board(id).await.unwrap()["combat"]["round"]
            .as_u64()
            .unwrap()
            >= 3
    );
    let ack = operation(
        &gm_client,
        id,
        json!({"type":"saveFog","fog":{"sceneId":scene,"enabled":true,"strokes":[]}}),
    )
    .await;
    for (_, _, frames, _) in &mut channels {
        loop {
            let frame = tokio::time::timeout(Duration::from_secs(5), frames.recv())
                .await
                .unwrap()
                .unwrap();
            assert!(!frame.to_string().contains("gmNote"));
            if frame["type"] == "state" && frame["revision"] == ack["revision"] {
                let view = validate_board(frame["board"].clone()).unwrap();
                assert!(view["tokens"].as_array().unwrap().is_empty());
                assert!(view.get("fogEditor").is_none());
                break;
            }
        }
    }
    for (cancel, _, _, _) in &channels {
        cancel.cancel();
    }
    for (_, _, _, task) in channels {
        assert!(tokio::time::timeout(Duration::from_secs(2), task)
            .await
            .unwrap()
            .unwrap()
            .is_ok());
    }
    // Fresh one-use ticket after reconnect, using the current filtered snapshot.
    let client = server.client(Some(players[0].0.token.clone()));
    let cancel = CancellationToken::new();
    let other = cancel.clone();
    let (_out, mut incoming) = tokio::sync::mpsc::channel(1);
    let table = id.to_owned();
    let (frames, mut receiver) = tokio::sync::mpsc::unbounded_channel();
    let task = tokio::spawn(async move {
        client
            .table_stream(
                &table,
                move |frame| frames.send(frame).is_ok(),
                other,
                &mut incoming,
            )
            .await
    });
    let frame = tokio::time::timeout(Duration::from_secs(5), receiver.recv())
        .await
        .unwrap()
        .unwrap();
    assert!(frame["board"]["tokens"].as_array().unwrap().is_empty());
    cancel.cancel();
    assert!(task.await.unwrap().is_ok());
}
