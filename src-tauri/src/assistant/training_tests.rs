use super::*;
use crate::{backup, db, journal, knowledge};
use serde_json::json;
use uuid::Uuid;

fn fixture(c: &Connection, campaign: &str) -> Job {
    let p = campaign::get(c, campaign).unwrap();
    let id = Uuid::new_v4().to_string();
    Job {
        id: id.clone(),
        campaign_id: campaign.into(),
        status: "ready".into(),
        created_at: "2026-10-24T12:00:00Z".into(),
        base_digest: "a".repeat(64),
        weight_digest: "b".repeat(64),
        model: format!("chronexus-12b-{id}:latest"),
        digest: "c".repeat(64),
        manifest: campaign::stamps(&campaign::snapshot(c, campaign, &p).unwrap()),
        policy_hash: policy(&p),
        adapter: String::new(),
        adapter_hash: String::new(),
        config: String::new(),
        config_hash: String::new(),
        metrics: json!({"syntheticTestFixture":true}),
        error: String::new(),
    }
}
#[test]
fn adapters_cannot_cross_campaigns_or_override_corrected_sources() {
    let c = db::open(Path::new(":memory:")).unwrap();
    let a = journal::create_campaign(&c, "A").unwrap();
    let b = journal::create_campaign(&c, "B").unwrap();
    let j = fixture(&c, &a.id);
    persist(&c, &j).unwrap();
    assert!(model_owned(&c, Some(&a.id), &j.model).is_ok());
    assert!(model_owned(&c, Some(&b.id), &j.model).is_err());
    assert!(model_owned(&c, None, &j.model).is_err());
    let mut foreign = j.clone();
    foreign.campaign_id = b.id.clone();
    assert!(persist(&c, &foreign).is_err());
    activate(&c, &a.id, &j.id).unwrap();
    assert!(!campaign::get(&c, &b.id).unwrap().settings.enabled);
    let page = knowledge::create_page(&c, &a.id, "Nuovi appunti", "lore", "active", &[]).unwrap();
    knowledge::save_page_document(&c,&a.id,&page.id,0,json!({"version":1,"blocks":[{"id":"new-block","type":"paragraph","props":{},"content":[{"type":"text","text":"La porta è verde.","styles":{}}],"children":[]}]})).unwrap();
    assert!(model_owned(&c, Some(&a.id), &j.model)
        .unwrap_err()
        .contains("fonti sono cambiate"));
}
#[test]
fn recovery_marks_jobs_interrupted_without_changing_active_model() {
    let c = db::open(Path::new(":memory:")).unwrap();
    let a = journal::create_campaign(&c, "A").unwrap();
    let before = campaign::get(&c, &a.id).unwrap();
    let mut j = fixture(&c, &a.id);
    j.status = "running".into();
    persist(&c, &j).unwrap();
    recover(&c).unwrap();
    assert_eq!(history(&c, &a.id).unwrap()[0].status, "interrupted");
    assert_eq!(campaign::get(&c, &a.id).unwrap(), before);
}
#[test]
fn backup_roundtrip_preserves_compact_adapter_and_rejects_tampering() {
    let dir = tempfile::tempdir().unwrap();
    let mut source = backup::Store::open(&dir.path().join("source")).unwrap();
    let a = journal::create_campaign(&source.connection, "A").unwrap();
    let mut j = fixture(&source.connection, &a.id);
    j.adapter = format!("attachments/{}/{}.safetensors", a.id, Uuid::new_v4());
    j.config = format!("attachments/{}/{}.json", a.id, Uuid::new_v4());
    fs::create_dir_all(source.directory.join("attachments").join(&a.id)).unwrap();
    // Deliberately inert bytes: this is a storage test, never a trained-model claim.
    fs::write(
        source.directory.join(&j.adapter),
        b"synthetic adapter storage fixture",
    )
    .unwrap();
    fs::write(source.directory.join(&j.config), b"{}").unwrap();
    j.adapter_hash = hash_file(&source.directory.join(&j.adapter)).unwrap();
    j.config_hash = hash_file(&source.directory.join(&j.config)).unwrap();
    persist(&source.connection, &j).unwrap();
    let archive = dir.path().join("test.nodex");
    backup::write_backup(&source.connection, &source.directory, &archive).unwrap();
    let preview = source.prepare(&archive).unwrap();
    source.restore(&preview.token).unwrap();
    assert_eq!(
        history(&source.connection, &a.id).unwrap()[0].adapter_hash,
        j.adapter_hash
    );
    validate_files(&source.connection, &source.directory).unwrap();
    fs::write(source.directory.join(&j.adapter), b"tampered").unwrap();
    assert!(backup::write_backup(
        &source.connection,
        &source.directory,
        &dir.path().join("bad.nodex")
    )
    .is_err());
}
