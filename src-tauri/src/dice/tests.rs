use super::*;
use crate::{backup, db, journal};
use tempfile::tempdir;
use uuid::Uuid;
fn selection(sides: i64, quantity: i64) -> Selection {
    Selection { sides, quantity }
}
#[test]
fn all_types_ranges_subtotals_and_os_rng() {
    let dir = tempdir().unwrap();
    let c = db::open(&dir.path().join("dice.db")).unwrap();
    let campaign = journal::create_campaign(&c, "Prova").unwrap();
    let input: Vec<_> = SIDES.iter().map(|s| selection(*s, 3)).collect();
    let r = roll(&c, &campaign.id, &Uuid::new_v4().to_string(), &input).unwrap();
    validate(&r).unwrap();
    assert_eq!(r.groups.len(), 7);
    assert_eq!(r.groups.iter().map(|g| g.quantity).sum::<i64>(), 21);
    for g in r.groups {
        assert!(g.values.iter().all(|v| (1..=g.sides).contains(v)));
    }
}
#[test]
fn deterministic_extremes_and_rejection() {
    for sides in SIDES {
        let mut words = [u32::MAX, 0, sides as u32 - 1].into_iter();
        assert_eq!(sample(sides, &mut || Ok(words.next().unwrap())).unwrap(), 1);
        assert_eq!(
            sample(sides, &mut || Ok(words.next().unwrap())).unwrap(),
            sides
        );
    }
}
#[test]
fn rejects_empty_fractional_negative_unknown_duplicate_and_limits() {
    for input in [
        vec![],
        vec![selection(6, 0)],
        vec![selection(6, -1)],
        vec![selection(6, 51)],
        vec![selection(6, 50), selection(20, 50), selection(100, 1)],
        vec![selection(3, 1)],
        vec![selection(6, 1), selection(6, 2)],
    ] {
        assert!(composition(&input).is_err());
    }
    assert!(serde_json::from_str::<Selection>(r#"{"sides":6,"quantity":1.5}"#).is_err());
    assert!(composition(&[selection(6, 50), selection(100, 50)]).is_ok());
}
#[test]
fn retry_does_not_reroll_and_request_cannot_cross_campaigns() {
    let dir = tempdir().unwrap();
    let c = db::open(&dir.path().join("dice.db")).unwrap();
    let a = journal::create_campaign(&c, "A").unwrap();
    let b = journal::create_campaign(&c, "B").unwrap();
    let id = Uuid::new_v4().to_string();
    let first = roll_with(&c, &a.id, &id, &[selection(100, 2)], &mut || Ok(99)).unwrap();
    let retry = roll_with(&c, &a.id, &id, &[selection(100, 2)], &mut || {
        panic!("must not generate again")
    })
    .unwrap();
    assert_eq!(first, retry);
    assert_eq!(first.total, 200);
    assert!(roll(&c, &b.id, &id, &[selection(100, 2)]).is_err());
    assert!(roll(&c, &a.id, &id, &[selection(20, 2)]).is_err());
    assert!(history(&c, &b.id, None).unwrap().rolls.is_empty());
    assert_eq!(history(&c, &a.id, None).unwrap().rolls.len(), 1);
}
#[test]
fn failed_randomness_and_storage_do_not_register_a_roll() {
    let dir = tempdir().unwrap();
    let c = db::open(&dir.path().join("dice.db")).unwrap();
    let a = journal::create_campaign(&c, "A").unwrap();
    let id = Uuid::new_v4().to_string();
    let mut calls = 0;
    assert!(roll_with(&c, &a.id, &id, &[selection(6, 3)], &mut || {
        calls += 1;
        if calls == 2 {
            Err("test RNG failure".into())
        } else {
            Ok(0)
        }
    })
    .is_err());
    assert!(history(&c, &a.id, None).unwrap().rolls.is_empty());
    c.execute_batch("CREATE TRIGGER fail_dice BEFORE INSERT ON dice_rolls BEGIN SELECT RAISE(ABORT,'test write failure'); END;").unwrap();
    assert!(roll(&c, &a.id, &id, &[selection(6, 3)]).is_err());
    c.execute_batch("DROP TRIGGER fail_dice;").unwrap();
    assert!(history(&c, &a.id, None).unwrap().rolls.is_empty());
    let saved = roll(&c, &a.id, &id, &[selection(6, 3)]).unwrap();
    assert_eq!(saved.id, id);
}
#[test]
fn pagination_reopen_and_query_plan() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("dice.db");
    let c = db::open(&path).unwrap();
    let a = journal::create_campaign(&c, "A").unwrap();
    for _ in 0..67 {
        roll(&c, &a.id, &Uuid::new_v4().to_string(), &[selection(4, 1)]).unwrap();
    }
    let first = history(&c, &a.id, None).unwrap();
    assert_eq!(first.rolls.len(), 30);
    let second = history(&c, &a.id, first.next_cursor.as_ref()).unwrap();
    assert_eq!(second.rolls.len(), 30);
    let third = history(&c, &a.id, second.next_cursor.as_ref()).unwrap();
    assert_eq!(third.rolls.len(), 7);
    assert!(third.next_cursor.is_none());
    let all = all(&c, &a.id).unwrap();
    let ids: std::collections::HashSet<_> = all.iter().map(|r| r.id.clone()).collect();
    assert_eq!(ids.len(), 67);
    let plan:String=c.query_row("EXPLAIN QUERY PLAN SELECT id FROM dice_rolls WHERE campaign_id=?1 ORDER BY created_at DESC,id DESC LIMIT 31",[&a.id],|r|r.get(3)).unwrap();
    assert!(plan.contains("dice_history"));
    drop(c);
    let reopened = db::open(&path).unwrap();
    assert_eq!(all, super::all(&reopened, &a.id).unwrap());
}
#[test]
fn backup_restore_and_archive_validation() {
    let dir = tempdir().unwrap();
    let store = backup::Store::open(&dir.path().join("source")).unwrap();
    let a = journal::create_campaign(&store.connection, "Dadi").unwrap();
    let saved = roll(
        &store.connection,
        &a.id,
        &Uuid::new_v4().to_string(),
        &[selection(6, 2), selection(100, 1)],
    )
    .unwrap();
    let bundle = dir.path().join("dice.nodex");
    let receipt = backup::write_backup(&store.connection, &store.directory, &bundle).unwrap();
    assert_eq!(receipt.counts.dice_rolls, 1);
    let mut target = backup::Store::open(&dir.path().join("target")).unwrap();
    let preview = target.prepare(&bundle).unwrap();
    target.restore(&preview.token).unwrap();
    assert_eq!(
        history(&target.connection, &a.id, None)
            .unwrap()
            .rolls
            .as_slice(),
        std::slice::from_ref(&saved)
    );
    drop(target);
    let target = backup::Store::open(&dir.path().join("target")).unwrap();
    assert_eq!(
        history(&target.connection, &a.id, None).unwrap().rolls,
        [saved]
    );
    store
        .connection
        .execute(
            "UPDATE dice_rolls SET payload=json_set(payload,'$.total',999999)",
            [],
        )
        .unwrap();
    assert!(validate_archive(&store.connection).is_err());
    assert!(backup::write_backup(
        &store.connection,
        &store.directory,
        &dir.path().join("invalid.nodex")
    )
    .is_err());
}
#[test]
fn older_backup_migrates_without_history_or_data_loss() {
    let dir = tempdir().unwrap();
    let old_root = dir.path().join("v14");
    std::fs::create_dir(&old_root).unwrap();
    let old = Connection::open(old_root.join("nodex.sqlite3")).unwrap();
    for migration in db::MIGRATIONS.iter().take(14) {
        old.execute_batch(migration).unwrap();
    }
    let campaign = journal::create_campaign(&old, "Archivio precedente").unwrap();
    let session = journal::create_session(&old, &campaign.id, 1, "To keep", None).unwrap();
    let bundle = dir.path().join("old.nodex");
    backup::write_backup(&old, &old_root, &bundle).unwrap();
    let mut target = backup::Store::open(&dir.path().join("target")).unwrap();
    let preview = target.prepare(&bundle).unwrap();
    assert_eq!(preview.manifest.schema_version, 14);
    target.restore(&preview.token).unwrap();
    assert!(history(&target.connection, &campaign.id, None)
        .unwrap()
        .rolls
        .is_empty());
    assert_eq!(
        journal::list_sessions(&target.connection, &campaign.id).unwrap()[0].id,
        session.id
    );
}
