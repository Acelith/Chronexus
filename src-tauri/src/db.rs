use rusqlite::Connection;
use std::{path::Path, time::Duration};

pub const MIGRATIONS: [&str; 23] = [
    include_str!("../migrations/001_foundation.sql"),
    include_str!("../migrations/002_journal.sql"),
    include_str!("../migrations/003_knowledge.sql"),
    include_str!("../migrations/004_relationships.sql"),
    include_str!("../migrations/005_player.sql"),
    include_str!("../migrations/006_sheet_catalog.sql"),
    include_str!("../migrations/007_search.sql"),
    include_str!("../migrations/008_images.sql"),
    include_str!("../migrations/009_import_sources.sql"),
    include_str!("../migrations/010_party.sql"),
    include_str!("../migrations/011_wiki.sql"),
    include_str!("../migrations/012_assistant.sql"),
    include_str!("../migrations/013_campaign_ai.sql"),
    include_str!("../migrations/014_training.sql"),
    include_str!("../migrations/015_dice.sql"),
    include_str!("../migrations/016_wikidot.sql"),
    include_str!("../migrations/017_wiki_translation.sql"),
    include_str!("../migrations/018_retire_legacy_qwen.sql"),
    include_str!("../migrations/019_sync.sql"),
    include_str!("../migrations/020_sync_replication.sql"),
    include_str!("../migrations/021_sync_projections.sql"),
    include_str!("../migrations/022_clue_board.sql"),
    include_str!("../migrations/023_timeline.sql"),
];
pub const LATEST_SCHEMA: i64 = MIGRATIONS.len() as i64;

pub fn open(path: &Path) -> rusqlite::Result<Connection> {
    let mut connection = Connection::open(path)?;
    connection.busy_timeout(Duration::from_secs(5))?;
    connection.pragma_update(None, "foreign_keys", "ON")?;
    let exists: bool = connection.query_row(
        "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='schema_migrations')",
        [], |row| row.get(0),
    )?;
    if !exists {
        let transaction = connection.transaction()?;
        transaction.execute_batch(include_str!("../migrations/001_foundation.sql"))?;
        transaction.commit()?;
    }
    let version: i64 =
        connection.query_row("SELECT MAX(version) FROM schema_migrations", [], |row| {
            row.get(0)
        })?;
    if version > LATEST_SCHEMA {
        return Err(rusqlite::Error::InvalidQuery);
    }
    for migration in MIGRATIONS.iter().skip(version as usize) {
        let transaction = connection.transaction()?;
        transaction.execute_batch(migration)?;
        if migration.contains("CREATE TABLE search_documents") {
            crate::search::rebuild_all(&transaction).map_err(|_| rusqlite::Error::InvalidQuery)?;
        }
        transaction.commit()?;
    }
    Ok(connection)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migration_runs_once_and_data_survives_reopen() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("test.sqlite3");
        {
            let connection = open(&path).unwrap();
            connection
                .execute(
                    "INSERT INTO app_metadata(key, value) VALUES (?1, ?2)",
                    ["smoke", "persistente"],
                )
                .unwrap();
        }
        let connection = open(&path).unwrap();
        let value: String = connection
            .query_row(
                "SELECT value FROM app_metadata WHERE key=?1",
                ["smoke"],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(value, "persistente");
        assert_eq!(
            connection
                .query_row("SELECT COUNT(*) FROM schema_migrations", [], |row| row
                    .get::<_, i64>(0))
                .unwrap(),
            LATEST_SCHEMA
        );
        assert_eq!(
            connection
                .query_row("PRAGMA foreign_keys", [], |row| row.get::<_, i64>(0))
                .unwrap(),
            1
        );
    }
}
