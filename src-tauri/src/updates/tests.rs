use super::*;
use crate::{backup, images, journal, knowledge};
use std::{
    fs,
    io::{Read, Write},
    net::TcpListener,
    sync::atomic::{AtomicBool, Ordering},
};

#[test]
fn settings_persist_without_accepting_credentials_or_insecure_endpoints() {
    let root = tempfile::tempdir().unwrap();
    assert_eq!(
        safety::read_settings(root.path()).unwrap().endpoint,
        DEFAULT_ENDPOINT
    );
    for endpoint in [
        "http://example.com/latest.json",
        "https://user:password@example.com/latest.json",
        "https://example.com/latest.json?token=secret",
        "file:///tmp/update",
        "https://example.com/#part",
    ] {
        assert!(network::url(endpoint).is_err());
    }
    let s = Settings {
        endpoint: "https://example.com/updates/latest.json".into(),
    };
    safety::write_settings(root.path(), &s).unwrap();
    assert_eq!(
        safety::read_settings(root.path()).unwrap().endpoint,
        s.endpoint
    );
    assert!(network::artifact(
        &network::url(DEFAULT_ENDPOINT).unwrap(),
        &network::url("https://other.example/update.exe").unwrap()
    )
    .is_err());
}
#[test]
fn backup_is_verified_restorable_and_includes_images_before_installer_runs() {
    let root = tempfile::tempdir().unwrap();
    let mut store = backup::Store::open(root.path()).unwrap();
    let campaign = journal::create_campaign(&store.connection, "Synthetic update QA").unwrap();
    let session =
        journal::create_session(&store.connection, &campaign.id, 1, "Prima", None).unwrap();
    let page = knowledge::create_page(
        &store.connection,
        &campaign.id,
        "Map",
        "place",
        "active",
        &[],
    )
    .unwrap();
    let mut png = std::io::Cursor::new(Vec::new());
    image::DynamicImage::new_rgb8(3, 2)
        .write_to(&mut png, image::ImageFormat::Png)
        .unwrap();
    let image = images::add(
        &store.connection,
        &store.directory,
        &campaign.id,
        &images::ImageTarget {
            kind: "page".into(),
            id: page.id,
        },
        "Map",
        "map",
        png.into_inner(),
    )
    .unwrap();
    fs::write(
        root.path().join("interface-preferences.json"),
        r#"{"version":2,"locale":"it","script":"standard","showOriginal":true}"#,
    )
    .unwrap();
    let path = safety::before_install(&store, None, "0.4.0", |receipt, _| {
        let prepared =
            backup::prepare_restore(PathBuf::from(&receipt.path).as_path(), root.path()).unwrap();
        drop(prepared);
        assert!(PathBuf::from(&receipt.path).is_file());
        Ok(receipt.path.clone())
    })
    .unwrap();
    let extra = fs::read_dir(root.path().join("update-backups"))
        .unwrap()
        .filter_map(Result::ok)
        .find(|p| p.path().extension().is_some_and(|p| p == "json"))
        .unwrap();
    let receipt: serde_json::Value =
        serde_json::from_slice(&fs::read(extra.path()).unwrap()).unwrap();
    assert_eq!(receipt["interfacePreferences"]["locale"], "it");
    assert_eq!(receipt["sha256"].as_str().unwrap().len(), 64);
    journal::create_session(&store.connection, &campaign.id, 2, "Dopo", None).unwrap();
    let preview = store.prepare(PathBuf::from(&path).as_path()).unwrap();
    store.restore(&preview.token).unwrap();
    assert_eq!(
        journal::list_sessions(&store.connection, &campaign.id)
            .unwrap()
            .len(),
        1
    );
    assert_eq!(
        journal::get_session(&store.connection, &campaign.id, &session.id)
            .unwrap()
            .title,
        "Prima"
    );
    assert!(!images::bytes(&store.directory, &image).unwrap().is_empty());
    let second =
        safety::before_install(&store, None, "0.4.0", |receipt, _| Ok(receipt.path.clone()))
            .unwrap();
    assert_ne!(path, second);
    assert!(PathBuf::from(path).is_file());
}
#[test]
fn failed_backup_never_calls_installer_and_installer_failure_keeps_backup() {
    let root = tempfile::tempdir().unwrap();
    let store = backup::Store::open(root.path()).unwrap();
    fs::write(root.path().join("update-backups"), "blocked").unwrap();
    let invoked = AtomicBool::new(false);
    let result: AppResult<()> = safety::before_install(&store, None, "0.4.0", |_, _| {
        invoked.store(true, Ordering::Relaxed);
        Ok(())
    });
    assert!(result.is_err());
    assert!(!invoked.load(Ordering::Relaxed));
    let other = tempfile::tempdir().unwrap();
    let store = backup::Store::open(other.path()).unwrap();
    let result: AppResult<()> =
        safety::before_install(&store, None, "0.4.0", |_, _| Err("installer failed".into()));
    assert!(result.is_err());
    assert_eq!(
        fs::read_dir(other.path().join("update-backups"))
            .unwrap()
            .count(),
        2
    );
}
fn response_server(response: String) -> (reqwest::Url, std::thread::JoinHandle<()>) {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let url = format!("http://{}/latest.json", listener.local_addr().unwrap())
        .parse()
        .unwrap();
    let worker = std::thread::spawn(move || {
        let (mut stream, _) = listener.accept().unwrap();
        stream
            .set_read_timeout(Some(Duration::from_secs(2)))
            .unwrap();
        let mut header = vec![];
        let mut b = [0];
        while !header.ends_with(b"\r\n\r\n") {
            stream.read_exact(&mut b).unwrap();
            header.push(b[0]);
        }
        let header = String::from_utf8(header).unwrap();
        assert!(header.starts_with("GET /latest.json HTTP/1.1"));
        assert!(!header.to_lowercase().contains("authorization:"));
        let _ = stream.write_all(response.as_bytes());
    });
    (url, worker)
}
#[tokio::test]
async fn downloads_are_bounded_even_without_content_length_and_public_errors_are_clear() {
    let client = reqwest::Client::builder()
        .no_proxy()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(Duration::from_secs(3))
        .build()
        .unwrap();
    for (response, success) in [
        ("HTTP/1.1 200 OK\r\nContent-Length: 4\r\n\r\ntest",true),
        ("HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n8\r\n12345678\r\n0\r\n\r\n",false),
        ("HTTP/1.1 200 OK\r\nContent-Length: 99999\r\n\r\n",false),
        ("HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n",false),
        ("HTTP/1.1 302 Found\r\nLocation: https://foreign.example/package.exe\r\nContent-Length: 0\r\n\r\n",false),
    ] {
        let (url,worker)=response_server(response.into());
        let result=network::fetch(&client,url,4,&CancellationToken::new(),|_,_|{}).await;
        assert_eq!(result.is_ok(),success); worker.join().unwrap();
    }
    let (url, worker) = response_server("HTTP/1.1 204 No Content\r\n\r\n".into());
    assert!(
        network::fetch(&client, url, 4, &CancellationToken::new(), |_, _| {})
            .await
            .unwrap()
            .is_none()
    );
    worker.join().unwrap();
}
#[tokio::test]
async fn cancelled_download_stops_before_installation() {
    let cancel = CancellationToken::new();
    cancel.cancel();
    let result = network::fetch(
        &reqwest::Client::new(),
        "http://127.0.0.1:9/latest.json".parse().unwrap(),
        4,
        &cancel,
        |_, _| {},
    )
    .await;
    assert!(result.unwrap_err().contains("cancelled"));
}

