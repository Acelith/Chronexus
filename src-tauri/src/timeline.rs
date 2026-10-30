use crate::journal::{identifier, require_campaign, storage, AppResult};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Month {
    pub name: String,
    pub days: i64,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Calendar {
    pub months: Vec<Month>,
    pub weekdays: Vec<String>,
    pub eras: Vec<String>,
}

fn valid_name(value: &str) -> bool {
    !value.trim().is_empty() && value.chars().count() <= 80 && !value.contains(['\0', '\n', '\r'])
}
fn validate_calendar(calendar: &Calendar) -> AppResult<()> {
    if calendar.months.is_empty()
        || calendar.months.len() > 24
        || calendar.weekdays.is_empty()
        || calendar.weekdays.len() > 20
        || calendar.eras.is_empty()
        || calendar.eras.len() > 20
        || calendar
            .months
            .iter()
            .any(|m| !valid_name(&m.name) || !(1..=366).contains(&m.days))
        || calendar.weekdays.iter().any(|w| !valid_name(w))
        || calendar.eras.iter().any(|e| !valid_name(e))
    {
        return Err(
            "Invalid calendar: provide named months, weekdays and eras with valid month lengths."
                .into(),
        );
    }
    Ok(())
}
pub fn calendar(c: &Connection, campaign: &str) -> AppResult<Option<Calendar>> {
    require_campaign(c, campaign)?;
    let raw: Option<(String, String, String)> = c
        .query_row(
            "SELECT months_json,weekdays_json,eras_json FROM world_calendars WHERE campaign_id=?1",
            [campaign],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .optional()
        .map_err(storage)?;
    raw.map(|(m, w, e)| {
        Ok(Calendar {
            months: serde_json::from_str(&m).map_err(|_| "Invalid stored calendar.")?,
            weekdays: serde_json::from_str(&w).map_err(|_| "Invalid stored calendar.")?,
            eras: serde_json::from_str(&e).map_err(|_| "Invalid stored calendar.")?,
        })
    })
    .transpose()
}
pub fn save_calendar(c: &Connection, campaign: &str, value: Calendar) -> AppResult<Calendar> {
    require_campaign(c, campaign)?;
    validate_calendar(&value)?;
    let mut query = c.prepare("SELECT era,month,day FROM timeline_entries WHERE campaign_id=?1 AND precision!='unknown'").map_err(storage)?;
    let rows = query
        .query_map([campaign], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, i64>(1)?,
                r.get::<_, i64>(2)?,
            ))
        })
        .map_err(storage)?;
    for row in rows {
        let (era, month, day) = row.map_err(storage)?;
        if !value.eras.contains(&era)
            || value
                .months
                .get((month - 1) as usize)
                .is_none_or(|m| day > m.days)
        {
            return Err("Calendar change would invalidate a saved date.".into());
        }
    }
    c.execute("INSERT INTO world_calendars(campaign_id,months_json,weekdays_json,eras_json) VALUES(?1,?2,?3,?4) ON CONFLICT(campaign_id) DO UPDATE SET months_json=excluded.months_json,weekdays_json=excluded.weekdays_json,eras_json=excluded.eras_json", params![campaign,serde_json::to_string(&value.months).map_err(|_| "Invalid calendar.")?,serde_json::to_string(&value.weekdays).map_err(|_| "Invalid calendar.")?,serde_json::to_string(&value.eras).map_err(|_| "Invalid calendar.")?]).map_err(storage)?;
    Ok(value)
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct EntryInput {
    pub source_kind: String,
    pub source_id: String,
    pub era: String,
    pub year: Option<i64>,
    pub month: Option<i64>,
    pub day: Option<i64>,
    pub precision: String,
    pub note: String,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    pub id: String,
    pub campaign_id: String,
    pub input: EntryInput,
    pub revision: i64,
}
fn source_column(kind: &str) -> AppResult<(&'static str, &'static str)> {
    match kind {
        "session" => Ok(("session_id", "sessions")),
        "page" => Ok(("page_id", "pages")),
        "clue" => Ok(("clue_id", "clues")),
        _ => Err("Invalid timeline source.".into()),
    }
}
fn entry_row(r: &rusqlite::Row<'_>) -> rusqlite::Result<Entry> {
    let session: Option<String> = r.get(2)?;
    let page: Option<String> = r.get(3)?;
    let clue: Option<String> = r.get(4)?;
    let (source_kind, source_id) = if let Some(id) = session {
        ("session".to_string(), id)
    } else if let Some(id) = page {
        ("page".to_string(), id)
    } else {
        ("clue".to_string(), clue.unwrap_or_default())
    };
    Ok(Entry {
        id: r.get(0)?,
        campaign_id: r.get(1)?,
        input: EntryInput {
            source_kind,
            source_id,
            era: r.get(5)?,
            year: r.get(6)?,
            month: r.get(7)?,
            day: r.get(8)?,
            precision: r.get(9)?,
            note: r.get(10)?,
        },
        revision: r.get(11)?,
    })
}
pub fn list(c: &Connection, campaign: &str) -> AppResult<Vec<Entry>> {
    require_campaign(c, campaign)?;
    let mut q=c.prepare("SELECT id,campaign_id,session_id,page_id,clue_id,era,year,month,day,precision,note,revision FROM timeline_entries WHERE campaign_id=?1 ORDER BY precision='unknown',era,year,month,day,id").map_err(storage)?;
    let mut rows = q
        .query_map([campaign], entry_row)
        .map_err(storage)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(storage)?;
    drop(q);
    // Eras follow the calendar's order, not the alphabet; unknown dates come last.
    let eras = calendar(c, campaign)?
        .map(|cal| cal.eras)
        .unwrap_or_default();
    let era_rank = |era: &str| eras.iter().position(|e| e == era).unwrap_or(usize::MAX);
    rows.sort_by(|a, b| {
        let key = |e: &Entry| {
            (
                e.input.precision == "unknown",
                era_rank(&e.input.era),
                e.input.year,
                e.input.month,
                e.input.day,
            )
        };
        key(a).cmp(&key(b)).then_with(|| a.id.cmp(&b.id))
    });
    Ok(rows)
}
fn validate_input(c: &Connection, campaign: &str, input: &EntryInput) -> AppResult<()> {
    if input.note.chars().count() > 1000
        || input.note.contains('\0')
        || !["exact", "approximate", "unknown"].contains(&input.precision.as_str())
    {
        return Err("Invalid timeline entry.".into());
    }
    let cal = calendar(c, campaign)?.ok_or("Create the campaign calendar before adding dates.")?;
    if input.precision == "unknown" {
        if input.year.is_some() || input.month.is_some() || input.day.is_some() {
            return Err("Unknown dates cannot have a day.".into());
        }
    } else {
        let (y, m, d) = (
            input.year.ok_or("Missing year.")?,
            input.month.ok_or("Missing month.")?,
            input.day.ok_or("Missing day.")?,
        );
        if !(-999999..=999999).contains(&y)
            || !cal.eras.contains(&input.era)
            || m < 1
            || cal
                .months
                .get((m - 1) as usize)
                .is_none_or(|month| d < 1 || d > month.days)
        {
            return Err("Date is outside the campaign calendar.".into());
        }
    }
    Ok(())
}
pub fn save(
    c: &Connection,
    campaign: &str,
    id: Option<String>,
    revision: Option<i64>,
    input: EntryInput,
) -> AppResult<Entry> {
    require_campaign(c, campaign)?;
    let (field, table) = source_column(&input.source_kind)?;
    identifier(&input.source_id)?;
    validate_input(c, campaign, &input)?;
    let found: bool = c
        .query_row(
            &format!("SELECT EXISTS(SELECT 1 FROM {table} WHERE campaign_id=?1 AND id=?2)"),
            params![campaign, input.source_id],
            |r| r.get(0),
        )
        .map_err(storage)?;
    if !found {
        return Err("Timeline source not found in this campaign.".into());
    }
    let id = if let Some(id) = id {
        identifier(&id)?;
        id
    } else {
        uuid::Uuid::new_v4().to_string()
    };
    let (session, page, clue) = (
        if field == "session_id" {
            Some(input.source_id.as_str())
        } else {
            None
        },
        if field == "page_id" {
            Some(input.source_id.as_str())
        } else {
            None
        },
        if field == "clue_id" {
            Some(input.source_id.as_str())
        } else {
            None
        },
    );
    let changed = if let Some(revision) = revision {
        c.execute("UPDATE timeline_entries SET session_id=?1,page_id=?2,clue_id=?3,era=?4,year=?5,month=?6,day=?7,precision=?8,note=?9,revision=revision+1 WHERE campaign_id=?10 AND id=?11 AND revision=?12",params![session,page,clue,input.era,input.year,input.month,input.day,input.precision,input.note,campaign,id,revision]).map_err(storage)?
    } else {
        c.execute("INSERT INTO timeline_entries(id,campaign_id,session_id,page_id,clue_id,era,year,month,day,precision,note) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)",params![id,campaign,session,page,clue,input.era,input.year,input.month,input.day,input.precision,input.note]).map_err(storage)?
    };
    if changed != 1 {
        return Err("Timeline entry changed elsewhere. Reload before saving.".into());
    }
    list(c, campaign)?
        .into_iter()
        .find(|e| e.id == id)
        .ok_or("Timeline entry missing after save.".into())
}
pub fn delete(c: &Connection, campaign: &str, id: &str, revision: i64) -> AppResult<()> {
    require_campaign(c, campaign)?;
    identifier(id)?;
    let count = c
        .execute(
            "DELETE FROM timeline_entries WHERE campaign_id=?1 AND id=?2 AND revision=?3",
            params![campaign, id, revision],
        )
        .map_err(storage)?;
    if count != 1 {
        return Err("Timeline entry changed elsewhere. Reload before deleting.".into());
    }
    Ok(())
}
pub fn validate_archive(c: &Connection) -> AppResult<()> {
    for campaign in crate::journal::list_campaigns(c)? {
        if let Some(value) = calendar(c, &campaign.id)? {
            validate_calendar(&value)?;
        }
        for entry in list(c, &campaign.id)? {
            source_column(&entry.input.source_kind)?;
            identifier(&entry.id)?;
            validate_input(c, &campaign.id, &entry.input)?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn archive_validation_rejects_missing_and_out_of_calendar_dates() {
        let directory = tempfile::tempdir().unwrap();
        let c = crate::db::open(&directory.path().join("invalid.sqlite3")).unwrap();
        let campaign = crate::journal::create_campaign(&c, "Test").unwrap();
        let page = crate::knowledge::create_page(&c, &campaign.id, "Port", "place", "active", &[])
            .unwrap();
        save_calendar(
            &c,
            &campaign.id,
            Calendar {
                months: vec![Month {
                    name: "Dawn".into(),
                    days: 30,
                }],
                weekdays: vec!["Firstday".into()],
                eras: vec!["Age".into()],
            },
        )
        .unwrap();
        let entry = save(
            &c,
            &campaign.id,
            None,
            None,
            EntryInput {
                source_kind: "page".into(),
                source_id: page.id,
                era: "Age".into(),
                year: Some(1),
                month: Some(1),
                day: Some(30),
                precision: "exact".into(),
                note: String::new(),
            },
        )
        .unwrap();
        c.execute(
            "UPDATE timeline_entries SET day=31 WHERE id=?1",
            [&entry.id],
        )
        .unwrap();
        assert!(validate_archive(&c).is_err());
        c.execute(
            "UPDATE timeline_entries SET day=NULL WHERE id=?1",
            [&entry.id],
        )
        .unwrap();
        assert!(validate_archive(&c).is_err());
    }

    #[test]
    fn calendar_and_session_date_survive_reopen() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("timeline.sqlite3");
        let c = crate::db::open(&path).unwrap();
        let campaign = crate::journal::create_campaign(&c, "Test").unwrap();
        let session = crate::journal::create_session(&c, &campaign.id, 1, "First", None).unwrap();
        let value = Calendar {
            months: vec![Month {
                name: "Dawn".into(),
                days: 30,
            }],
            weekdays: vec!["Firstday".into()],
            eras: vec!["Age".into()],
        };
        save_calendar(&c, &campaign.id, value).unwrap();
        let entry = save(
            &c,
            &campaign.id,
            None,
            None,
            EntryInput {
                source_kind: "session".into(),
                source_id: session.id,
                era: "Age".into(),
                year: Some(1),
                month: Some(1),
                day: Some(30),
                precision: "approximate".into(),
                note: "Player estimate".into(),
            },
        )
        .unwrap();
        assert!(save_calendar(
            &c,
            &campaign.id,
            Calendar {
                months: vec![Month {
                    name: "Dawn".into(),
                    days: 29
                }],
                weekdays: vec!["Firstday".into()],
                eras: vec!["Age".into()]
            }
        )
        .is_err());
        drop(c);
        let c = crate::db::open(&path).unwrap();
        assert_eq!(list(&c, &campaign.id).unwrap()[0].id, entry.id);
        assert_eq!(
            calendar(&c, &campaign.id).unwrap().unwrap().months[0].days,
            30
        );
    }

    #[test]
    fn eras_sort_by_calendar_order_and_clue_deletion_removes_its_date() {
        let directory = tempfile::tempdir().unwrap();
        let c = crate::db::open(&directory.path().join("t.sqlite3")).unwrap();
        let campaign = crate::journal::create_campaign(&c, "Order").unwrap();
        let first = crate::journal::create_session(&c, &campaign.id, 1, "One", None).unwrap();
        let second = crate::journal::create_session(&c, &campaign.id, 2, "Two", None).unwrap();
        save_calendar(
            &c,
            &campaign.id,
            Calendar {
                months: vec![Month {
                    name: "Dawn".into(),
                    days: 30,
                }],
                weekdays: vec!["Day".into()],
                eras: vec!["Zenith".into(), "Ashes".into()],
            },
        )
        .unwrap();
        let date = |source: &str, era: &str, kind: &str| EntryInput {
            source_kind: kind.into(),
            source_id: source.into(),
            era: era.into(),
            year: Some(1),
            month: Some(1),
            day: Some(1),
            precision: "exact".into(),
            note: String::new(),
        };
        let later = save(
            &c,
            &campaign.id,
            None,
            None,
            date(&second.id, "Ashes", "session"),
        )
        .unwrap();
        let earlier = save(
            &c,
            &campaign.id,
            None,
            None,
            date(&first.id, "Zenith", "session"),
        )
        .unwrap();
        let ids: Vec<_> = list(&c, &campaign.id)
            .unwrap()
            .into_iter()
            .map(|e| e.id)
            .collect();
        assert_eq!(ids, vec![earlier.id, later.id]);
        let clue = crate::clues::save(
            &c,
            &campaign.id,
            None,
            None,
            crate::clues::Input {
                kind: "lead".into(),
                title: "Seal".into(),
                details: String::new(),
                certainty: "unknown".into(),
                status: "open".into(),
                sources: vec![],
                page_ids: vec![],
                resolution_session_id: None,
            },
        )
        .unwrap();
        save(
            &c,
            &campaign.id,
            None,
            None,
            date(&clue.id, "Ashes", "clue"),
        )
        .unwrap();
        crate::clues::delete(&c, &campaign.id, &clue.id, clue.revision).unwrap();
        assert_eq!(list(&c, &campaign.id).unwrap().len(), 2);
    }
}
