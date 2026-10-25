// Loopback fakes stand in for GitHub and Ollama: no real download in tests.
use super::{download::Source, *};
use sha2::{Digest, Sha256};
use std::{
    io::{Read, Write},
    net::TcpListener,
};

fn zip_bytes(entries: &[(&str, &[u8])]) -> Vec<u8> {
    let mut buffer = std::io::Cursor::new(Vec::new());
    {
        let mut zip = zip::ZipWriter::new(&mut buffer);
        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);
        for (name, data) in entries {
            zip.start_file(*name, options).unwrap();
            zip.write_all(data).unwrap();
        }
        zip.finish().unwrap();
    }
    buffer.into_inner()
}
/// Serves canned responses in order, one connection each; returns request lines.
fn server(responses: Vec<Vec<u8>>) -> (String, std::thread::JoinHandle<Vec<String>>) {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let base = format!("http://{}", listener.local_addr().unwrap());
    let worker = std::thread::spawn(move || {
        let mut seen = vec![];
        for response in responses {
            let Ok((mut stream, _)) = listener.accept() else {
                break;
            };
            stream
                .set_read_timeout(Some(Duration::from_secs(15)))
                .unwrap();
            let mut head = vec![];
            let mut b = [0];
            while !head.ends_with(b"\r\n\r\n") && stream.read_exact(&mut b).is_ok() {
                head.push(b[0]);
            }
            let head = String::from_utf8_lossy(&head).to_string();
            let length = head
                .lines()
                .find_map(|l| {
                    l.to_lowercase()
                        .strip_prefix("content-length:")
                        .map(|v| v.trim().parse::<usize>().unwrap_or(0))
                })
                .unwrap_or(0);
            let mut body = vec![0; length];
            let _ = stream.read_exact(&mut body);
            seen.push(format!(
                "{} {}",
                head.lines().next().unwrap_or(""),
                String::from_utf8_lossy(&body)
            ));
            let _ = stream.write_all(&response);
        }
        seen
    });
    (base, worker)
}
fn ok(body: &[u8], kind: &str) -> Vec<u8> {
    let mut r = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: {kind}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        body.len()
    )
    .into_bytes();
    r.extend_from_slice(body);
    r
}
fn json_ok(v: serde_json::Value) -> Vec<u8> {
    ok(v.to_string().as_bytes(), "application/json")
}
fn source<'a>(url: &'a str, sha: &'a str, bytes: u64) -> Source<'a> {
    Source {
        url,
        sha256: sha,
        bytes,
        unpacked: 1 << 20,
        loopback_test: true,
    }
}

#[test]
fn only_the_official_url_and_github_asset_hosts_are_followed() {
    let initial = Url::parse(OLLAMA_URL).unwrap();
    for (url, expected) in [
        (OLLAMA_URL, true),
        (
            "https://release-assets.githubusercontent.com/github-production-release-asset/1/2",
            true,
        ),
        ("https://objects.githubusercontent.com/x", true),
        ("http://release-assets.githubusercontent.com/x", false),
        (
            "https://github.com/evil/ollama/releases/download/v0.40.10/ollama-windows-amd64.zip",
            false,
        ),
        ("https://evil.test/ollama.zip", false),
        ("https://user:pw@objects.githubusercontent.com/x", false),
    ] {
        assert_eq!(
            download::allowed(&Url::parse(url).unwrap(), &initial, false),
            expected,
            "{url}"
        );
    }
}
use reqwest::Url;

