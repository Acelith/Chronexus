use rusqlite::Connection;
use std::{path::Path, time::Duration};

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
            1
        );
        assert_eq!(
            connection
                .query_row("PRAGMA foreign_keys", [], |row| row.get::<_, i64>(0))
                .unwrap(),
            1
        );
    }
}
