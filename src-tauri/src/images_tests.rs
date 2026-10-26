use crate::{backup, images::*, journal, knowledge};
use image::{DynamicImage, ImageFormat};
use std::{fs, io::Cursor};
fn png() -> Vec<u8> {
    let mut out = Cursor::new(vec![]);
    DynamicImage::new_rgb8(3, 2)
        .write_to(&mut out, ImageFormat::Png)
        .unwrap();
    out.into_inner()
}
#[test]
fn images_are_real_copies_scoped_to_owner_and_survive_backup_restore() {
    let dir = tempfile::tempdir().unwrap();
    let source = backup::Store::open(&dir.path().join("source")).unwrap();
    let a = journal::create_campaign(&source.connection, "A").unwrap();
    let b = journal::create_campaign(&source.connection, "B").unwrap();
    let p =
        knowledge::create_page(&source.connection, &a.id, "Map", "place", "active", &[]).unwrap();
    let target = ImageTarget {
        kind: "page".into(),
        id: p.id,
    };
    assert!(add(
        &source.connection,
        &source.directory,
        &b.id,
        &target,
        "Map",
        "map",
        png()
    )
    .is_err());
    let data = png();
    let saved = add(
        &source.connection,
        &source.directory,
        &a.id,
        &target,
        "Test map",
        "map",
        data.clone(),
    )
    .unwrap();
    assert_eq!(bytes(&source.directory, &saved).unwrap(), data);
    assert_eq!(saved.width, 3);
    let original = read(
        &source.connection,
        &source.directory,
        &a.id,
        &saved.id,
        false,
    )
    .unwrap();
    assert!(original.starts_with("data:image/png;base64,"));
    assert!(read(
        &source.connection,
        &source.directory,
        &a.id,
        &saved.id,
        true
    )
    .unwrap()
    .starts_with("data:image/png;base64,"));
    let bundle = dir.path().join("images.nodex");
    let receipt = backup::write_backup(&source.connection, &source.directory, &bundle).unwrap();
    assert_eq!(receipt.counts.attachments, 1);
    let root = dir.path().join("restored");
    let mut restored = backup::Store::open(&root).unwrap();
    let preview = restored.prepare(&bundle).unwrap();
    restored.restore(&preview.token).unwrap();
    drop(restored);
    let restored = backup::Store::open(&root).unwrap();
    assert_eq!(
        list(&restored.connection, &a.id, &target).unwrap()[0].id,
        saved.id
    );
    assert_eq!(
        read(
            &restored.connection,
            &restored.directory,
            &a.id,
            &saved.id,
            false
        )
        .unwrap(),
        original
    );
    detach(&restored.connection, &a.id, &saved.id).unwrap();
    assert!(list(&restored.connection, &a.id, &target)
        .unwrap()
        .is_empty());
    assert!(restored
        .directory
        .join("attachments")
        .join(&a.id)
        .join(&saved.filename)
        .exists());
    fs::write(
        source
            .directory
            .join("attachments")
            .join(&a.id)
            .join(&saved.filename),
        b"damaged",
    )
    .unwrap();
    assert!(backup::write_backup(
        &source.connection,
        &source.directory,
        &dir.path().join("bad.nodex")
    )
    .is_err());
}
#[test]
fn invalid_formats_payloads_and_paths_do_not_add_records() {
    let dir = tempfile::tempdir().unwrap();
    let store = backup::Store::open(dir.path()).unwrap();
    let a = journal::create_campaign(&store.connection, "A").unwrap();
    let p = knowledge::create_page(&store.connection, &a.id, "NPC", "npc", "active", &[]).unwrap();
    let target = ImageTarget {
        kind: "page".into(),
        id: p.id,
    };
    for bytes in [
        vec![],
        b"<svg onload='bad()'></svg>".to_vec(),
        b"\x89PNG\r\n\x1a\ninvalid".to_vec(),
        vec![0; 20 * 1024 * 1024 + 1],
    ] {
        assert!(add(
            &store.connection,
            &store.directory,
            &a.id,
            &target,
            "Foto",
            "portrait",
            bytes
        )
        .is_err());
    }
    assert!(list(&store.connection, &a.id, &target).unwrap().is_empty());
    assert!(add(
        &store.connection,
        &store.directory,
        &a.id,
        &ImageTarget {
            kind: "page".into(),
            id: "../escape".into()
        },
        "Foto",
        "map",
        png()
    )
    .is_err());
    assert!(add(
        &store.connection,
        &store.directory,
        &a.id,
        &target,
        "Foto",
        "script",
        png()
    )
    .is_err());
}
#[test]
fn item_updates_preserve_images_and_deleting_the_item_only_detaches_them() {
    use crate::player;
    use serde_json::json;
    let dir = tempfile::tempdir().unwrap();
    let store = backup::Store::open(dir.path()).unwrap();
    let c = &store.connection;
    let a = journal::create_campaign(c, "A").unwrap();
    let character=player::save_character(c,&a.id,None,None,serde_json::from_value(json!({"name":"PC","systemId":"generic","ancestry":"","vocation":"","level":null,"experience":null,"hpCurrent":0,"hpMaximum":0,"hpTemporary":0,"stats":[],"resources":[],"conditions":"","notes":""})).unwrap()).unwrap();
    let input:player::AssetInput=serde_json::from_value(json!({"details":{"kind":"item","name":"Chiave","quantity":1,"category":"","description":"","weight":null,"value":"","equipped":false,"consumable":false,"notes":""},"links":{"pageId":null,"sourceSessionId":null,"sourceBlockId":null,"npcId":null,"placeId":null,"questId":null,"provenanceNotes":""}})).unwrap();
    let saved = player::save_asset(c, &a.id, &character.id, None, None, input.clone()).unwrap();
    let target = ImageTarget {
        kind: "asset".into(),
        id: saved.id.clone(),
    };
    let image = add(
        c,
        &store.directory,
        &a.id,
        &target,
        "Chiave",
        "image",
        png(),
    )
    .unwrap();
    player::save_asset(c, &a.id, &character.id, Some(&saved.id), Some(0), input).unwrap();
    assert_eq!(list(c, &a.id, &target).unwrap()[0].id, image.id);
    assert!(player::delete_asset(c, &a.id, &character.id, &saved.id, 0).is_err());
    assert_eq!(list(c, &a.id, &target).unwrap().len(), 1);
    player::delete_asset(c, &a.id, &character.id, &saved.id, 1).unwrap();
    assert!(all(c, &a.id).unwrap().is_empty());
    assert!(bytes(&store.directory, &image).is_ok());
}