#[tokio::test]
async fn verified_archive_installs_atomically_and_bad_ones_leave_nothing() {
    let root = tempfile::tempdir().unwrap();
    let archive = zip_bytes(&[
        ("ollama.exe", b"fake runtime"),
        ("lib/ollama/cuda.dll", b"lib"),
    ]);
    let sha = format!("{:x}", Sha256::digest(&archive));
    // Wrong checksum: nothing installed, no partial files left behind.
    let (base, worker) = server(vec![ok(&archive, "application/zip")]);
    let url = format!("{base}/ollama.zip");
    let bad = "0".repeat(64);
    let error = download::install(
        root.path(),
        &source(&url, &bad, archive.len() as u64),
        &CancellationToken::new(),
        |_| {},
    )
    .await
    .unwrap_err();
    assert!(error.contains("digest"), "{error}");
    worker.join().unwrap();
    assert!(!managed_installed(root.path()));
    assert_eq!(fs::read_dir(base_dir(root.path())).unwrap().count(), 0);
    // Redirect to another port (stand-in for a foreign host) is refused.
    let (base, worker) = server(vec![
        b"HTTP/1.1 302 Found\r\nLocation: http://127.0.0.1:9/x.zip\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
            .to_vec(),
    ]);
    let url = format!("{base}/ollama.zip");
    assert!(download::install(
        root.path(),
        &source(&url, &sha, archive.len() as u64),
        &CancellationToken::new(),
        |_| {}
    )
    .await
    .unwrap_err()
    .contains("redirected"));
    worker.join().unwrap();
    // Good archive with an allowed same-origin redirect.
    let (base, worker) = server(vec![
        // Connection: close, or the client may reuse the socket the fake closes.
        b"HTTP/1.1 302 Found\r\nLocation: /asset\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
            .to_vec(),
        ok(&archive, "application/zip"),
    ]);
    let url = format!("{base}/ollama.zip");
    let mut phases = vec![];
    download::install(
        root.path(),
        &source(&url, &sha, archive.len() as u64),
        &CancellationToken::new(),
        |p| phases.push(p.phase),
    )
    .await
    .unwrap();
    worker.join().unwrap();
    assert!(managed_installed(root.path()));
    assert!(phases.contains(&"verify".to_string()) && phases.contains(&"extract".to_string()));
    let leftovers: Vec<_> = fs::read_dir(base_dir(root.path()))
        .unwrap()
        .map(|e| e.unwrap().file_name().to_string_lossy().to_string())
        .collect();
    assert_eq!(leftovers, vec![format!("ollama-{OLLAMA_VERSION}")]);
    // A second install never overwrites the managed copy.
    assert!(download::install(
        root.path(),
        &source(&url, &sha, archive.len() as u64),
        &CancellationToken::new(),
        |_| {}
    )
    .await
    .unwrap_err()
    .contains("already exists"));
    // Removal is limited to the receipt-backed managed folder.
    let state = State::default();
    remove_runtime(root.path(), &state).unwrap();
    assert!(!runtime_dir(root.path()).exists());
    fs::create_dir_all(runtime_dir(root.path())).unwrap();
    assert!(remove_runtime(root.path(), &state).is_err());
    assert!(runtime_dir(root.path()).exists());
}
#[tokio::test]
async fn hostile_archives_and_cancellation_are_rejected() {
    let root = tempfile::tempdir().unwrap();
    for entries in [
        vec![
            ("../escape.exe", b"x".as_slice()),
            ("ollama.exe", b"x".as_slice()),
        ],
        vec![("readme.txt", b"no runtime".as_slice())],
    ] {
        let archive = zip_bytes(&entries);
        let sha = format!("{:x}", Sha256::digest(&archive));
        let (base, worker) = server(vec![ok(&archive, "application/zip")]);
        let url = format!("{base}/ollama.zip");
        assert!(download::install(
            root.path(),
            &source(&url, &sha, archive.len() as u64),
            &CancellationToken::new(),
            |_| {}
        )
        .await
        .is_err());
        worker.join().unwrap();
        assert!(!managed_installed(root.path()));
        assert!(!root.path().join("escape.exe").exists());
        assert!(!base_dir(root.path()).join("escape.exe").exists());
    }
    let token = CancellationToken::new();
    token.cancel();
    let url = "http://127.0.0.1:9/ollama.zip";
    assert!(download::install(
        root.path(),
        &source(url, &"0".repeat(64), 10),
        &token,
        |_| {}
    )
    .await
    .unwrap_err()
    .contains("cancelled"));
    assert_eq!(fs::read_dir(base_dir(root.path())).unwrap().count(), 0);
}
fn show_for(digest: &str) -> Vec<u8> {
    json_ok(serde_json::json!({
        "details": {"format": "gguf", "quantization_level": "Q4_K_M"},
        "modelfile": format!("FROM C:/models/blobs/sha256-{digest}\n")
    }))
}
#[tokio::test]
async fn pull_streams_progress_and_reports_ready_only_for_qualified_weights() {
    let policy = assistant::models::policy().unwrap();
    let primary = &policy.primary;
    let stream = format!(
        "{}\n{}\n{}\n",
        r#"{"status":"pulling manifest"}"#,
        r#"{"status":"pulling sha256","digest":"x","total":100,"completed":50}"#,
        r#"{"status":"success"}"#
    );
    let tags = json_ok(serde_json::json!({"models":[{"name": primary.name}]}));
    let (base, worker) = server(vec![
        json_ok(serde_json::json!({"cloud":{"disabled":true}})),
        ok(stream.as_bytes(), "application/x-ndjson"),
        tags.clone(),
        show_for(&primary.weight_digest),
    ]);
    let mut events = vec![];
    let state = pull(&base, "primary", &CancellationToken::new(), |p| {
        events.push((p.phase, p.done, p.total))
    })
    .await
    .unwrap();
    assert_eq!(state.state, "ready");
    assert!(events.contains(&("pull".into(), 50, Some(100))));
    let requests = worker.join().unwrap();
    assert!(requests[1].starts_with("POST /api/pull "));
    assert!(requests[1].contains(&primary.name) && !requests[1].contains("campaign"));
    // Same name but other weights: never reported ready.
    let (base, worker) = server(vec![
        json_ok(serde_json::json!({"cloud":{"disabled":true}})),
        ok(b"{\"status\":\"success\"}\n", "application/x-ndjson"),
        tags,
        show_for(&"a".repeat(64)),
    ]);
    assert!(pull(&base, "primary", &CancellationToken::new(), |_| {})
        .await
        .unwrap_err()
        .contains("qualified"));
    worker.join().unwrap();
    // Cloud not disabled: no pull request is sent at all.
    let (base, worker) = server(vec![json_ok(
        serde_json::json!({"cloud":{"disabled":false}}),
    )]);
    assert!(pull(&base, "primary", &CancellationToken::new(), |_| {})
        .await
        .is_err());
    assert_eq!(worker.join().unwrap().len(), 1);
    // Runtime error lines and unknown roles stop the setup.
    let (base, worker) = server(vec![
        json_ok(serde_json::json!({"cloud":{"disabled":true}})),
        ok(
            b"{\"error\":\"no space left on device\"}\n",
            "application/x-ndjson",
        ),
    ]);
    assert!(pull(&base, "primary", &CancellationToken::new(), |_| {})
        .await
        .unwrap_err()
        .contains("no space"));
    worker.join().unwrap();
    assert!(pull(
        &base,
        "qwen3:4b-instruct",
        &CancellationToken::new(),
        |_| {}
    )
    .await
    .is_err());
}
#[tokio::test]
async fn status_never_downloads_and_handles_a_stopped_runtime() {
    let root = tempfile::tempdir().unwrap();
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let base = format!("http://{}", listener.local_addr().unwrap());
    drop(listener);
    let s = status(root.path(), &State::default(), &base).await.unwrap();
    assert_eq!(s.runtime, "stopped");
    assert!(!s.managed_installed && !s.managed_running);
    assert_eq!(s.models.len(), 2);
    assert!(s
        .models
        .iter()
        .all(|m| m.state == "unknown" && m.download_bytes > 0));
    assert_eq!(s.runtime_download_bytes, OLLAMA_BYTES);
    assert!(
        !base_dir(root.path()).exists(),
        "checking never creates folders"
    );
    assert_eq!(
        shown(Path::new(r"\\?\D:\data\ai-runtime")),
        r"D:\data\ai-runtime"
    );
    assert!(start(root.path(), &State::default(), &base)
        .await
        .unwrap_err()
        .contains("Install"));
}
