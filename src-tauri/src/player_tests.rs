use crate::{backup, db, journal, knowledge, player::*};
use serde_json::{json, Value};
use uuid::Uuid;

fn sheet() -> CharacterInput {
    CharacterInput {
        sheet: SheetDetails::default(),
        name: "Neme".into(),
        system_id: "generic".into(),
        ancestry: "Viandante".into(),
        vocation: "Esploratrice".into(),
        level: Some(2),
        experience: None,
        hp_current: 8,
        hp_maximum: 10,
        hp_temporary: 2,
        stats: vec![Stat {
            modifier: String::new(),
            training: Training::None,
            id: Uuid::new_v4().to_string(),
            label: "Difesa".into(),
            value: "12 (manuale)".into(),
            group: "defense".into(),
        }],
        resources: vec![
            Resource {
                id: Uuid::new_v4().to_string(),
                label: "Concentrazione".into(),
                kind: "resource".into(),
                current: 2,
                maximum: 3,
            },
            Resource {
                id: Uuid::new_v4().to_string(),
                label: "Usi del primo cerchio".into(),
                kind: "slot".into(),
                current: 0,
                maximum: 2,
            },
        ],
        conditions: String::new(),
        notes: "Nessuna formula automatica.".into(),
    }
}
fn item() -> AssetInput {
    AssetInput {
        details: AssetDetails::Item {
            location: String::new(),
            name: "Chiave del ponte".into(),
            quantity: 1,
            category: "Chiavi".into(),
            description: "Ricevuta da Varek".into(),
            weight: Some(0.1),
            value: "Senza prezzo".into(),
            equipped: false,
            consumable: false,
            notes: "Da conservare".into(),
        },
        links: AssetLinks::default(),
    }
}
fn ability(kind: &str) -> AssetInput {
    serde_json::from_value(json!({"details":{"kind":kind,"name":"Luce tenue","systemId":"Sistema personale","rank":"Primo cerchio","school":"Luce","castingTime":"Un gesto","duration":"Breve","range":"Vicina","components":"Voce","known":false,"prepared":true,"description":"Testo originale del giocatore.","notes":"Nessun consumo automatico."},"links":{"pageId":null,"sourceSessionId":null,"sourceBlockId":null,"npcId":null,"placeId":null,"questId":null,"provenanceNotes":""}})).unwrap()
}
fn document() -> Value {
    json!({"version":1,"blocks":[{"id":"key-source","type":"paragraph","props":{},"children":[],"content":[{"type":"text","text":"Varek mi ha dato la chiave.","styles":{}}]}]})
}
#[test]
fn legacy_sheet_defaults_and_expanded_validation_preserve_saved_data() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("legacy-sheet.sqlite3");
    let old = rusqlite::Connection::open(&path).unwrap();
    for m in db::MIGRATIONS.iter().take(5) {
        old.execute_batch(m).unwrap();
    }
    let campaign = journal::create_campaign(&old, "Legacy").unwrap();
    let mut legacy = serde_json::to_value(sheet()).unwrap();
    legacy.as_object_mut().unwrap().remove("sheet");
    legacy["stats"][0]
        .as_object_mut()
        .unwrap()
        .remove("modifier");
    legacy["stats"][0]
        .as_object_mut()
        .unwrap()
        .remove("training");
    let id = Uuid::new_v4().to_string();
    old.execute(
        "INSERT INTO characters(id,campaign_id,data) VALUES(?1,?2,?3)",
        rusqlite::params![id, campaign.id, legacy.to_string()],
    )
    .unwrap();
    drop(old);
    let c = db::open(&path).unwrap();
    let existing = get_character(&c, &campaign.id).unwrap().unwrap();
    assert_eq!(existing.data.name, "Neme");
    assert!(existing.data.sheet.fields.is_empty());
    for n in 0..4 {
        let mut bad = existing.data.clone();
        match n {
            0 => bad.sheet.death_successes = 4,
            1 => {
                bad.sheet.fields.insert("unexpected".into(), "value".into());
            }
            2 => {
                bad.sheet
                    .fields
                    .insert("background".into(), "x".repeat(4001));
            }
            _ => bad.stats[0].modifier = "x".repeat(201),
        }
        assert!(save_character(&c, &campaign.id, Some(&id), Some(0), bad).is_err());
        assert_eq!(
            get_character(&c, &campaign.id).unwrap().unwrap().revision,
            0
        );
    }
    let mut imported = ability("spell");
    if let AssetDetails::Spell { fields } = &mut imported.details {
        fields.catalog_source = Some(crate::catalog::CatalogSource {
            path: "spells/acid-arrow".into(),
            name: "Acid Arrow".into(),
        });
        fields.ritual = true;
    }
    let saved = save_asset(&c, &campaign.id, &id, None, None, imported.clone()).unwrap();
    assert_eq!(
        serde_json::to_value(saved.input).unwrap(),
        serde_json::to_value(&imported).unwrap()
    );
    if let AssetDetails::Spell { fields } = &mut imported.details {
        fields.catalog_source.as_mut().unwrap().path = "https://evil.test".into();
    }
    assert!(save_asset(&c, &campaign.id, &id, None, None, imported).is_err());
}
#[test]
fn character_stats_hp_resources_and_slots_persist_and_reject_stale_or_out_of_range_changes() {
    let temp = tempfile::tempdir().unwrap();
    let path = temp.path().join("player.sqlite3");
    let c = db::open(&path).unwrap();
    let a = journal::create_campaign(&c, "A").unwrap();
    assert!(get_character(&c, &a.id).unwrap().is_none());
    let character = save_character(&c, &a.id, None, None, sheet()).unwrap();
    let resource = character.data.resources[0].id.clone();
    let changed = change_counter(&c, &a.id, &character.id, 0, "hp", -3).unwrap();
    assert_eq!(changed.data.hp_current, 5);
    assert!(change_counter(&c, &a.id, &character.id, 0, "hp", 1).is_err());
    assert!(change_counter(&c, &a.id, &character.id, 1, "hp", -6).is_err());
    let changed = change_counter(&c, &a.id, &character.id, 1, &resource, -2).unwrap();
    assert_eq!(changed.data.resources[0].current, 0);
    assert!(change_counter(&c, &a.id, &character.id, 2, &resource, -1).is_err());
    let changed = change_counter(&c, &a.id, &character.id, 2, "temporaryHp", -2).unwrap();
    assert_eq!(changed.data.hp_temporary, 0);
    assert!(save_character(&c, &a.id, None, None, sheet()).is_err());
    let expected = serde_json::to_value(&changed).unwrap();
    drop(c);
    let c = db::open(&path).unwrap();
    assert_eq!(
        serde_json::to_value(get_character(&c, &a.id).unwrap()).unwrap(),
        expected
    );
}
#[test]
fn inventory_crud_preserves_provenance_through_page_renames_and_does_not_create_assertions() {
    let c = db::open(std::path::Path::new(":memory:")).unwrap();
    let a = journal::create_campaign(&c, "A").unwrap();
    let character = save_character(&c, &a.id, None, None, sheet()).unwrap();
    let npc = knowledge::create_page(&c, &a.id, "Varek", "npc", "active", &[]).unwrap();
    let place = knowledge::create_page(&c, &a.id, "Ponte", "place", "active", &[]).unwrap();
    let quest = knowledge::create_page(&c, &a.id, "Il portone", "quest", "stub", &[]).unwrap();
    let page = knowledge::create_page(&c, &a.id, "Chiave", "item", "active", &[]).unwrap();
    let session = journal::create_session(&c, &a.id, 12, "Una chiave", None).unwrap();
    journal::save_document(&c, &a.id, &session.id, 0, document()).unwrap();
    let mut input = item();
    input.links = AssetLinks {
        page_id: Some(page.id.clone()),
        source_session_id: Some(session.id.clone()),
        source_block_id: Some("key-source".into()),
        npc_id: Some(npc.id.clone()),
        place_id: Some(place.id),
        quest_id: Some(quest.id),
        provenance_notes: "L'ho ricevuta, non l'ho comprata.".into(),
    };
    let saved = save_asset(&c, &a.id, &character.id, None, None, input.clone()).unwrap();
    knowledge::update_page(&c, &a.id, &npc.id, "Varek il grigio", "npc", "active", &[]).unwrap();
    assert_eq!(
        list_assets(&c, &a.id, &character.id).unwrap()[0]
            .input
            .links,
        input.links
    );
    if let AssetDetails::Item {
        quantity, equipped, ..
    } = &mut input.details
    {
        *quantity = 0;
        *equipped = true;
    }
    let changed = save_asset(
        &c,
        &a.id,
        &character.id,
        Some(&saved.id),
        Some(0),
        input.clone(),
    )
    .unwrap();
    assert_eq!(changed.revision, 1);
    assert!(save_asset(&c, &a.id, &character.id, Some(&saved.id), Some(0), input).is_err());
    assert!(delete_asset(&c, &a.id, &character.id, &saved.id, 0).is_err());
    let assertions: i64 = c
        .query_row("SELECT COUNT(*) FROM relationships", [], |r| r.get(0))
        .unwrap();
    assert_eq!(assertions, 0);
    delete_asset(&c, &a.id, &character.id, &saved.id, 1).unwrap();
    assert!(list_assets(&c, &a.id, &character.id).unwrap().is_empty());
    assert_eq!(
        knowledge::get_page(&c, &a.id, &npc.id).unwrap().title,
        "Varek il grigio"
    );
    assert_eq!(journal::list_sessions(&c, &a.id).unwrap().len(), 1);
}

