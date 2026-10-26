use crate::{backup, export, images, journal, knowledge};
use image::{DynamicImage, ImageFormat};
use serde_json::json;
use std::{
    fs::File,
    io::{Cursor, Read},
};
#[test]
fn readable_export_contains_canonical_data_stable_links_and_original_image_bytes() {
    let dir = tempfile::tempdir().unwrap();
    let store = backup::Store::open(&dir.path().join("profile")).unwrap();
    let c = &store.connection;
    let a = journal::create_campaign(c, "Campaign").unwrap();
    let other = journal::create_campaign(c, "Other").unwrap();
    knowledge::create_page(c, &other.id, "PrivateOther", "note", "active", &[]).unwrap();
    let p = knowledge::create_page(c, &a.id, "Varek", "npc", "active", &["Keeper".into()]).unwrap();
    let s = journal::create_session(c, &a.id, 12, "The key", None).unwrap();
    journal::save_document(c,&a.id,&s.id,0,json!({"version":1,"blocks":[{"id":"source","type":"paragraph","props":{},"children":[],"content":[{"type":"pageMention","props":{"pageId":p.id,"label":"Varek"}}]}]})).unwrap();
    let mut buffer = Cursor::new(vec![]);
    DynamicImage::new_rgb8(2, 3)
        .write_to(&mut buffer, ImageFormat::Png)
        .unwrap();
    let data = buffer.into_inner();
    let picture = images::add(
        c,
        &store.directory,
        &a.id,
        &images::ImageTarget {
            kind: "page".into(),
            id: p.id.clone(),
        },
        "Volto",
        "portrait",
        data.clone(),
    )
    .unwrap();
    let output = dir.path().join("readable.zip");
    let receipt = export::write_export(c, &store.directory, &a.id, &output).unwrap();
    assert_eq!(receipt.pages, 1);
    assert_eq!(receipt.images, 1);
    assert!(export::write_export(c, &store.directory, &a.id, &output).is_err());
    let mut archive = zip::ZipArchive::new(File::open(output).unwrap()).unwrap();
    let mut raw = String::new();
    archive
        .by_name("campaign.json")
        .unwrap()
        .read_to_string(&mut raw)
        .unwrap();
    let exported: serde_json::Value = serde_json::from_str(&raw).unwrap();
    assert_eq!(exported["pages"].as_array().unwrap().len(), 1);
    assert_eq!(exported["images"][0]["pageId"], p.id);
    let mut md = String::new();
    archive
        .by_name(&format!("sessions/{}.md", s.id))
        .unwrap()
        .read_to_string(&mut md)
        .unwrap();
    assert!(md.contains(&format!("../pages/{}.md", p.id)));
    assert!(md.starts_with("# Session 12 — The key\n"));
    let mut index = String::new();
    archive
        .by_name("README.md")
        .unwrap()
        .read_to_string(&mut index)
        .unwrap();
    assert!(index.contains("Chronexus export."));
    assert!(index.contains("## Pages") && index.contains("## Sessions"));
    let mut page_text = String::new();
    archive
        .by_name(&format!("pages/{}.md", p.id))
        .unwrap()
        .read_to_string(&mut page_text)
        .unwrap();
    assert!(page_text.contains("Type: npc") && page_text.contains("Alias: Keeper"));
    // English wrappers must not translate canonical campaign titles or aliases.
    assert_eq!(exported["sessions"][0]["title"], "The key");
    assert_eq!(exported["pages"][0]["aliases"][0], "Keeper");
    let mut bytes = vec![];
    archive
        .by_name(&format!("attachments/{}/{}", a.id, picture.filename))
        .unwrap()
        .read_to_end(&mut bytes)
        .unwrap();
    assert_eq!(bytes, data);
    assert!(!raw.contains("PrivateOther"));
    assert_eq!(journal::get_session(c, &a.id, &s.id).unwrap().revision, 1);
}
