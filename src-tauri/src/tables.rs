//! Local associations only. Table snapshots, maps, combat and GM data are never stored.
use crate::{
    journal::{self, AppResult},
    sync,
};
use rusqlite::{params, Connection};
use serde::Serialize;
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Link {
    pub server: String,
    pub account_id: String,
    pub table_id: String,
}
pub fn links(c: &Connection, campaign: &str) -> AppResult<Vec<Link>> {
    journal::require_campaign(c, campaign)?;
    let mut q=c.prepare("SELECT server,account_id,table_id FROM table_links WHERE campaign_id=?1 ORDER BY server,table_id").map_err(journal::storage)?;
    let rows = q
        .query_map([campaign], |r| {
            Ok(Link {
                server: r.get(0)?,
                account_id: r.get(1)?,
                table_id: r.get(2)?,
            })
        })
        .map_err(journal::storage)?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(journal::storage)
}
pub fn set_link(
    c: &Connection,
    campaign: &str,
    server: &str,
    account: &str,
    table: &str,
    enabled: bool,
) -> AppResult<()> {
    journal::require_campaign(c, campaign)?;
    sync::server_url(server, false)?;
    sync::remote_id(account)?;
    sync::remote_id(table)?;
    if enabled {
        let count: i64 = c
            .query_row(
                "SELECT count(*) FROM table_links WHERE campaign_id=?1",
                [campaign],
                |r| r.get(0),
            )
            .map_err(journal::storage)?;
        if count >= 100 {
            return Err("Too many linked tables.".into());
        }
        c.execute(
            "INSERT OR IGNORE INTO table_links VALUES(?1,?2,?3,?4)",
            params![campaign, server, account, table],
        )
        .map_err(journal::storage)?;
    } else {
        c.execute("DELETE FROM table_links WHERE campaign_id=?1 AND server=?2 AND account_id=?3 AND table_id=?4",params![campaign,server,account,table]).map_err(journal::storage)?;
    }
    Ok(())
}
pub fn validate_archive(c: &Connection) -> AppResult<()> {
    let mut q = c
        .prepare("SELECT campaign_id,server,account_id,table_id FROM table_links")
        .map_err(journal::storage)?;
    let rows = q
        .query_map([], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, String>(3)?,
            ))
        })
        .map_err(journal::storage)?;
    for row in rows {
        let (campaign, server, account, table) = row.map_err(journal::storage)?;
        journal::identifier(&campaign)?;
        sync::server_url(&server, false)?;
        sync::remote_id(&account)?;
        sync::remote_id(&table)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn archive() -> Connection {
        let c = Connection::open_in_memory().unwrap();
        c.pragma_update(None, "foreign_keys", "ON").unwrap();
        for migration in crate::db::MIGRATIONS {
            c.execute_batch(migration).unwrap();
        }
        c
    }
    #[test]
    fn links_are_campaign_scoped_and_never_contain_table_state() {
        let c = archive();
        let a = journal::create_campaign(&c, "Synthetic A").unwrap();
        let b = journal::create_campaign(&c, "Synthetic B").unwrap();
        let actor = uuid::Uuid::new_v4().to_string();
        let table = uuid::Uuid::new_v4().to_string();
        set_link(&c, &a.id, "https://table.example", &actor, &table, true).unwrap();
        set_link(&c, &a.id, "https://table.example", &actor, &table, true).unwrap();
        assert_eq!(links(&c, &a.id).unwrap().len(), 1);
        assert!(links(&c, &b.id).unwrap().is_empty());
        validate_archive(&c).unwrap();
        let mut q = c.prepare("PRAGMA table_info(table_links)").unwrap();
        let names = q
            .query_map([], |r| r.get::<_, String>(1))
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();
        assert_eq!(names, ["campaign_id", "server", "account_id", "table_id"]);
        set_link(&c, &a.id, "https://table.example", &actor, &table, false).unwrap();
        assert!(links(&c, &a.id).unwrap().is_empty());
    }
    #[test]
    fn unsafe_restored_links_and_non_https_addresses_are_rejected() {
        let c = archive();
        let a = journal::create_campaign(&c, "Synthetic").unwrap();
        let actor = uuid::Uuid::new_v4().to_string();
        let table = uuid::Uuid::new_v4().to_string();
        assert!(set_link(&c, &a.id, "http://table.example", &actor, &table, true).is_err());
        c.execute(
            "INSERT INTO table_links VALUES(?1,?2,?3,?4)",
            params![a.id, "file:///private", actor, table],
        )
        .unwrap();
        assert!(validate_archive(&c).is_err());
    }
}