#[test]
fn changed_codex_kind_preserves_historical_provenance_and_backup() {
    let temp = tempfile::tempdir().unwrap();
    let c = db::open(&temp.path().join("profile.sqlite3")).unwrap();
    let a = journal::create_campaign(&c, "A").unwrap();
    let character = save_character(&c, &a.id, None, None, sheet()).unwrap();
    let npc = knowledge::create_page(&c, &a.id, "Varek", "npc", "active", &[]).unwrap();
    let mut input = item();
    input.links.npc_id = Some(npc.id.clone());
    let saved = save_asset(&c, &a.id, &character.id, None, None, input.clone()).unwrap();
    knowledge::update_page(
        &c,
        &a.id,
        &npc.id,
        "Nome riletto come luogo",
        "place",
        "active",
        &[],
    )
    .unwrap();
    save_asset(&c, &a.id, &character.id, Some(&saved.id), Some(0), input).unwrap();
    backup::write_backup(&c, temp.path(), &temp.path().join("historical.nodex")).unwrap();
}
#[test]
fn spell_and_ability_flags_are_independent_manual_values_and_never_consume_resources() {
    let c = db::open(std::path::Path::new(":memory:")).unwrap();
    let a = journal::create_campaign(&c, "A").unwrap();
    let character = save_character(&c, &a.id, None, None, sheet()).unwrap();
    for kind in ["spell", "ability"] {
        let saved = save_asset(&c, &a.id, &character.id, None, None, ability(kind)).unwrap();
        assert_eq!(
            serde_json::to_value(&saved.input.details).unwrap()["prepared"],
            true
        );
        assert_eq!(
            serde_json::to_value(&saved.input.details).unwrap()["known"],
            false
        );
        let mut input = saved.input.clone();
        match &mut input.details {
            AssetDetails::Spell { fields } | AssetDetails::Ability { fields } => {
                fields.known = true;
                fields.prepared = false;
            }
            _ => panic!(),
        }
        save_asset(&c, &a.id, &character.id, Some(&saved.id), Some(0), input).unwrap();
    }
    assert_eq!(list_assets(&c, &a.id, &character.id).unwrap().len(), 2);
    assert_eq!(
        serde_json::to_value(get_character(&c, &a.id).unwrap().unwrap().data.resources).unwrap(),
        serde_json::to_value(character.data.resources).unwrap()
    );
}
#[test]
fn rejects_invalid_payloads_cross_campaign_and_wrong_provenance_types_without_replacing_data() {
    let c = db::open(std::path::Path::new(":memory:")).unwrap();
    let a = journal::create_campaign(&c, "A").unwrap();
    let b = journal::create_campaign(&c, "B").unwrap();
    let character = save_character(&c, &a.id, None, None, sheet()).unwrap();
    let foreign = knowledge::create_page(&c, &b.id, "Varek", "npc", "active", &[]).unwrap();
    let page = knowledge::create_page(&c, &a.id, "Gilda", "faction", "active", &[]).unwrap();
    for scenario in 0..6 {
        let mut bad = sheet();
        match scenario {
            0 => bad.hp_current = 11,
            1 => bad.resources[0].current = -1,
            2 => bad.resources.push(bad.resources[0].clone()),
            3 => bad.stats[0].group = "D&D formula".into(),
            4 => bad.name = " ".into(),
            _ => bad.notes = "x".repeat(16001),
        }
        assert!(save_character(&c, &a.id, Some(&character.id), Some(0), bad).is_err());
    }
    for scenario in 0..6 {
        let mut input = item();
        match scenario {
            0 => input.links.npc_id = Some(foreign.id.clone()),
            1 => input.links.npc_id = Some(page.id.clone()),
            2 => input.links.source_block_id = Some("missing".into()),
            3 => {
                if let AssetDetails::Item { quantity, .. } = &mut input.details {
                    *quantity = -1;
                }
            }
            4 => {
                if let AssetDetails::Item { weight, .. } = &mut input.details {
                    *weight = Some(f64::NAN);
                }
            }
            _ => input.links.page_id = Some(Uuid::new_v4().to_string()),
        }
        assert!(save_asset(&c, &a.id, &character.id, None, None, input).is_err());
    }
    assert!(list_assets(&c, &b.id, &character.id).is_err());
    assert!(change_counter(&c, &b.id, &character.id, 0, "hp", -1).is_err());
    let saved = save_asset(&c, &a.id, &character.id, None, None, item()).unwrap();
    assert!(save_asset(
        &c,
        &a.id,
        &character.id,
        Some(&saved.id),
        Some(0),
        ability("spell")
    )
    .is_err());
    assert_eq!(get_character(&c, &a.id).unwrap().unwrap().revision, 0);
    assert_eq!(list_assets(&c, &a.id, &character.id).unwrap().len(), 1);
}
#[test]
fn removed_source_block_is_retained_and_does_not_prevent_quantity_updates_or_backup() {
    let temp = tempfile::tempdir().unwrap();
    let c = db::open(&temp.path().join("source.sqlite3")).unwrap();
    let a = journal::create_campaign(&c, "A").unwrap();
    let character = save_character(&c, &a.id, None, None, sheet()).unwrap();
    let session = journal::create_session(&c, &a.id, 12, "Chiave", None).unwrap();
    journal::save_document(&c, &a.id, &session.id, 0, document()).unwrap();
    let mut input = item();
    input.links.source_session_id = Some(session.id.clone());
    input.links.source_block_id = Some("absent".into());
    assert!(save_asset(&c, &a.id, &character.id, None, None, input.clone()).is_err());
    input.links.source_block_id = Some("key-source".into());
    let saved = save_asset(&c, &a.id, &character.id, None, None, input).unwrap();
    let mut changed_doc = document();
    changed_doc["blocks"][0]["id"] = json!("replacement");
    journal::save_document(&c, &a.id, &session.id, 1, changed_doc).unwrap();
    let mut stored = list_assets(&c, &a.id, &character.id).unwrap().remove(0);
    assert!(!stored.source_available);
    if let AssetDetails::Item { quantity, .. } = &mut stored.input.details {
        *quantity = 2;
    }
    let updated = save_asset(
        &c,
        &a.id,
        &character.id,
        Some(&saved.id),
        Some(0),
        stored.input,
    )
    .unwrap();
    assert!(!updated.source_available);
    backup::write_backup(&c, temp.path(), &temp.path().join("removed-source.nodex")).unwrap();
}
#[test]
fn migration_from_m4_preserves_notes_and_is_atomic_and_applied_once() {
    let temp = tempfile::tempdir().unwrap();
    let path = temp.path().join("legacy.sqlite3");
    let old = rusqlite::Connection::open(&path).unwrap();
    for migration in db::MIGRATIONS.iter().take(4) {
        old.execute_batch(migration).unwrap();
    }
    let a = journal::create_campaign(&old, "M4").unwrap();
    let session = journal::create_session(&old, &a.id, 12, "Prima", None).unwrap();
    journal::save_document(&old, &a.id, &session.id, 0, document()).unwrap();
    drop(old);
    for _ in 0..2 {
        let c = db::open(&path).unwrap();
        assert!(get_character(&c, &a.id).unwrap().is_none());
        assert_eq!(
            journal::list_sessions(&c, &a.id).unwrap()[0].document,
            document()
        );
        let count: i64 = c
            .query_row("SELECT COUNT(*) FROM schema_migrations", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, db::LATEST_SCHEMA);
    }
    let bad = temp.path().join("conflict.sqlite3");
    let old = rusqlite::Connection::open(&bad).unwrap();
    for migration in db::MIGRATIONS.iter().take(4) {
        old.execute_batch(migration).unwrap();
    }
    old.execute_batch(
        "CREATE TABLE characters (marker TEXT); INSERT INTO characters VALUES ('keep');",
    )
    .unwrap();
    drop(old);
    assert!(db::open(&bad).is_err());
    let old = rusqlite::Connection::open(&bad).unwrap();
    assert_eq!(
        old.query_row("SELECT marker FROM characters", [], |r| r
            .get::<_, String>(0))
            .unwrap(),
        "keep"
    );
    assert_eq!(
        old.query_row("SELECT MAX(version) FROM schema_migrations", [], |r| r
            .get::<_, i64>(0))
            .unwrap(),
        4
    );
}
#[test]
fn backup_round_trip_includes_character_resources_items_and_abilities_with_stable_ids() {
    let temp = tempfile::tempdir().unwrap();
    let source = backup::Store::open(&temp.path().join("source")).unwrap();
    let a = journal::create_campaign(&source.connection, "A").unwrap();
    let mut input = sheet();
    input
        .sheet
        .fields
        .insert("background".into(), "Cartografa".into());
    input.sheet.fields.insert("spellSaveDc".into(), "13".into());
    input.sheet.inspiration = true;
    input.sheet.death_successes = 2;
    input.sheet.attacks.push(Attack {
        id: Uuid::new_v4().to_string(),
        name: "Arco".into(),
        bonus: "+4".into(),
        damage: "1d6".into(),
        range: "24 m".into(),
        weight: "1 kg".into(),
        ammunition: "12".into(),
    });
    let character = save_character(&source.connection, &a.id, None, None, input).unwrap();
    crate::catalog::store(&source.connection, "spells", json!({"results":[]})).unwrap();
    for input in [item(), ability("spell"), ability("ability")] {
        save_asset(&source.connection, &a.id, &character.id, None, None, input).unwrap();
    }
    let expected_assets =
        serde_json::to_value(list_assets(&source.connection, &a.id, &character.id).unwrap())
            .unwrap();
    let bundle = temp.path().join("player.nodex");
    let receipt = backup::write_backup(&source.connection, &source.directory, &bundle).unwrap();
    assert_eq!(receipt.counts.characters, 1);
    assert_eq!(receipt.counts.items, 1);
    assert_eq!(receipt.counts.spells, 2);
    let mut target = backup::Store::open(&temp.path().join("target")).unwrap();
    let preview = target.prepare(&bundle).unwrap();
    target.restore(&preview.token).unwrap();
    let actual = get_character(&target.connection, &a.id).unwrap().unwrap();
    assert!(crate::catalog::read(&target.connection, "spells")
        .unwrap()
        .is_some());
    assert_eq!(
        serde_json::to_value(actual).unwrap(),
        serde_json::to_value(&character).unwrap()
    );
    assert_eq!(
        serde_json::to_value(list_assets(&target.connection, &a.id, &character.id).unwrap())
            .unwrap(),
        expected_assets
    );
}
#[test]
fn write_failure_and_invalid_stored_player_payload_do_not_produce_a_successful_backup() {
    let temp = tempfile::tempdir().unwrap();
    let c = db::open(&temp.path().join("data.sqlite3")).unwrap();
    let a = journal::create_campaign(&c, "A").unwrap();
    let character = save_character(&c, &a.id, None, None, sheet()).unwrap();
    c.pragma_update(None, "query_only", "ON").unwrap();
    assert!(change_counter(&c, &a.id, &character.id, 0, "hp", -1).is_err());
    assert_eq!(
        get_character(&c, &a.id).unwrap().unwrap().data.hp_current,
        8
    );
    c.pragma_update(None, "query_only", "OFF").unwrap();
    c.execute(
        "UPDATE characters SET data='{}' WHERE id=?1",
        [&character.id],
    )
    .unwrap();
    let file = temp.path().join("invalid.nodex");
    assert!(backup::write_backup(&c, temp.path(), &file).is_err());
    assert!(!file.exists());
}