#[test]
fn forgejo_discovery_accepts_only_stable_release_with_unique_same_origin_manifest() {
    let endpoint = network::url(DEFAULT_ENDPOINT).unwrap();
    let mut release = serde_json::json!({"draft":false,"prerelease":false,"tag_name":"v0.4.0","assets":[{"name":"latest.json","browser_download_url":"https://github.com/attachments/synthetic"}]});
    assert_eq!(
        network::manifest_asset(&release, &endpoint)
            .unwrap()
            .unwrap()
            .1,
        "v0.4.0"
    );
    release["draft"] = serde_json::json!(true);
    assert!(network::manifest_asset(&release, &endpoint).is_err());
    release["draft"] = serde_json::json!(false);
    release["prerelease"] = serde_json::json!(true);
    assert!(network::manifest_asset(&release, &endpoint).is_err());
    release["prerelease"] = serde_json::json!(false);
    release["assets"][0]["browser_download_url"] =
        serde_json::json!("https://foreign.example/latest.json");
    assert!(network::manifest_asset(&release, &endpoint).is_err());
    release["assets"] = serde_json::json!([]);
    assert!(network::manifest_asset(&release, &endpoint).is_err());
    assert!(network::manifest_asset(
        &serde_json::json!({"version":"0.4.0","platforms":{}}),
        &endpoint
    )
    .unwrap()
    .is_none());
}
#[test]
fn update_backup_goes_to_documents_with_receipt_or_blocks_installer() {
    let root = tempfile::tempdir().unwrap();
    let store = backup::Store::open(&root.path().join("dati")).unwrap();
    let documents = root.path().join("Documenti utente");
    fs::create_dir(&documents).unwrap();
    fs::write(
        store.root.join(crate::backup_folder::PREFERENCES),
        r#"{"version":1,"enabled":true,"frequency":"daily","hours":12,"keep":3,"destination":null}"#,
    )
    .unwrap();
    let (path, notice) = safety::before_install(&store, Some(&documents), "0.9.0", |r, n| {
        Ok((r.path.clone(), n.map(str::to_string)))
    })
    .unwrap();
    let folder = documents
        .join("Chronexus")
        .join(crate::backup_folder::UPDATES);
    assert!(PathBuf::from(&path).starts_with(&folder) && notice.is_none());
    let receipt = fs::read_dir(&folder)
        .unwrap()
        .filter_map(Result::ok)
        .find(|p| p.path().extension().is_some_and(|e| e == "json"))
        .unwrap();
    let receipt: serde_json::Value =
        serde_json::from_slice(&fs::read(receipt.path()).unwrap()).unwrap();
    assert_eq!(receipt["backupPreferences"]["keep"], 3);
    assert!(!store.root.join("update-backups").exists());
    // Documents unusable: data folder with a notice, never skipped.
    fs::write(documents.join("Chronexus").join("x"), "").unwrap();
    let blocked = root.path().join("bloccati");
    fs::write(&blocked, "file").unwrap();
    let (path, notice) = safety::before_install(&store, Some(&blocked), "0.9.0", |r, n| {
        Ok((r.path.clone(), n.map(str::to_string)))
    })
    .unwrap();
    assert!(PathBuf::from(path).starts_with(store.root.join("update-backups")));
    assert!(notice.unwrap().contains("data folder"));
    // Both unusable: the installer is never reached.
    fs::remove_dir_all(store.root.join("update-backups")).unwrap();
    fs::write(store.root.join("update-backups"), "file").unwrap();
    let invoked = AtomicBool::new(false);
    let result: AppResult<()> = safety::before_install(&store, Some(&blocked), "0.9.0", |_, _| {
        invoked.store(true, Ordering::Relaxed);
        Ok(())
    });
    assert!(result.is_err() && !invoked.load(Ordering::Relaxed));
}
