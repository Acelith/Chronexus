use base64::{engine::general_purpose::STANDARD, Engine};
use serde_json::json;
use tauri_plugin_updater::UpdaterExt;
#[test]
fn updates_signature_and_signed_version_are_verified_and_older_releases_are_not_offered() {
    // Public throwaway test vectors from tauri-plugin-updater 2.14.0 (MIT/Apache-2.0).
    // No production signing key and no installer are used in this test.
    const PUBLIC: &str="untrusted comment: minisign public key: A49EF4746FA6E6D7\nRWTX5qZvdPSepDGWg2bz8n6ArQnBMwgQK1geVosorcbLzcunD+KJ+cYe";
    const SIGNATURE: &str="untrusted comment: signature from tauri secret key\nRUTX5qZvdPSepPF2zsjvP/L/TQtBLRnWRvaq+4omK1UEugtQp/USrGiI1v762sDy3id3aor7bRC9ETyeot6lMHHrWoZ5hjUM1Qc=\ntrusted comment: timestamp:1791649051\tfile:payload\tversion:2.0.0\nDDq2CLOEl5cQmC2eJRHlnZPVViOZsu1CjpPKQoei4A/XBfkDqGO0B+QMrcrHgEQ5qV3mne75tdFWhJpqUXh9AA==";
    let mut context = tauri::test::mock_context(tauri::test::noop_assets());
    context.config_mut().plugins.0.insert(
        "updater".into(),
        json!({"pubkey":STANDARD.encode(PUBLIC),"requireSignedVersion":true}),
    );
    let app = tauri::test::mock_builder()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .build(context)
        .unwrap();
    let updater = app
        .updater_builder()
        .pubkey(STANDARD.encode(PUBLIC))
        .target("test-target")
        .endpoints(vec![
            "https://github.com/Acelith/Chronexus/releases/latest/download/latest.json"
                .parse()
                .unwrap(),
        ])
        .unwrap()
        .build()
        .unwrap();
    let mut manifest = json!({"version":"2.0.0","platforms":{"test-target":{"url":"https://github.com/fixture.exe","signature":STANDARD.encode(SIGNATURE)}}});
    let update = updater.restore_update(manifest.clone()).unwrap().unwrap();
    update.verify(b"test").unwrap();
    assert!(update.verify(b"tampered").is_err());
    manifest["version"] = json!("3.0.0");
    assert!(updater
        .restore_update(manifest.clone())
        .unwrap()
        .unwrap()
        .verify(b"test")
        .is_err());
    manifest["version"] = json!("0.0.0");
    assert!(updater.restore_update(manifest).unwrap().is_none());
}
#[test]
#[ignore = "Requires CHRONEXUS_QA_UPDATE_MANIFEST and CHRONEXUS_QA_UPDATE_PACKAGE from a signed local release"]
fn updates_signed_release_package_matches_production_key() {
    let manifest_path =
        std::env::var("CHRONEXUS_QA_UPDATE_MANIFEST").expect("Set signed manifest path");
    let package_path =
        std::env::var("CHRONEXUS_QA_UPDATE_PACKAGE").expect("Set signed installer path");
    let config: serde_json::Value =
        serde_json::from_str(include_str!("../tauri.conf.json")).unwrap();
    let public = config["plugins"]["updater"]["pubkey"].as_str().unwrap();
    let mut context = tauri::test::mock_context(tauri::test::noop_assets());
    context.config_mut().plugins.0.insert(
        "updater".into(),
        json!({"pubkey":public,"requireSignedVersion":true}),
    );
    let app = tauri::test::mock_builder()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .build(context)
        .unwrap();
    let manifest: serde_json::Value =
        serde_json::from_slice(&std::fs::read(manifest_path).unwrap()).unwrap();
    let target = manifest["platforms"]
        .as_object()
        .unwrap()
        .keys()
        .next()
        .unwrap()
        .clone();
    let updater = app
        .updater_builder()
        .target(target)
        .endpoints(vec![
            "https://api.github.com/repos/Acelith/Chronexus/releases/latest"
                .parse()
                .unwrap(),
        ])
        .unwrap()
        .build()
        .unwrap();
    let update = updater.restore_update(manifest).unwrap().unwrap();
    let mut package = std::fs::read(package_path).unwrap();
    update.verify(&package).unwrap();
    package[0] ^= 1;
    assert!(update.verify(&package).is_err());
}
